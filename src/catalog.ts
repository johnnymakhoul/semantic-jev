import * as fs from 'node:fs';
import * as path from 'node:path';
import { SemanticCatalog, SemanticCatalogSchema } from './types';

export const DEFAULT_CATALOG: SemanticCatalog = {
  measures: [
    {
      id: 'feedbacks_count',
      member: 'Feedbacks.count',
      description: 'Total count of user feedback submissions or complaint tickets'
    },
    {
      id: 'total_escalations',
      member: 'Feedbacks.total_escalations',
      description: 'Total count or sum of ticket escalations'
    },
    {
      id: 'contact_us_count',
      member: 'ContactUs.count',
      description: 'Total count of Contact Us inquiries and messages'
    },
    {
      id: 'videos_count',
      member: 'Videos.count',
      description: 'Total count of uploaded or available videos'
    },
    {
      id: 'active_videos_count',
      member: 'Videos.active_count',
      description: 'Count of published, active videos'
    },
    {
      id: 'active_users_count',
      member: 'Users.active_users_count',
      description: 'Count of active, non-deleted user accounts'
    },
    {
      id: 'total_revenue',
      member: 'Orders.total_revenue',
      description: 'Total sales revenue, monetary turnover, or gross income'
    }
  ],
  dimensions: [
    {
      id: 'document_type_code',
      member: 'Feedbacks.document_type_code',
      description: 'Classification document type code (e.g., FBK, CPT, CPM, CTU)',
      type: 'string'
    },
    {
      id: 'user_plan_tier',
      member: 'Users.user_plan_tier',
      description: 'User or customer account tier or category (e.g., Staff, User)',
      type: 'string'
    },
    {
      id: 'customer__region',
      member: 'Customers.region',
      description: 'Geographical customer region (e.g., EMEA, APAC, NA)',
      type: 'string'
    },
    {
      id: 'video_title',
      member: 'Videos.title',
      description: 'Title or name of the video',
      type: 'string'
    },
    {
      id: 'is_active',
      member: 'Videos.is_active',
      description: 'Active status boolean flag',
      type: 'boolean'
    }
  ],
  timeDimensions: [
    {
      id: 'order_date',
      member: 'Orders.createdAt',
      description: 'Timestamp when the order was created'
    },
    {
      id: 'created_on',
      member: 'Feedbacks.created_on',
      description: 'Timestamp when the feedback or inquiry was submitted'
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
