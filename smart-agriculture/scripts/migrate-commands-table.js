/**
 * 执行器控制指令表迁移脚本
 * 更新数据库表结构以支持数值控制
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  try {
    console.log('开始执行数据库迁移...');

    // 1. 修改 command 字段，支持 'value' 命令
    await connection.execute(`
      ALTER TABLE actuator_commands 
      MODIFY COLUMN command ENUM('on', 'off', 'value') NOT NULL;
    `);
    console.log('✓ 修改 command 字段完成');

    // 2. 添加 control_value 字段
    await connection.execute(`
      ALTER TABLE actuator_commands 
      ADD COLUMN control_value DECIMAL(10, 2) NULL;
    `);
    console.log('✓ 添加 control_value 字段完成');

    // 3. 添加 status 字段的 'executing' 和 'timeout' 选项
    await connection.execute(`
      ALTER TABLE actuator_commands 
      MODIFY COLUMN status ENUM('pending', 'executing', 'executed', 'failed', 'timeout') DEFAULT 'pending';
    `);
    console.log('✓ 修改 status 字段完成');

    console.log('\n✅ 数据库迁移完成！');
  } catch (error) {
    console.error('\n❌ 数据库迁移失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
