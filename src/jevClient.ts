import { CanonicalQuery } from './types';

export interface JevInference {
  intent: string;
  confidence: number;
  extractedQuery: CanonicalQuery;
}

export class JevClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl = process.env.JEV_API_URL || 'https://api.jev.ai', apiKey = process.env.JEV_API_KEY || 'mock') {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  public async classify(prompt: string): Promise<JevInference> {
    const normalized = prompt.toLowerCase();

    // Deterministic simulation matching classification behavior
    if (normalized.includes('revenue') || normalized.includes('sales')) {
      return {
        intent: 'query_metric',
        confidence: 0.95,
        extractedQuery: {
          metrics: ['total_revenue'],
          dimensions: ['customer__region'],
          timeDimensions: [
            {
              field: 'order_date',
              granularity: 'month',
              dateRange: 'This year'
            }
          ],
          filters: normalized.includes('emea')
            ? [{ field: 'customer__region', operator: 'equals', values: ['EMEA'] }]
            : []
        }
      };
    }

    if (normalized.includes('users') || normalized.includes('customers')) {
      return {
        intent: 'query_metric',
        confidence: 0.73, // Intermediate confidence -> prompts disambiguation
        extractedQuery: {
          metrics: ['active_users_count'],
          dimensions: ['user_plan_tier'],
          timeDimensions: [],
          filters: []
        }
      };
    }

    return {
      intent: 'unsupported',
      confidence: 0.32, // Low confidence -> rejection
      extractedQuery: { metrics: [], dimensions: [], filters: [], timeDimensions: [] }
    };
  }
}
