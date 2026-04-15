// 数据库连接池性能测试脚本
import { db } from './lib/db.js';

async function testDatabasePerformance() {
  console.log('=== 数据库性能测试开始 ===');
  
  // 测试连接池预热
  console.log('1. 测试连接池预热...');
  const startWarmup = Date.now();
  await db.testConnection();
  const warmupTime = Date.now() - startWarmup;
  console.log(`   连接池预热时间: ${warmupTime}ms`);
  
  // 测试并发查询
  console.log('2. 测试并发查询...');
  const concurrentTests = 10;
  const testPromises = [];
  
  const startConcurrent = Date.now();
  for (let i = 0; i < concurrentTests; i++) {
    testPromises.push(
      db.query('SELECT 1 + ? as result', [i])
    );
  }
  
  await Promise.all(testPromises);
  const concurrentTime = Date.now() - startConcurrent;
  console.log(`   ${concurrentTests}个并发查询时间: ${concurrentTime}ms`);
  
  // 测试传感器数据插入
  console.log('3. 测试传感器数据插入...');
  const startInsert = Date.now();
  
  for (let i = 0; i < 5; i++) {
    await db.execute(
      'INSERT INTO sensor_data (sensor_id, value) VALUES (?, ?)',
      ['T-001', Math.random() * 100]
    );
  }
  
  const insertTime = Date.now() - startInsert;
  console.log(`   5条数据插入时间: ${insertTime}ms`);
  
  // 测试传感器数据查询
  console.log('4. 测试传感器数据查询...');
  const startQuery = Date.now();
  const data = await db.query('SELECT * FROM sensor_data WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 10', ['T-001']);
  const queryTime = Date.now() - startQuery;
  console.log(`   查询10条数据时间: ${queryTime}ms`);
  console.log(`   数据量: ${data.length}条`);
  
  console.log('=== 数据库性能测试完成 ===');
}

testDatabasePerformance().catch(console.error).finally(() => process.exit());