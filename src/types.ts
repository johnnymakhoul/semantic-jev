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

export const CatalogMeasureSchema = z.object({
  id: z.string(),
  member: z.string(),
  description: z.string()
});

export const CatalogDimensionSchema = z.object({
  id: z.string(),
  member: z.string(),
  description: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'time']).optional()
});

export const CatalogTimeDimensionSchema = z.object({
  id: z.string(),
  member: z.string(),
  description: z.string(),
  defaultGranularity: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional()
});

export const SemanticCatalogSchema = z.object({
  measures: z.array(CatalogMeasureSchema),
  dimensions: z.array(CatalogDimensionSchema),
  timeDimensions: z.array(CatalogTimeDimensionSchema).optional().default([])
});

export type CatalogMeasure = z.infer<typeof CatalogMeasureSchema>;
export type CatalogDimension = z.infer<typeof CatalogDimensionSchema>;
export type CatalogTimeDimension = z.infer<typeof CatalogTimeDimensionSchema>;
export type SemanticCatalog = z.infer<typeof SemanticCatalogSchema>;
