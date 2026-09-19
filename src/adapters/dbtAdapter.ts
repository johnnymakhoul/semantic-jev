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

    if (!process.env.DBT_SL_URL) {
      // Mock execution if running standalone
      return {
        provider: this.providerName,
        columns: [...groupByList, ...query.metrics],
        rows: [
          { 'customer__region': 'EMEA', 'order_date__month': '2026-08-01', 'total_revenue': 510000 },
          { 'customer__region': 'EMEA', 'order_date__month': '2026-09-01', 'total_revenue': 540000 }
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

    const response = await axios.post(
      this.apiUrl,
      { query: gqlQuery },
      {
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json',
          'X-Tenant-Id': context.tenantId
        }
      }
    );

    // In production, poll queryId status until completed, then return results
    const rawData = response.data?.data?.results || [];
    return {
      provider: this.providerName,
      columns: rawData.length > 0 ? Object.keys(rawData[0]) : [],
      rows: rawData
    };
  }
}
