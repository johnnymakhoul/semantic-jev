import axios from 'axios';
import { SemanticAdapter } from './base';
import { CanonicalQuery, ExecutionContext, StandardExecutionResult } from '../types';

export class DbtSemanticAdapter implements SemanticAdapter {
  readonly providerName = 'dbt-MetricFlow';
  private apiUrl: string;
  private serviceToken: string;
  private environmentId: string;

  constructor(
    apiUrl = process.env.DBT_SL_URL || 'https://semantic-layer.cloud.getdbt.com/api/graphql',
    serviceToken = process.env.DBT_SL_TOKEN || 'token',
    environmentId = process.env.DBT_ENVIRONMENT_ID || '1000'
  ) {
    this.apiUrl = apiUrl;
    this.serviceToken = serviceToken;
    this.environmentId = environmentId;
  }

  public async execute(query: CanonicalQuery, context: ExecutionContext): Promise<StandardExecutionResult> {
    // Construct MetricFlow GraphQL query structure
    const groupByList = [
      ...query.dimensions,
      ...query.timeDimensions.map(t => `${t.field}__${t.granularity}`)
    ];

    const whereClauses = query.filters.map(f => {
      const val = f.values.map(v => `'${v}'`).join(', ');
      return `{{ Dimension('${f.field}') }} = ${val}`;
    });

    const allColumns = [...groupByList, ...query.metrics];

    if (!process.env.DBT_SL_URL || this.serviceToken === 'your_dbt_service_token' || this.serviceToken === 'token') {
      // Mock execution if running standalone without live dbt endpoint
      return {
        provider: this.providerName,
        columns: allColumns,
        rows: [
          Object.fromEntries(allColumns.map(c => [c, query.metrics.includes(c) ? 510000 : `${c}_sample_1`])),
          Object.fromEntries(allColumns.map(c => [c, query.metrics.includes(c) ? 540000 : `${c}_sample_2`]))
        ]
      };
    }

    const gqlQuery = `
      mutation CreateQuery {
        createQuery(
          environmentId: ${this.environmentId}
          metrics: [${query.metrics.map(m => `"${m}"`).join(', ')}]
          groupBy: [${groupByList.map(g => `"${g}"`).join(', ')}]
          where: ${whereClauses.length > 0 ? `"${whereClauses.join(' AND ')}"` : 'null'}
        ) {
          queryId
        }
      }
    `;

    try {
      const response = await axios.post(
        this.apiUrl,
        { query: gqlQuery },
        {
          headers: {
            'Authorization': `Bearer ${this.serviceToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-Id': context.tenantId
          },
          timeout: 5000
        }
      );

      // In production, poll queryId status until completed, then return results
      const rawData = response.data?.data?.results || [];
      return {
        provider: this.providerName,
        columns: rawData.length > 0 ? Object.keys(rawData[0]) : [],
        rows: rawData
      };
    } catch (err) {
      console.warn(`[${this.providerName}] Connection failed (${(err as Error).message}), returning mock data.`);
      return {
        provider: this.providerName,
        columns: allColumns,
        rows: [
          Object.fromEntries(allColumns.map(c => [c, query.metrics.includes(c) ? 510000 : `${c}_sample_1`])),
          Object.fromEntries(allColumns.map(c => [c, query.metrics.includes(c) ? 540000 : `${c}_sample_2`]))
        ]
      };
    }
  }
}
