const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'Yjh@437507',
    database: 'smart_agriculture'
  });
  
  // 直接查询最近的更新
  const [rows] = await conn.query(
    "SELECT id, state, control_value, feedback, JSON_TYPE(feedback) as type FROM actuators WHERE id = 'LT-1-002'"
  );
  
  console.log('数据库中的实际值:');
  console.log('  state:', rows[0].state);
  console.log('  control_value:', rows[0].control_value);
  console.log('  feedback:', rows[0].feedback);
  console.log('  feedback类型:', rows[0].type);
  
  // 尝试手动更新feedback
  console.log('\n尝试手动更新feedback...');
  const testData = JSON.stringify({ state: 'on', color: { r: 255, g: 127, b: 0 }, brightness: 50 });
  await conn.query(
    "UPDATE actuators SET feedback = ? WHERE id = 'LT-1-002'",
    [testData]
  );
  
  // 再次查询
  const [rows2] = await conn.query(
    "SELECT id, feedback, JSON_TYPE(feedback) as type FROM actuators WHERE id = 'LT-1-002'"
  );
  console.log('更新后feedback:', rows2[0].feedback);
  console.log('更新后类型:', rows2[0].type);
  
  // 重置回null
  await conn.query("UPDATE actuators SET feedback = NULL WHERE id = 'LT-1-002'");
  
  await conn.end();
}

main().catch(console.error);