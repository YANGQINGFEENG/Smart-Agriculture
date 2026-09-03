// Check actuator count details (English output to avoid encoding issues)
const mysql = require('mysql2/promise');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function check() {
  console.log('=== Actuator Count Check ===\n');
  
  // Load env
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
  
  // 1. Database query
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture'
  });
  
  console.log('--- Database ---');
  
  const [allActuators] = await connection.execute(`
    SELECT a.id, a.name, a.status, a.state, a.area, a.last_update, at.type, at.name as type_name
    FROM actuators a 
    INNER JOIN actuator_types at ON a.type_id = at.id 
    ORDER BY a.area, a.id
  `);
  
  console.log(`Total actuators in DB: ${allActuators.length}\n`);
  
  // Group by area
  const byArea = {};
  for (const a of allActuators) {
    const area = a.area || 'ungrouped';
    if (!byArea[area]) byArea[area] = [];
    byArea[area].push(a);
  }
  
  console.log('By Area:');
  for (const [area, acts] of Object.entries(byArea)) {
    console.log(`  [${area}] (${acts.length} actuators):`);
    for (const a of acts) {
      const lastUpdate = a.last_update ? new Date(a.last_update) : null;
      const diffMin = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
      const isOnline = a.status === 'online' && diffMin !== null && diffMin <= 5;
      console.log(`    ${a.id} | ${a.type} | ${a.type_name} | status=${a.status} | state=${a.state} | online=${isOnline ? 'YES' : 'NO'} | ${diffMin !== null ? diffMin + 'min ago' : 'no update'}`);
    }
  }
  
  // Group by type
  console.log('\nBy Type:');
  const byType = {};
  for (const a of allActuators) {
    if (!byType[a.type]) byType[a.type] = { name: a.type_name, count: 0, ids: [] };
    byType[a.type].count++;
    byType[a.type].ids.push(a.id);
  }
  for (const [type, info] of Object.entries(byType)) {
    console.log(`  ${type} (${info.name}): ${info.count} -> ${info.ids.join(', ')}`);
  }
  
  // Online count
  const onlineCount = allActuators.filter(a => {
    const lastUpdate = a.last_update ? new Date(a.last_update) : null;
    const diffMin = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
    return a.status === 'online' && diffMin !== null && diffMin <= 5;
  }).length;
  console.log(`\nOnline (5min threshold): ${onlineCount} / ${allActuators.length}`);
  
  // 2. API query
  console.log('\n--- API ---');
  const apiResult = await sendRequest('/api/actuators', 'GET');
  console.log(`API returned: ${apiResult.data.length} actuators\n`);
  
  for (const a of apiResult.data) {
    const lastUpdate = a.last_update ? new Date(a.last_update) : null;
    const diffMin = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
    const isOnline = a.status === 'online' && diffMin !== null && diffMin <= 5;
    console.log(`  ${a.id} | ${a.type} | ${a.name} | area=${a.area} | online=${isOnline ? 'YES' : 'NO'} | ${diffMin !== null ? diffMin + 'min ago' : 'no update'}`);
  }
  
  // 3. Compare
  console.log('\n--- Comparison ---');
  const dbIds = new Set(allActuators.map(a => a.id));
  const apiIds = new Set(apiResult.data.map(a => a.id));
  
  if (dbIds.size === apiIds.size && [...dbIds].every(id => apiIds.has(id))) {
    console.log(`MATCH: DB ${dbIds.size} = API ${apiIds.size}`);
  } else {
    console.log(`MISMATCH: DB ${dbIds.size} vs API ${apiIds.size}`);
    for (const id of dbIds) if (!apiIds.has(id)) console.log(`  In DB only: ${id}`);
    for (const id of apiIds) if (!dbIds.has(id)) console.log(`  In API only: ${id}`);
  }
  
  await connection.end();
  console.log('\n=== Done ===');
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
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

check().catch(console.error);