const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
  const db = await open({
    filename: './smart_agriculture.db',
    driver: sqlite3.Database
  });

  try {
    // 检查传感器表的last_update
    console.log('=== 传感器表 last_update ===');
    const sensors = await db.all('SELECT id, name, status, last_update FROM sensors ORDER BY last_update DESC LIMIT 10');
    sensors.forEach(s => {
      console.log(`${s.id} | ${s.name} | ${s.status} | ${s.last_update || 'NULL'}`);
    });

    // 检查sensor_data表的最新数据时间
    console.log('\n=== sensor_data 最新数据时间 ===');
    const latestData = await db.all(`
      SELECT sensor_id, MAX(timestamp) as latest_time, COUNT(*) as count 
      FROM sensor_data 
      GROUP BY sensor_id 
      ORDER BY latest_time DESC 
      LIMIT 10
    `);
    latestData.forEach(d => {
      console.log(`${d.sensor_id} | ${d.latest_time} | ${d.count} records`);
    });

    // 检查device_data表的最新上报时间
    console.log('\n=== device_data 最新上报时间 ===');
    const deviceData = await db.all(`
      SELECT node_id, MAX(timestamp) as latest_time, COUNT(*) as count 
      FROM device_data 
      GROUP BY node_id 
      ORDER BY latest_time DESC 
      LIMIT 10
    `);
    deviceData.forEach(d => {
      console.log(`${d.node_id} | ${d.latest_time} | ${d.count} records`);
    });

    // 检查当前时间
    console.log('\n=== 当前数据库时间 ===');
    const now = await db.get("SELECT datetime('now') as current_time");
    console.log(`数据库当前时间: ${now.current_time}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.close();
  }
}

main();
