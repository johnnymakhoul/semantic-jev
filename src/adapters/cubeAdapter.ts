import axios from 'axios';
import { SemanticAdapter } from './base';
import { CanonicalQuery, ExecutionContext, StandardExecutionResult } from '../types';

export class CubeSemanticAdapter implements SemanticAdapter {
  readonly providerName = 'Cube';
  private apiUrl: string;
  private apiToken: string;

  constructor(apiUrl = process.env.CUBEJS_API_URL, apiToken = process.env.CUBEJS_API_TOKEN || 'token') {
    this.apiUrl = (apiUrl || 'http://localhost:4000').replace(/\/$/, '');
    this.apiToken = apiToken;
  }

  public async execute(query: CanonicalQuery, context: ExecutionContext): Promise<StandardExecutionResult> {
    // Translate CanonicalQuery to Cube REST JSON format
    const cubeQuery = {
      measures: query.metrics,
      dimensions: query.dimensions,
      filters: query.filters.map(f => ({
        member: f.field,
        operator: f.operator,
        values: f.values
      })),
      timeDimensions: query.timeDimensions.map(t => ({
        dimension: t.field,
        granularity: t.granularity,
        dateRange: t.dateRange
      })),
      limit: query.limit
    };

    if (!process.env.CUBEJS_API_URL) {
      // Mock execution if running standalone
      return {
        provider: this.providerName,
        columns: [...query.dimensions, ...query.metrics],
        rows: [
          { 'Customers.region': 'EMEA', 'Orders.createdAt.month': '2026-08', 'Orders.totalAmount': 415000 },
          { 'Customers.region': 'EMEA', 'Orders.createdAt.month': '2026-09', 'Orders.totalAmount': 472000 }
        ]
      };
    }

    const response = await axios.post(
      `${this.apiUrl}/cubejs-api/v1/load`,
      { query: cubeQuery },
      {
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json',
          'x-tenant-id': context.tenantId,
          'x-user-role': context.role
        }
      }
    );

    const rows = response.data?.data || [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { provider: this.providerName, columns, rows };
  }
}
