const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function main() {
  const dbPath = path.join(__dirname, '..', 'smart_agriculture.db');
  
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // 查看 sensors 表结构
    const tableInfo = await db.all("PRAGMA table_info(sensors)");
    console.log('=== sensors 表结构 ===');
    tableInfo.forEach(col => {
      console.log(`  ${col.name} (${col.type})`);
    });
    
    // 查看 sensor_data 表结构
    const dataInfo = await db.all("PRAGMA table_info(sensor_data)");
    console.log('\n=== sensor_data 表结构 ===');
    dataInfo.forEach(col => {
      console.log(`  ${col.name} (${col.type})`);
    });
    
    // 查看传感器类型表
    const types = await db.all('SELECT * FROM sensor_types');
    console.log('\n=== sensor_types 表 ===');
    types.forEach(t => {
      console.log(`  ${t.id}: ${t.type} - ${t.name} (${t.unit})`);
    });
    
    await db.close();
  } catch (error) {
    console.error('查询失败:', error.message);
  }
}

main();
