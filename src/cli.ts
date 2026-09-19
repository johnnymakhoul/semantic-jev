#!/usr/bin/env node
import 'dotenv/config';
import * as readline from 'node:readline';
import { JevClient } from './jevClient';
import { CubeSemanticAdapter } from './adapters/cubeAdapter';
import { DbtSemanticAdapter } from './adapters/dbtAdapter';
import { BridgeService } from './bridgeService';
import { ExecutionContext, SemanticCatalog } from './types';
import { SemanticAdapter } from './adapters/base';
import { loadCatalogFromFile } from './catalog';

interface CliOptions {
  provider: 'cube' | 'dbt';
  tenantId: string;
  userId: string;
  role: string;
  json: boolean;
  confirm: boolean;
  catalogPath?: string;
  query?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    provider: 'cube',
    tenantId: 'tenant_enterprise_01',
    userId: 'analyst_42',
    role: 'data_consumer',
    json: false,
    confirm: false
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--provider' || arg === '-p') {
      options.provider = (args[++i] || 'cube').toLowerCase() as 'cube' | 'dbt';
    } else if (arg === '--tenant' || arg === '-t') {
      options.tenantId = args[++i] || options.tenantId;
    } else if (arg === '--user' || arg === '-u') {
      options.userId = args[++i] || options.userId;
    } else if (arg === '--role' || arg === '-r') {
      options.role = args[++i] || options.role;
    } else if (arg === '--catalog' || arg === '-c') {
      options.catalogPath = args[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--yes' || arg === '-y' || arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    options.query = positional.join(' ');
  }

  return options;
}

function printHelp() {
  console.log(`
Jev Universal Semantic Bridge CLI (semantic-jev)

USAGE:
  semantic-jev [options] ["natural language inquiry"]
  npm run cli -- [options] ["natural language inquiry"]

OPTIONS:
  -p, --provider <cube|dbt>   Semantic layer provider (default: cube)
  -c, --catalog <file.json>   Path to custom semantic catalog JSON definition
  -y, --yes                   Auto-confirm disambiguation prompts
  -t, --tenant <tenantId>     Tenant ID for row-level security (default: tenant_enterprise_01)
  -u, --user <userId>         User ID making the inquiry (default: analyst_42)
  -r, --role <role>           User role for permissions (default: data_consumer)
  --json                      Output raw JSON results
  -h, --help                  Show this help message

EXAMPLES:
  # One-shot query against local Cube (SAMODb)
  npm run cli -- "How many feedbacks do we have by document type?"

  # Using a custom data catalog definition
  npm run cli -- --catalog ./catalog.json "Show me active customers by tier"

  # Auto-confirm disambiguation loop
  npm run cli -- -y "How many videos are there?"

  # Start interactive REPL with live /sync and /catalog inspection
  npm run cli
`);
}

function createAdapters(catalog: SemanticCatalog): { cube: CubeSemanticAdapter; dbt: DbtSemanticAdapter } {
  return {
    cube: new CubeSemanticAdapter(undefined, undefined, catalog),
    dbt: new DbtSemanticAdapter()
  };
}

async function executeQuery(
  bridge: BridgeService,
  adapter: SemanticAdapter,
  prompt: string,
  context: ExecutionContext,
  json: boolean,
  confirm = false,
  rl?: readline.Interface
): Promise<void> {
  if (!json) {
    console.log(`\nAnalyzing prompt: "${prompt}"...`);
  }

  const result = await bridge.processQuery(prompt, context);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.status === 'SUCCESS') {
    console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m Confidence: High | Target Provider: ${result.data.provider}`);
    console.log(`Inferred Query:`, JSON.stringify(result.query, null, 2));
    console.log(`\nExecution Results (${result.data.rows.length} rows):`);
    if (result.data.rows.length > 0) {
      console.table(result.data.rows);
    } else {
      console.log('No rows returned.');
    }
  } else if (result.status === 'DISAMBIGUATION_REQUIRED') {
    console.log(`\x1b[33m? [DISAMBIGUATION REQUIRED]\x1b[0m Confidence: ${result.confidence}`);
    console.log(result.message);
    console.log(`Proposed Canonical Query:`, JSON.stringify(result.proposedQuery, null, 2));

    let shouldExecute = false;
    if (confirm) {
      console.log(`\x1b[36mℹ Auto-confirming execution (--yes flag active)...\x1b[0m`);
      shouldExecute = true;
    } else {
      const activeRl = rl || readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await askQuestion(activeRl, `Execute proposed query against ${adapter.providerName}? (y/N): `);
      if (!rl) activeRl.close();
      shouldExecute = answer.toLowerCase().startsWith('y');
    }

    if (shouldExecute) {
      console.log(`Executing confirmed query against ${adapter.providerName}...`);
      const data = await adapter.execute(result.proposedQuery, context);
      console.log(`\x1b[32m✔ Execution completed!\x1b[0m Rows returned (${data.rows.length}):`);
      if (data.rows.length > 0) {
        console.table(data.rows);
      } else {
        console.log('No rows returned.');
      }
    } else {
      console.log('Execution cancelled.');
    }
  } else {
    console.log(`\x1b[31m✖ [REJECTED]\x1b[0m Confidence: ${result.confidence}`);
    console.log(`Reason: ${result.reason}`);
  }
}

function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function runRepl(
  bridge: BridgeService,
  jev: JevClient,
  adapters: { cube: CubeSemanticAdapter; dbt: DbtSemanticAdapter },
  options: CliOptions
) {
  let currentProvider = options.provider;
  let currentAdapter: SemanticAdapter = currentProvider === 'cube' ? adapters.cube : adapters.dbt;
  bridge.setAdapter(currentAdapter);

  const context: ExecutionContext = {
    tenantId: options.tenantId,
    userId: options.userId,
    role: options.role
  };

  console.log(`===============================================================`);
  console.log(`  Jev Universal Semantic Bridge Interactive CLI`);
  console.log(`  Active Provider: \x1b[36m${currentAdapter.providerName}\x1b[0m | Tenant: ${context.tenantId} | Role: ${context.role}`);
  console.log(`  Commands: /sync, /catalog, /provider <cube|dbt>, /help, /exit`);
  console.log(`===============================================================`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptUser = () => {
    rl.question(`\nsemantic-jev [${currentProvider}]> `, async input => {
      const line = input.trim();
      if (!line) {
        promptUser();
        return;
      }

      if (line === '/exit' || line === 'exit' || line === 'quit') {
        rl.close();
        return;
      }

      if (line.startsWith('/provider')) {
        const p = line.split(/\s+/)[1]?.toLowerCase();
        if (p === 'cube' || p === 'dbt') {
          currentProvider = p;
          currentAdapter = p === 'cube' ? adapters.cube : adapters.dbt;
          bridge.setAdapter(currentAdapter);
          console.log(`Switched provider to: \x1b[36m${currentAdapter.providerName}\x1b[0m`);
        } else {
          console.log('Usage: /provider <cube|dbt>');
        }
        promptUser();
        return;
      }

      if (line === '/sync') {
        console.log(`Syncing semantic catalog with ${currentAdapter.providerName}...`);
        const synced = await bridge.syncCatalogWithAdapter();
        console.log(`\x1b[32m✔ Catalog synchronized!\x1b[0m Active catalog now has ${synced.measures.length} measures and ${synced.dimensions.length} dimensions.`);
        promptUser();
        return;
      }

      if (line === '/catalog') {
        const cat = jev.getCatalog();
        console.log(`\nActive Semantic Catalog:`);
        console.log(`\n--- Measures (${cat.measures.length}) ---`);
        cat.measures.forEach(m => console.log(`  • \x1b[36m${m.id}\x1b[0m -> ${m.member}\n    "${m.description}"`));
        console.log(`\n--- Dimensions (${cat.dimensions.length}) ---`);
        cat.dimensions.forEach(d => console.log(`  • \x1b[35m${d.id}\x1b[0m -> ${d.member}\n    "${d.description}"`));
        promptUser();
        return;
      }

      if (line === '/help') {
        printHelp();
        promptUser();
        return;
      }

      try {
        await executeQuery(bridge, currentAdapter, line, context, false, false, rl);
      } catch (err) {
        console.error('Execution Error:', (err as Error).message);
      }

      promptUser();
    });
  };

  promptUser();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = loadCatalogFromFile(options.catalogPath);
  const jev = new JevClient(undefined, undefined, catalog);
  const adapters = createAdapters(catalog);
  const activeAdapter = options.provider === 'cube' ? adapters.cube : adapters.dbt;
  const bridge = new BridgeService(jev, activeAdapter);

  const context: ExecutionContext = {
    tenantId: options.tenantId,
    userId: options.userId,
    role: options.role
  };

  if (options.query) {
    // One-shot mode
    await executeQuery(bridge, activeAdapter, options.query, context, options.json, options.confirm);
  } else {
    // Interactive mode
    await runRepl(bridge, jev, adapters, options);
  }
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
