import { CanonicalQuery, ExecutionContext, StandardExecutionResult } from '../types';

/**
 * Universal interface for connecting any semantic layer.
 */
export interface SemanticAdapter {
  readonly providerName: string;

  /**
   * Translates canonical metrics and dimensions into provider-specific queries and executes them.
   */
  execute(query: CanonicalQuery, context: ExecutionContext): Promise<StandardExecutionResult>;
}
