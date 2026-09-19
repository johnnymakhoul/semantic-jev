import * as fs from 'node:fs';
import * as path from 'node:path';
import { SemanticCatalog, SemanticCatalogSchema } from './types';

export const DEFAULT_CATALOG: SemanticCatalog = {
  measures: [
    {
      id: 'total_sales',
      member: 'SalesOrders.total_sales',
      description: 'Total sales revenue, monetary turnover, or gross sales amount'
    },
    {
      id: 'orders_count',
      member: 'SalesOrders.count',
      description: 'Total count of sales orders placed'
    },
    {
      id: 'avg_order_value',
      member: 'SalesOrders.avg_order_value',
      description: 'Average sales order transaction value'
    },
    {
      id: 'tax_amount',
      member: 'SalesOrders.tax_amount',
      description: 'Total sales tax amount'
    },
    {
      id: 'freight_amount',
      member: 'SalesOrders.freight_amount',
      description: 'Total shipping and freight amount'
    },
    {
      id: 'products_count',
      member: 'Products.count',
      description: 'Total count of products in inventory/catalog'
    },
    {
      id: 'avg_product_price',
      member: 'Products.avg_list_price',
      description: 'Average list price of products'
    },
    {
      id: 'customers_count',
      member: 'Customers.count',
      description: 'Total count of registered customers'
    }
  ],
  dimensions: [
    {
      id: 'territory_group',
      member: 'SalesTerritories.territory_group',
      description: 'Geographical territory group or region (e.g., North America, Europe, Pacific)',
      type: 'string'
    },
    {
      id: 'territory_name',
      member: 'SalesTerritories.name',
      description: 'Specific sales territory name (e.g., Northwest, Southwest, United Kingdom, France)',
      type: 'string'
    },
    {
      id: 'country_code',
      member: 'SalesTerritories.country_code',
      description: 'Country code of territory (e.g., US, CA, FR, DE, AU, GB)',
      type: 'string'
    },
    {
      id: 'product_color',
      member: 'Products.color',
      description: 'Color of the product (e.g., Black, Red, Silver, Yellow, Blue)',
      type: 'string'
    },
    {
      id: 'is_online_order',
      member: 'SalesOrders.is_online_order',
      description: 'Flag indicating if the order was placed online or offline',
      type: 'boolean'
    }
  ],
  timeDimensions: [
    {
      id: 'order_date',
      member: 'SalesOrders.order_date',
      description: 'Timestamp or date when the sales order was created'
    }
  ]
};

export function loadCatalogFromFile(filePath?: string): SemanticCatalog {
  const targetPath = filePath
    ? path.resolve(filePath)
    : path.resolve(process.cwd(), 'catalog.json');

  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const parsed = JSON.parse(raw);
      return SemanticCatalogSchema.parse(parsed);
    } catch (err) {
      console.warn(`Failed to parse catalog from ${targetPath}, using defaults: ${(err as Error).message}`);
    }
  }

  return DEFAULT_CATALOG;
}

export function convertCubeMetaToCatalog(cubeMetaCubes: any[]): SemanticCatalog {
  const measures: SemanticCatalog['measures'] = [];
  const dimensions: SemanticCatalog['dimensions'] = [];
  const timeDimensions: NonNullable<SemanticCatalog['timeDimensions']> = [];

  for (const cube of cubeMetaCubes) {
    // Collect measures
    for (const m of cube.measures || []) {
      const simpleId = m.name.replace(/^[A-Za-z0-9_]+\./, '');
      const uniqueId = `${cube.name.toLowerCase()}_${simpleId}`;
      measures.push({
        id: uniqueId,
        member: m.name,
        description: m.description || m.title || `Measure ${m.name} in cube ${cube.name}`
      });
    }

    // Collect dimensions
    for (const d of cube.dimensions || []) {
      const simpleId = d.name.replace(/^[A-Za-z0-9_]+\./, '');
      const uniqueId = `${cube.name.toLowerCase()}_${simpleId}`;
      if (d.type === 'time') {
        timeDimensions.push({
          id: uniqueId,
          member: d.name,
          description: d.description || d.title || `Time dimension ${d.name}`
        });
      } else {
        dimensions.push({
          id: uniqueId,
          member: d.name,
          description: d.description || d.title || `Dimension ${d.name} in cube ${cube.name}`,
          type: (d.type === 'number' || d.type === 'boolean') ? d.type : 'string'
        });
      }
    }
  }

  return { measures, dimensions, timeDimensions };
}
