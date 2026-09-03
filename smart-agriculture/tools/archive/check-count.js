// 检查执行器数量是否正确
const mysql = require('mysql2/promise');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function check() {
  console.log('=== 检查执行器数量 ===\n');
  
  // 加载环境变量
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
  }
  
  // 1. 数据库查询
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture'
  });
  
  console.log('--- 数据库统计 ---');
  
  // 执行器总数
  const [countRows] = await connection.execute('SELECT COUNT(*) as total FROM actuators');
  console.log(`执行器总数: ${countRows[0].total}`);
  
  // 按区域统计
  const [areaRows] = await connection.execute(`
    SELECT COALESCE(a.area, '未分组') as area, COUNT(*) as count 
    FROM actuators a 
    GROUP BY a.area 
    ORDER BY a.area
  `);
  console.log('\n按区域分组:');
  for (const row of areaRows) {
    console.log(`  ${row.area}: ${row.count}个`);
  }
  
  // 按类型统计
  const [typeRows] = await connection.execute(`
    SELECT at.type, at.name as type_name, COUNT(*) as count 
    FROM actuators a 
    INNER JOIN actuator_types at ON a.type_id = at.id 
    GROUP BY at.type, at.name 
    ORDER BY at.type
  `);
  console.log('\n按类型分组:');
  for (const row of typeRows) {
    console.log(`  ${row.type} (${row.type_name}): ${row.count}个`);
  }
  
  // 在线状态统计
  const [statusRows] = await connection.execute(`
    SELECT 
      status,
      COUNT(*) as count,
      SUM(CASE WHEN last_update IS NOT NULL AND TIMESTAMPDIFF(MINUTE, last_update, NOW()) <= 5 THEN 1 ELSE 0 END) as online_recent
    FROM actuators 
    GROUP BY status
  `);
  console.log('\n在线状态统计:');
  for (const row of statusRows) {
    console.log(`  ${row.status}: ${row.count}个 (5分钟内更新: ${row.online_recent}个)`);
  }
  
  // 2. API查询
  console.log('\n--- API返回统计 ---');
  const apiResult = await sendRequest('/api/actuators', 'GET');
  console.log(`API返回执行器数: ${apiResult.data.length}`);
  
  // 按区域统计API返回
  const apiByArea = {};
  for (const act of apiResult.data) {
    const area = act.area || '未分组';
    if (!apiByArea[area]) apiByArea[area] = [];
    apiByArea[area].push(act);
  }
  console.log('\nAPI按区域分组:');
  for (const [area, actuators] of Object.entries(apiByArea)) {
    console.log(`  ${area}: ${actuators.length}个`);
  }
  
  // 按类型统计API返回
  const apiByType = {};
  for (const act of apiResult.data) {
    if (!apiByType[act.type]) apiByType[act.type] = 0;
    apiByType[act.type]++;
  }
  console.log('\nAPI按类型分组:');
  for (const [type, count] of Object.entries(apiByType)) {
    console.log(`  ${type}: ${count}个`);
  }
  
  // 3. 对比差异
  console.log('\n--- 数量对比 ---');
  const dbTotal = countRows[0].total;
  const apiTotal = apiResult.data.length;
  if (dbTotal === apiTotal) {
    console.log(`✅ 数量一致: 数据库 ${dbTotal} = API ${apiTotal}`);
  } else {
    console.log(`❌ 数量不一致: 数据库 ${dbTotal} ≠ API ${apiTotal}`);
    
    // 找出差异
    console.log('\n数据库中的执行器:');
    const [dbIds] = await connection.execute('SELECT id FROM actuators ORDER BY id');
    const dbIdSet = new Set(dbIds.map(r => r.id));
    dbIds.forEach(r => console.log(`  ${r.id}`));
    
    console.log('\nAPI返回的执行器:');
    const apiIdSet = new Set(apiResult.data.map(a => a.id));
    apiResult.data.forEach(a => console.log(`  ${a.id}`));
    
    console.log('\n差异:');
    for (const id of dbIdSet) {
      if (!apiIdSet.has(id)) console.log(`  数据库有但API没有: ${id}`);
    }
    for (const id of apiIdSet) {
      if (!dbIdSet.has(id)) console.log(`  API有但数据库没有: ${id}`);
    }
  }
  
  await connection.end();
  console.log('\n=== 检查完成 ===');
}

function sendRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch (e) { resolve(data); }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

check().catch(console.error);