import { CanonicalQuery, ExecutionContext, StandardExecutionResult, SemanticCatalog } from '../types';

/**
 * Universal interface for connecting any semantic layer.
 */
export interface SemanticAdapter {
  readonly providerName: string;

  /**
   * Translates canonical metrics and dimensions into provider-specific queries and executes them.
   */
  execute(query: CanonicalQuery, context: ExecutionContext): Promise<StandardExecutionResult>;

  /**
   * Optional method to discover or export available semantic catalog metadata.
   */
  getCatalog?(): Promise<SemanticCatalog>;
}

