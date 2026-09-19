import 'dotenv/config';
import assert from 'node:assert';
import { JevClient } from '../src/jevClient';
import { CubeSemanticAdapter } from '../src/adapters/cubeAdapter';
import { DbtSemanticAdapter } from '../src/adapters/dbtAdapter';
import { BridgeService } from '../src/bridgeService';
import { CanonicalQuerySchema, ExecutionContext } from '../src/types';

async function runTests() {
  console.log('Running semantic-jev test suite...\n');

  const context: ExecutionContext = {
    tenantId: 'test_tenant',
    userId: 'test_user',
    role: 'admin'
  };

  // 1. Test Schema Validation
  console.log('1. Testing CanonicalQuerySchema validation...');
  const validQuery = {
    metrics: ['total_revenue'],
    dimensions: ['customer__region'],
    filters: [
      { field: 'customer__region', operator: 'equals', values: ['EMEA'] }
    ],
    timeDimensions: [
      { field: 'order_date', granularity: 'month', dateRange: 'This year' }
    ]
  };
  const parsed = CanonicalQuerySchema.parse(validQuery);
  assert.strictEqual(parsed.metrics[0], 'total_revenue');
  assert.strictEqual(parsed.filters[0].operator, 'equals');
  console.log('   ✓ Schema validation passed');

  // 2. Test JevClient Classification
  console.log('2. Testing JevClient classification...');
  const jev = new JevClient();
  const highConf = await jev.classify('What was our monthly revenue in EMEA this year?');
  assert(highConf.confidence >= 0.85, 'Revenue prompt should have >= 0.85 confidence');
  assert.strictEqual(highConf.intent, 'query_metric');
  assert.deepStrictEqual(highConf.extractedQuery.metrics, ['total_revenue']);

  const medConf = await jev.classify('Show me active customers by tier');
  assert(medConf.confidence >= 0.60 && medConf.confidence < 0.85, 'Customers prompt should have medium confidence');
  assert.strictEqual(medConf.intent, 'query_metric');

  const lowConf = await jev.classify('What is the stock forecast for tomorrow?');
  assert(lowConf.confidence < 0.60, 'Unsupported prompt should have < 0.60 confidence');
  assert.strictEqual(lowConf.intent, 'unsupported');
  console.log('   ✓ JevClient classifications passed');

  // 3. Test Adapters Standalone Mock Execution
  console.log('3. Testing Cube and dbt adapters...');
  const cube = new CubeSemanticAdapter();
  const cubeRes = await cube.execute(parsed, context);
  assert.strictEqual(cubeRes.provider, 'Cube');
  assert(cubeRes.rows.length > 0, 'Cube should return mock rows');
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

  // Gate 1: High confidence -> SUCCESS
  const resSuccess = await bridge.processQuery('What was our monthly revenue in EMEA this year?', context);
  assert.strictEqual(resSuccess.status, 'SUCCESS');
  if (resSuccess.status === 'SUCCESS') {
    assert.strictEqual(resSuccess.data.provider, 'Cube');
    assert(resSuccess.data.rows.length > 0);
  }

  // Gate 2: Medium confidence -> DISAMBIGUATION_REQUIRED
  const resDisambiguation = await bridge.processQuery('Show me active customers by tier', context);
  assert.strictEqual(resDisambiguation.status, 'DISAMBIGUATION_REQUIRED');
  if (resDisambiguation.status === 'DISAMBIGUATION_REQUIRED') {
    assert(resDisambiguation.message.includes('active_users_count'));
  }

  // Gate 3: Low confidence -> REJECTED
  const resRejected = await bridge.processQuery('What is the stock forecast for tomorrow?', context);
  assert.strictEqual(resRejected.status, 'REJECTED');
  if (resRejected.status === 'REJECTED') {
    assert(resRejected.reason.length > 0);
  }

  // 5. Test Adapter Switching
  console.log('5. Testing Adapter switching...');
  bridge.setAdapter(dbt);
  const resDbt = await bridge.processQuery('What was our monthly revenue in EMEA this year?', context);
  assert.strictEqual(resDbt.status, 'SUCCESS');
  if (resDbt.status === 'SUCCESS') {
    assert.strictEqual(resDbt.data.provider, 'dbt-MetricFlow');
  }
  console.log('   ✓ Adapter switching passed');

  console.log('\nAll tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
