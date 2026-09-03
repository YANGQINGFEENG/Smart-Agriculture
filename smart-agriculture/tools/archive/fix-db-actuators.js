// 直接修复数据库中的执行器类型问题
// 修复蜂鸣器(BZ-1-001)的类型从 unknown_actuator 改为 buzzer

const mysql = require('mysql2/promise');

async function fixDatabase() {
  console.log('=== 修复数据库执行器类型 ===\n');
  
  // 读取环境变量
  const path = require('path');
  const fs = require('fs');
  
  // 尝试加载.env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        envVars[key.trim()] = rest.join('=').trim();
      }
    });
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
    console.log('已加载 .env.local');
  }
  
  // 获取数据库配置
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'smart_agriculture';
  
  console.log(`连接数据库: ${dbHost} - ${dbName}`);
  
  const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPass,
    database: dbName
  });
  
  try {
    // 1. 查看蜂鸣器类型ID
    console.log('\n1. 查看buzzer类型ID:');
    const [buzzerTypes] = await connection.execute(
      'SELECT id, type, name FROM actuator_types WHERE type = ?',
      ['buzzer']
    );
    console.log('   buzzer类型:', buzzerTypes);
    
    // 2. 如果没有buzzer类型，先添加
    let buzzerTypeId;
    if (buzzerTypes.length === 0) {
      console.log('\n2. 添加buzzer类型:');
      const [result] = await connection.execute(
        'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
        ['buzzer', '蜂鸣器', '用于声音提示，支持多种蜂鸣模式']
      );
      buzzerTypeId = result.insertId;
      console.log(`   已添加 buzzer 类型，ID: ${buzzerTypeId}`);
    } else {
      buzzerTypeId = buzzerTypes[0].id;
      console.log(`\n2. buzzer类型已存在，ID: ${buzzerTypeId}`);
    }
    
    // 3. 查找蜂鸣器执行器
    console.log('\n3. 查找蜂鸣器执行器:');
    const [buzzers] = await connection.execute(
      `SELECT a.id, a.name, a.type_id, at.type as current_type 
       FROM actuators a 
       INNER JOIN actuator_types at ON a.type_id = at.id 
       WHERE a.id = ?`,
      ['BZ-1-001']
    );
    console.log('   蜂鸣器执行器:', buzzers);
    
    // 4. 修复蜂鸣器类型
    if (buzzers.length > 0 && buzzers[0].current_type === 'unknown_actuator') {
      console.log('\n4. 修复蜂鸣器类型:');
      await connection.execute(
        'UPDATE actuators SET type_id = ? WHERE id = ?',
        [buzzerTypeId, 'BZ-1-001']
      );
      console.log('   ✅ 蜂鸣器类型已修复为 buzzer');
    } else if (buzzers.length > 0) {
      console.log('\n4. 蜂鸣器类型已经是正确的，无需修复');
    }
    
    // 5. 检查所有执行器状态
    console.log('\n5. 所有执行器状态:');
    const [allActuators] = await connection.execute(
      `SELECT a.id, a.name, a.status, a.state, a.area, a.last_update, at.type, at.name as type_name
       FROM actuators a 
       INNER JOIN actuator_types at ON a.type_id = at.id 
       ORDER BY a.area, a.id`
    );
    
    for (const act of allActuators) {
      const lastUpdate = act.last_update ? new Date(act.last_update) : null;
      const diffMin = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
      console.log(`   ${act.id}: [${act.type}] ${act.name} - ${act.status}/${act.state} - ${act.area} - ${diffMin ? diffMin + '分钟前' : '无更新'}`);
    }
    
    console.log('\n=== 修复完成 ===');
    
  } catch (error) {
    console.error('修复失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixDatabase().catch(console.error);