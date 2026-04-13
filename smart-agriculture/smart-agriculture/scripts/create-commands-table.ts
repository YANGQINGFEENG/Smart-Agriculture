/**
 * 创建执行器控制指令表
 */

import mysql from 'mysql2/promise'

async function createActuatorCommandsTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS actuator_commands (
        id INT PRIMARY KEY AUTO_INCREMENT,
        actuator_id VARCHAR(20) NOT NULL,
        command ENUM('on', 'off') NOT NULL,
        status ENUM('pending', 'executed', 'failed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP NULL,
        INDEX idx_actuator_id (actuator_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `)

    console.log('✅ 执行器控制指令表创建成功')

    await connection.execute(`
      ALTER TABLE actuator_commands 
      COMMENT '执行器控制指令表 - 存储网页端发送给硬件端的控制指令'
    `)

    console.log('✅ 表注释添加成功')

    const [rows] = await connection.execute('DESCRIBE actuator_commands')
    console.log('\n📊 表结构:')
    console.table(rows)

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await connection.end()
  }
}

createActuatorCommandsTable()
