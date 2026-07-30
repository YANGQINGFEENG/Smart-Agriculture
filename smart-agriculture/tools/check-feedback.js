// 检查数据库中feedback字段的实际值
const mysql = require('mysql2/promise');

async function checkFeedback() {
  console.log('=== 检查feedback字段实际值 ===\n');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture'
  });
  
  try {
    // 直接查询原始数据
    const [rows] = await connection.query(
      'SELECT id, state, control_value, feedback, HEX(feedback) as feedback_hex FROM actuators WHERE id = ?',
      ['LT-1-002']
    );
    
    console.log('数据库原始数据:');
    console.log('  id:', rows[0].id);
    console.log('  state:', rows[0].state);
    console.log('  control_value:', rows[0].control_value);
    console.log('  feedback:', rows[0].feedback);
    console.log('  feedback类型:', typeof rows[0].feedback);
    console.log('  feedback_hex:', rows[0].feedback_hex);
    
    // 尝试使用JSON函数查询
    const [jsonResult] = await connection.query(
      "SELECT feedback, JSON_TYPE(feedback) as json_type FROM actuators WHERE id = ?",
      ['LT-1-002']
    );
    console.log('\nJSON函数查询:');
    console.log('  feedback:', jsonResult[0].feedback);
    console.log('  JSON_TYPE:', jsonResult[0].json_type);
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

checkFeedback().catch(console.error);