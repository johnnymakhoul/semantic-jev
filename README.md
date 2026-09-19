# semantic-jev

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeSafe](https://img.shields.io/badge/Powered%20By-TypeSafe%20AI-orange.svg)](https://typesafe.ai)
[![Cube](https://img.shields.io/badge/Semantic%20Layer-Cube-purple.svg)](https://cube.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Universal Natural Language to Semantic Layer Bridge powered by Jev (TypeSafe System One).**

Convert unstructured user inquiries into certified, governed metric queries executed safely against any semantic layer—with **calibrated confidence gating**, **zero SQL hallucinations**, and **real-time latency tracking**.

---

## Why `semantic-jev`?

Unconstrained LLM Text-to-SQL approaches are notoriously brittle in production:
* **Hallucinated joins and columns** that corrupt financial or business metrics.
* **Schema drift & performance risks**, generating runaway Cartesian product queries.
* **Bypassed access controls**, ignoring row-level and role-based security policies.

`semantic-jev` solves this by routing natural language through a **governed semantic model**:

```text
                           +---------------------------+
                           |  Natural Language Prompt  |
                           +---------------------------+
                                         │
                                         ▼
                           +---------------------------+
                           |   Jev System One Engine   |
                           | (Intent & Slot Extraction)|
                           +---------------------------+
                                         │
                                         ▼
                     +───────────────────────────────────────+
                     │     Deterministic Confidence Gate     │
                     +───────────────────────────────────────+
                     │  ≥ 0.85 ──► Direct Execution          │
                     │  0.60–0.84 ► Disambiguation Loop      │
                     │  < 0.60 ──► Safe Deterministic Reject │
                     +───────────────────────────────────────+
                                         │
                                         ▼
                           +---------------------------+
                           |   Canonical Query Model   |
                           |   (Measures, Dims, Dates) |
                           +---------------------------+
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
     +─────────────────────────────+           +─────────────────────────────+
     │     CubeSemanticAdapter     │           │     DbtSemanticAdapter      │
     │      (Cube REST API)        │           │  (MetricFlow GraphQL/REST)  │
     +─────────────────────────────+           +─────────────────────────────+
                    │                                         │
                    ▼                                         ▼
        [Cube Semantic Engine]                     [dbt MetricFlow Engine]
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         ▼
                           +---------------------------+
                           | PostgreSQL / Data Lake    |
                           |     (AdventureWorks)      |
                           +---------------------------+
```

---

## Key Features

- **Zero SQL Hallucination:** Translates intent strictly into bounded measures, dimensions, and filters defined by your data catalog.
- **Calibrated Confidence Gating:**
  - **High Confidence ($\ge 0.85$):** Immediate certified query execution.
  - **Medium Confidence ($0.60 - 0.84$):** Interactive disambiguation/confirmation before touching warehouse compute.
  - **Low Confidence ($< 0.60$):** Instant rejection with actionable feedback.
- **Pluggable Semantic Adapter Architecture:** Unified interface with out-of-the-box adapters for **Cube** and **dbt Semantic Layer (MetricFlow)**, and extensible to Looker or Snowflake Cortex.
- **Real-Time Latency Breakdown:** Tracks analysis time, semantic engine execution time, and total round-trip latency.
- **Turnkey Sample Environment:** Includes Docker Compose configuration with **PostgreSQL + AdventureWorks** and pre-compiled Cube data models.
- **Multi-Tenant Context Propagation:** Injects `tenantId`, `userId`, and `role` into every downstream semantic request to enforce Row-Level Security (RLS).
- **Dynamic Data Catalog:** Auto-introspects Cube metadata or loads custom measures/dimensions from `catalog.json`

---

## Quickstart

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)
* [Docker & Docker Compose](https://docs.docker.com/compose/)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/semantic-jev.git
cd semantic-jev
npm install
```

### 2. Environment Setup

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```ini
# TypeSafe / Jev API Credentials
JEV_API_KEY=your_jev_api_key_here
JEV_API_URL=https://api.typesafe.ai

# Semantic Layer Providers
CUBEJS_API_URL=http://localhost:4000
CUBEJS_API_TOKEN=your_cube_api_token

# Optional: dbt Semantic Layer (MetricFlow)
DBT_ENVIRONMENT_ID=your_dbt_env_id
DBT_SERVICE_TOKEN=your_dbt_service_token
```

### 3. Start the AdventureWorks + Cube Environment

Launch the bundled PostgreSQL database and Cube semantic layer:

```bash
docker compose up -d
```

Verify services:
* **PostgreSQL (AdventureWorks)**: `localhost:5432` (`postgres:postgres`, DB: `postgres`)
* **Cube API Server & Playground**: [http://localhost:4000](http://localhost:4000)

---

## CLI Usage

`semantic-jev` comes with an interactive REPL and a one-shot CLI.

### One-Shot Queries

Ask questions directly from your terminal:

```bash
# Auto-confirm and execute:
npm run cli -- -y "What is the total sales by territory group?"

# Product breakdown:
npm run cli -- -y "How many products do we have by color?"

# Output raw JSON with timing metrics:
npm run cli -- --json -y "What is our total sales?"
```

**Example Output:**
```text
Analyzing prompt: "What is the total sales by territory group?"...
? [DISAMBIGUATION REQUIRED] Confidence: 0.73 | Analysis time: 940ms
I inferred metric(s): [total_sales] grouped by [territory_group]. Please confirm to execute.
Proposed Canonical Query: {
  "metrics": [
    "total_sales"
  ],
  "dimensions": [
    "territory_group"
  ],
  "timeDimensions": [],
  "filters": []
}
ℹ Auto-confirming execution (--yes flag active)...
Executing confirmed query against Cube...
✔ Execution completed in 56ms! (Total round-trip: 996ms) Rows returned (3):
┌─────────┬──────────────────────────────────┬─────────────────────────┐
│ (index) │ SalesTerritories.territory_group │ SalesOrders.total_sales │
├─────────┼──────────────────────────────────┼─────────────────────────┤
│ 0       │ 'North America'                  │ '89228792.3910'         │
│ 1       │ 'Europe'                         │ '22173617.6297'         │
│ 2       │ 'Pacific'                        │ '11814376.0952'         │
└─────────┴──────────────────────────────────┴─────────────────────────┘
```

### Interactive REPL

Start the interactive session:

```bash
npm run cli
```

Available REPL commands:
* `/catalog` - Inspect all active measures and dimensions.
* `/sync` - Dynamically synchronize the catalog by introspecting the live Cube schema.
* `/provider <cube|dbt>` - Switch the active semantic layer on the fly.
* `/help` - Show CLI command options.
* `/exit` - Exit the CLI.

---

## 🛠 Project Architecture

```text
semantic-jev/
├── catalog.json              # Active semantic catalog (measures, dimensions, timeDimensions)
├── docker-compose.yml        # PostgreSQL (AdventureWorks) + Cube container stack
├── cube/
│   └── model/cubes/          # Cube semantic data models
│       ├── SalesOrders.yml
│       ├── SalesTerritories.yml
│       ├── Products.yml
│       └── Customers.yml
├── src/
│   ├── index.ts              # Library entry point & multi-provider demonstration
│   ├── cli.ts                # Interactive CLI & REPL engine
│   ├── types.ts              # Zod schemas & canonical query interfaces
│   ├── catalog.ts            # Dynamic catalog loader & Cube metadata converter
│   ├── bridgeService.ts      # Core orchestration & confidence gating service
│   ├── jevClient.ts          # TypeSafe System One (Jev) inference client
│   └── adapters/
│       ├── base.ts           # SemanticAdapter interface contract
│       ├── cubeAdapter.ts    # Production Cube REST API adapter
│       └── dbtAdapter.ts     # dbt MetricFlow GraphQL/REST adapter
└── test/
    └── bridge.test.ts        # Automated integration test suite
```

---

## 📖 Programmatic API Usage

Use `semantic-jev` as a microservice library within your backend:

```typescript
import {
  BridgeService,
  JevClient,
  CubeSemanticAdapter,
  loadCatalogFromFile,
  ExecutionContext
} from 'semantic-jev';

// 1. Initialize components
const catalog = loadCatalogFromFile('./catalog.json');
const jev = new JevClient(process.env.JEV_API_URL, process.env.JEV_API_KEY, catalog);
const adapter = new CubeSemanticAdapter(process.env.CUBEJS_API_URL, process.env.CUBEJS_API_TOKEN, catalog);
const bridge = new BridgeService(jev, adapter);

// 2. Define user security context
const context: ExecutionContext = {
  tenantId: 'tenant_enterprise_01',
  userId: 'analyst_42',
  role: 'data_consumer'
};

// 3. Process natural language query
const result = await bridge.processQuery('What is the total sales by territory group?', context);

if (result.status === 'SUCCESS') {
  console.log('Query executed successfully:', result.data.rows);
} else if (result.status === 'DISAMBIGUATION_REQUIRED') {
  console.log(`Requires confirmation (${result.confidence}):`, result.message);
  // Re-submit result.proposedQuery after user confirms:
  const data = await adapter.execute(result.proposedQuery, context);
  console.log('Executed confirmed query:', data.rows);
} else {
  console.log('Query rejected safely:', result.reason);
}
```

---

## Extending with Custom Semantic Adapters

To connect an additional semantic layer (e.g. **Looker**, **Snowflake Cortex Analyst**, **AtScale**), simply implement the `SemanticAdapter` interface:

```typescript
import { SemanticAdapter } from './adapters/base';
import { CanonicalQuery, ExecutionContext, StandardExecutionResult } from './types';

export class LookerSemanticAdapter implements SemanticAdapter {
  readonly providerName = 'Looker';

  async execute(query: CanonicalQuery, context: ExecutionContext): Promise<StandardExecutionResult> {
    // 1. Translate canonical measures/dimensions to LookML explore fields
    // 2. Dispatch to Looker REST API: POST /api/4.0/queries/run/json
    // 3. Return standardized result
    return {
      provider: this.providerName,
      columns: ['region', 'total_sales'],
      rows: []
    };
  }
}
```

Switch adapters at runtime with:

```typescript
bridge.setAdapter(new LookerSemanticAdapter());
```

---

## Testing

Run the automated integration test suite:

```bash
npm test
```

Run the multi-provider demo:

```bash
npm start
```

---

## License

This project is licensed under the MIT License