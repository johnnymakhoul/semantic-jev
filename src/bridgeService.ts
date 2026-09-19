import { JevClient } from './jevClient';
import { SemanticAdapter } from './adapters/base';
import { ExecutionContext, BridgeExecutionResult } from './types';

export class BridgeService {
  private jevClient: JevClient;
  private adapter: SemanticAdapter;

  private readonly EXECUTION_THRESHOLD = 0.85;
  private readonly AMBIGUITY_THRESHOLD = 0.60;

  constructor(jevClient: JevClient, adapter: SemanticAdapter) {
    this.jevClient = jevClient;
    this.adapter = adapter;
  }

  /**
   * Allows dynamically switching semantic layer targets (Cube, dbt, Looker, etc.)
   */
  public setAdapter(adapter: SemanticAdapter): void {
    this.adapter = adapter;
  }

  public async processQuery(userPrompt: string, context: ExecutionContext): Promise<BridgeExecutionResult> {
    const inference = await this.jevClient.classify(userPrompt);
    const query = inference.extractedQuery;

    // Gate 1: High Confidence -> Immediate Execution
    if (inference.confidence >= this.EXECUTION_THRESHOLD) {
      const data = await this.adapter.execute(query, context);
      return { status: 'SUCCESS', data, query };
    }

    // Gate 2: Medium Confidence -> Request Disambiguation
    if (inference.confidence >= this.AMBIGUITY_THRESHOLD) {
      return {
        status: 'DISAMBIGUATION_REQUIRED',
        confidence: inference.confidence,
        proposedQuery: query,
        message: `I inferred metric(s): [${query.metrics.join(', ')}] grouped by [${query.dimensions.join(', ')}]. Please confirm to execute.`
      };
    }

    // Gate 3: Low Confidence -> Reject
    return {
      status: 'REJECTED',
      confidence: inference.confidence,
      reason: 'The intent could not be mapped to governed metrics. Please rephrase your question.'
    };
  }
}
