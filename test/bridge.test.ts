import 'dotenv/config';
import assert from 'node:assert';
import { JevClient } from '../src/jevClient';
import { CubeSemanticAdapter } from '../src/adapters/cubeAdapter';
import { DbtSemanticAdapter } from '../src/adapters/dbtAdapter';
import { BridgeService } from '../src/bridgeService';
import { CanonicalQuerySchema, ExecutionContext } from '../src/types';

async function runTests() {
  console.log('Running semantic-jev test suite against AdventureWorks...\n');

  const context: ExecutionContext = {
    tenantId: 'test_tenant',
    userId: 'test_user',
    role: 'admin'
  };

  // 1. Test Schema Validation
  console.log('1. Testing CanonicalQuerySchema validation...');
  const validQuery = {
    metrics: ['total_sales'],
    dimensions: ['territory_group'],
    filters: [
      { field: 'territory_group', operator: 'equals', values: ['North America'] }
    ],
    timeDimensions: []
  };
  const parsed = CanonicalQuerySchema.parse(validQuery);
  assert.strictEqual(parsed.metrics[0], 'total_sales');
  assert.strictEqual(parsed.filters[0].operator, 'equals');
  console.log('   ✓ Schema validation passed');

  // 2. Test JevClient Classification
  console.log('2. Testing JevClient classification...');
  const jev = new JevClient();
  const salesConf = await jev.classify('What is the total sales by territory group?');
  assert(salesConf.confidence >= 0.60, 'Sales prompt should have high/medium confidence');
  assert.strictEqual(salesConf.intent, 'query_metric');
  assert.deepStrictEqual(salesConf.extractedQuery.metrics, ['total_sales']);

  const lowConf = await jev.classify('What is the stock forecast for tomorrow?');
  assert(lowConf.confidence < 0.60, 'Unsupported prompt should have < 0.60 confidence');
  assert.strictEqual(lowConf.intent, 'unsupported');
  console.log('   ✓ JevClient classifications passed');

  // 3. Test Adapters Execution
  console.log('3. Testing Cube and dbt adapters...');
  const cube = new CubeSemanticAdapter();
  const cubeRes = await cube.execute(parsed, context);
  assert.strictEqual(cubeRes.provider, 'Cube');
  assert(cubeRes.rows.length > 0, 'Cube should return rows');
  assert(cubeRes.columns.length > 0, 'Cube should return columns');

  const dbt = new DbtSemanticAdapter();
  const dbtRes = await dbt.execute(parsed, context);
  assert.strictEqual(dbtRes.provider, 'dbt-MetricFlow');
  assert(dbtRes.rows.length > 0, 'dbt should return mock rows');
  assert(dbtRes.columns.length > 0, 'dbt should return columns');
  console.log('   ✓ Adapters passed');

  // 4. Test BridgeService Confidence Gates
  console.log('4. Testing BridgeService tiered execution...');
  const bridge = new BridgeService(jev, cube);

  // Test Disambiguation / Success flow
  const resPrompt = await bridge.processQuery('What is the total sales by territory group?', context);
  assert(resPrompt.status === 'SUCCESS' || resPrompt.status === 'DISAMBIGUATION_REQUIRED');
  console.log(`   ✓ Bridge prompt returned status: ${resPrompt.status}`);

  // Test Low confidence -> REJECTED
  const resRejected = await bridge.processQuery('What is the stock forecast for tomorrow?', context);
  assert.strictEqual(resRejected.status, 'REJECTED');
  if (resRejected.status === 'REJECTED') {
    assert(resRejected.reason.length > 0);
  }
  console.log('   ✓ Rejection gate passed');

  // 5. Test Adapter Switching
  console.log('5. Testing Adapter switching...');
  bridge.setAdapter(dbt);
  const resDbt = await bridge.processQuery('What is the total sales by territory group?', context);
  assert(resDbt.status === 'SUCCESS' || resDbt.status === 'DISAMBIGUATION_REQUIRED');
  console.log('   ✓ Adapter switching passed');

  console.log('\nAll tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
