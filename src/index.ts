import 'dotenv/config';
import { JevClient } from './jevClient';
import { CubeSemanticAdapter } from './adapters/cubeAdapter';
import { DbtSemanticAdapter } from './adapters/dbtAdapter';
import { BridgeService } from './bridgeService';
import { ExecutionContext } from './types';

export * from './types';
export * from './adapters/base';
export * from './adapters/cubeAdapter';
export * from './adapters/dbtAdapter';
export * from './jevClient';
export * from './bridgeService';
export * from './catalog';

export async function main() {
  const jev = new JevClient();
  const cubeAdapter = new CubeSemanticAdapter();
  const dbtAdapter = new DbtSemanticAdapter();

  const bridge = new BridgeService(jev, cubeAdapter);

  const context: ExecutionContext = {
    tenantId: 'tenant_enterprise_01',
    userId: 'analyst_42',
    role: 'data_consumer'
  };

  const testPrompts = [
    'What was our monthly revenue in EMEA this year?',
    'Show me active customers by tier',
    'What is the stock forecast for tomorrow?'
  ];

  console.log('===============================================================');
  console.log('1. RUNNING WITH CUBE SEMANTIC LAYER');
  console.log('===============================================================');

  for (const prompt of testPrompts) {
    console.log(`\nPrompt: "${prompt}"`);
    const result = await bridge.processQuery(prompt, context);

    if (result.status === 'SUCCESS') {
      console.log(`[${result.data.provider}] Success! Rows returned:`, result.data.rows);
    } else if (result.status === 'DISAMBIGUATION_REQUIRED') {
      console.log(`[Disambiguation Required] Confidence: ${result.confidence} -> ${result.message}`);
      console.log(`  -> User confirms: Executing confirmed query against Cube / SAMODb...`);
      const confirmedData = await cubeAdapter.execute(result.proposedQuery, context);
      console.log(`  -> [${confirmedData.provider}] Certified execution completed! Rows returned:`, confirmedData.rows);
    } else {
      console.log(`[Rejected] Confidence: ${result.confidence} -> ${result.reason}`);
    }
  }

  console.log('\n===============================================================');
  console.log('2. SWITCHING TO DBT SEMANTIC LAYER (METRICFLOW)');
  console.log('===============================================================');

  bridge.setAdapter(dbtAdapter);

  const dbtResult = await bridge.processQuery('What was our monthly revenue in EMEA this year?', context);
  if (dbtResult.status === 'SUCCESS') {
    console.log(`[${dbtResult.data.provider}] Success! Rows returned:`, dbtResult.data.rows);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
