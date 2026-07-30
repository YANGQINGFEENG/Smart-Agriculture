// 直接检查数据库中的feedback字段
const mysql = require('mysql2/promise');

async function checkDatabase() {
  console.log('=== 检查数据库feedback字段 ===\n');
  
  // 连接数据库
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture'
  });
  
  try {
    // 查询LT-1-002的feedback字段
    const [rows] = await connection.query(
      'SELECT id, state, control_value, feedback, last_update FROM actuators WHERE id = ?',
      ['LT-1-002']
    );
    
    console.log('执行器数据:');
    console.log('  ID:', rows[0].id);
    console.log('  状态:', rows[0].state);
    console.log('  控制值:', rows[0].control_value);
    console.log('  最后更新:', rows[0].last_update);
    console.log('  Feedback原始值:', JSON.stringify(rows[0].feedback));
    console.log('  Feedback类型:', typeof rows[0].feedback);
    
    // 使用SHOW CREATE TABLE查看表结构
    const [tableInfo] = await connection.query('SHOW CREATE TABLE actuators');
    console.log('\n表结构中feedback字段定义:');
    const createTable = tableInfo[0]['Create Table'];
    const feedbackMatch = createTable.match(/`feedback`[^,]+/);
    if (feedbackMatch) {
      console.log(' ', feedbackMatch[0]);
    }
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

checkDatabase().catch(console.error);