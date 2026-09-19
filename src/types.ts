import { z } from 'zod';

export const FilterOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'gt',
  'gte',
  'lt',
  'lte'
]);

export const CanonicalFilterSchema = z.object({
  field: z.string(),
  operator: FilterOperatorSchema,
  values: z.array(z.string())
});

export const CanonicalTimeDimensionSchema = z.object({
  field: z.string(),
  granularity: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  dateRange: z.string()
});

export const CanonicalQuerySchema = z.object({
  metrics: z.array(z.string()),
  dimensions: z.array(z.string()).default([]),
  filters: z.array(CanonicalFilterSchema).default([]),
  timeDimensions: z.array(CanonicalTimeDimensionSchema).default([]),
  limit: z.number().optional()
});

export type CanonicalQuery = z.infer<typeof CanonicalQuerySchema>;
export type CanonicalFilter = z.infer<typeof CanonicalFilterSchema>;
export type CanonicalTimeDimension = z.infer<typeof CanonicalTimeDimensionSchema>;

export interface ExecutionContext {
  tenantId: string;
  userId: string;
  role: string;
}

export interface StandardResultRow {
  [key: string]: any;
}

export interface StandardExecutionResult {
  provider: string;
  columns: string[];
  rows: StandardResultRow[];
}

export type BridgeExecutionResult =
  | { status: 'SUCCESS'; data: StandardExecutionResult; query: CanonicalQuery }
  | { status: 'DISAMBIGUATION_REQUIRED'; confidence: number; proposedQuery: CanonicalQuery; message: string }
  | { status: 'REJECTED'; confidence: number; reason: string };
