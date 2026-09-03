// 迁移脚本：给 actuator_commands 表添加 command_data 字段
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('=== 数据库迁移：添加 command_data 字段 ===\n');
  
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
    console.log('已加载 .env.local');
  }
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture'
  });
  
  try {
    // 1. 检查 command_data 字段是否存在
    console.log('\n1. 检查 command_data 字段...');
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM actuator_commands LIKE 'command_data'`
    );
    
    if (columns.length > 0) {
      console.log('   command_data 字段已存在，跳过');
    } else {
      // 2. 添加 command_data 字段
      console.log('2. 添加 command_data 字段...');
      await connection.execute(`
        ALTER TABLE actuator_commands 
        ADD COLUMN command_data JSON NULL COMMENT '命令扩展数据(RGB参数等)' 
        AFTER control_value
      `);
      console.log('   ✅ command_data 字段已添加');
    }
    
    // 3. 验证表结构
    console.log('\n3. 验证 actuator_commands 表结构:');
    const [allColumns] = await connection.execute(
      'SHOW COLUMNS FROM actuator_commands'
    );
    for (const col of allColumns) {
      console.log(`   ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Comment ? '- ' + col.Comment : ''}`);
    }
    
    console.log('\n=== 迁移完成 ===');
  } catch (error) {
    console.error('迁移失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);