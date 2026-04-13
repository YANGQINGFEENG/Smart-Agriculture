/**
 * 添加执行器功能数据库更新脚本
 * 添加执行器类型表、执行器设备表、执行器状态历史表
 * 
 * 使用方法：
 * npx tsx scripts/add-actuators.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function addActuators() {
  console.log('🚀 开始添加执行器功能...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
    multipleStatements: true,
  })

  console.log('✅ 数据库连接成功')

  try {
    // 1. 创建执行器类型表
    console.log('📝 创建执行器类型表...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS actuator_types (
        id INT PRIMARY KEY AUTO_INCREMENT,
        type VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ 执行器类型表创建成功')

    // 2. 创建执行器设备表
    console.log('📝 创建执行器设备表...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS actuators (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type_id INT NOT NULL,
        location VARCHAR(255) NOT NULL,
        status ENUM('online', 'offline') DEFAULT 'offline',
        state ENUM('on', 'off') DEFAULT 'off',
        mode ENUM('auto', 'manual') DEFAULT 'auto',
        last_update TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES actuator_types(id),
        INDEX idx_status (status),
        INDEX idx_state (state),
        INDEX idx_mode (mode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ 执行器设备表创建成功')

    // 3. 创建执行器状态历史表
    console.log('📝 创建执行器状态历史表...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS actuator_status_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        actuator_id VARCHAR(20) NOT NULL,
        state ENUM('on', 'off') NOT NULL,
        mode ENUM('auto', 'manual') NOT NULL,
        trigger_source VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actuator_id) REFERENCES actuators(id),
        INDEX idx_actuator_id (actuator_id),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('✅ 执行器状态历史表创建成功')

    // 4. 插入执行器类型
    console.log('📝 插入执行器类型...')
    await connection.query(`
      INSERT INTO actuator_types (type, name, description) VALUES
      ('water_pump', '水泵', '用于灌溉和排水控制'),
      ('fan', '风扇', '用于通风和温度调节'),
      ('heater', '加热器', '用于温度控制'),
      ('valve', '电磁阀', '用于水流控制'),
      ('light', '补光灯', '用于光照调节')
      ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)
    `)
    console.log('✅ 执行器类型插入成功')

    // 5. 插入执行器设备
    console.log('📝 插入执行器设备...')
    await connection.query(`
      INSERT INTO actuators (id, name, type_id, location, status, state, mode, last_update) VALUES
      ('WP-001', 'A区温室1号水泵', 1, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
      ('WP-002', 'B区温室1号水泵', 1, 'B区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
      ('FN-001', 'A区温室1号风扇', 2, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
      ('FN-002', 'B区温室1号风扇', 2, 'B区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
      ('HT-001', 'A区温室1号加热器', 3, 'A区温室', 'offline', 'off', 'manual', CURRENT_TIMESTAMP),
      ('VL-001', 'A区温室1号电磁阀', 4, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP),
      ('LT-001', 'A区温室1号补光灯', 5, 'A区温室', 'online', 'off', 'auto', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name), 
        type_id = VALUES(type_id), 
        location = VALUES(location), 
        status = VALUES(status), 
        state = VALUES(state), 
        mode = VALUES(mode), 
        last_update = VALUES(last_update)
    `)
    console.log('✅ 执行器设备插入成功')

    // 6. 插入一些状态历史记录
    console.log('📝 插入状态历史记录...')
    const now = new Date()
    
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      const state = i % 2 === 0 ? 'on' : 'off'
      const mode = i % 3 === 0 ? 'manual' : 'auto'
      const triggerSource = mode === 'manual' ? 'user' : 'system'
      
      await connection.query(
        'INSERT INTO actuator_status_history (actuator_id, state, mode, trigger_source, timestamp) VALUES (?, ?, ?, ?, ?)',
        ['WP-001', state, mode, triggerSource, timestamp]
      )
    }
    console.log('✅ 状态历史记录插入成功')

    // 7. 查询统计信息
    const [actuatorTypes] = await connection.query(
      'SELECT id, type, name, description FROM actuator_types ORDER BY id'
    )
    const [actuators] = await connection.query(`
      SELECT a.id, a.name, at.type, a.location, a.status, a.state, a.mode 
      FROM actuators a 
      JOIN actuator_types at ON a.type_id = at.id 
      ORDER BY a.id
    `)

    console.log('\n📊 执行器类型：')
    console.table(actuatorTypes)

    console.log('\n📊 执行器设备：')
    console.table(actuators)

    console.log('\n✅ 执行器功能添加完成！')

  } catch (error) {
    console.error('❌ 添加失败:', error)
    throw error
  } finally {
    await connection.end()
  }
}

addActuators().catch(console.error)
