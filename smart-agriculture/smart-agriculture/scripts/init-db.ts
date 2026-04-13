/**
 * 数据库初始化脚本
 * 用于创建数据库和表结构
 * 
 * 使用方法：
 * 1. 确保 MySQL 服务已启动
 * 2. 修改 .env.local 文件中的数据库连接信息
 * 3. 运行：npx tsx scripts/init-db.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function initDatabase() {
  console.log('🚀 开始初始化数据库...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  })

  console.log('✅ 数据库连接成功')

  const dbName = process.env.DB_NAME || 'smart_agriculture'

  // 创建数据库
  console.log('📝 创建数据库...')
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
  await connection.query(`USE \`${dbName}\``)
  console.log('✅ 数据库创建成功')

  // 创建表
  console.log('📝 创建数据表...')
  
  // 传感器类型表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sensor_types (
      id INT PRIMARY KEY AUTO_INCREMENT,
      type VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 传感器设备表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sensors (
      id VARCHAR(20) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type_id INT NOT NULL,
      location VARCHAR(255) NOT NULL,
      status ENUM('online', 'offline') DEFAULT 'offline',
      battery INT DEFAULT 100,
      last_update TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES sensor_types(id)
    )
  `)

  // 传感器数据表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sensor_id VARCHAR(20) NOT NULL,
      value DECIMAL(10, 2) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sensor_id) REFERENCES sensors(id)
    )
  `)

  // 设备状态历史表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS device_status_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sensor_id VARCHAR(20) NOT NULL,
      status ENUM('online', 'offline') NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sensor_id) REFERENCES sensors(id)
    )
  `)

  console.log('✅ 数据表创建成功')

  // 插入传感器类型
  console.log('📝 插入传感器类型...')
  await connection.query(`
    INSERT INTO sensor_types (type, name, unit) VALUES
    ('temperature', '温度传感器', '°C'),
    ('humidity', '空气湿度传感器', '%'),
    ('light', '光照传感器', 'Lux'),
    ('soil', '土壤湿度传感器', '%'),
    ('soil_temperature', '土壤温度传感器', '°C'),
    ('ec', '土壤电导率传感器', 'μS/cm'),
    ('ph', '土壤pH值传感器', 'pH')
    ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit)
  `)
  console.log('✅ 传感器类型插入成功')

  // 插入传感器设备
  console.log('📝 插入传感器设备...')
  await connection.query(`
    INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES
    ('T-001', 'A区温室1号温度传感器', 1, 'A区温室', 'online', 95, CURRENT_TIMESTAMP),
    ('T-003', 'B区温室1号温度传感器', 1, 'B区温室', 'online', 88, CURRENT_TIMESTAMP),
    ('H-001', 'A区温室1号湿度传感器', 2, 'A区温室', 'online', 90, CURRENT_TIMESTAMP),
    ('H-002', 'B区温室1号湿度传感器', 2, 'B区温室', 'online', 85, CURRENT_TIMESTAMP),
    ('L-001', 'A区温室1号光照传感器', 3, 'A区温室', 'online', 93, CURRENT_TIMESTAMP),
    ('L-002', 'B区温室1号光照传感器', 3, 'B区温室', 'online', 89, CURRENT_TIMESTAMP),
    ('S-001', 'A区温室1号土壤湿度传感器', 4, 'A区温室', 'online', 91, CURRENT_TIMESTAMP),
    ('S-002', 'B区温室1号土壤湿度传感器', 4, 'B区温室', 'online', 87, CURRENT_TIMESTAMP),
    ('S-003', 'C区大棚1号土壤湿度传感器', 4, 'C区大棚', 'online', 84, CURRENT_TIMESTAMP),
    ('T-002', 'A区温室1号土壤温度传感器', 5, 'A区温室', 'online', 92, CURRENT_TIMESTAMP),
    ('E-001', 'A区温室1号土壤EC传感器', 6, 'A区温室', 'online', 90, CURRENT_TIMESTAMP),
    ('P-001', 'A区温室1号土壤pH传感器', 7, 'A区温室', 'online', 88, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE name = VALUES(name), type_id = VALUES(type_id), location = VALUES(location), status = VALUES(status), battery = VALUES(battery), last_update = VALUES(last_update)
  `)
  console.log('✅ 传感器设备插入成功')

  // 生成模拟数据
  console.log('📝 生成模拟数据（最近24小时）...')
  const now = new Date()
  
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    
    // 空气温度传感器数据（18-30°C）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['T-001', 18 + Math.random() * 12, timestamp]
    )
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['T-003', 18 + Math.random() * 12, timestamp]
    )
    
    // 空气湿度传感器数据（50-80%）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['H-001', 50 + Math.random() * 30, timestamp]
    )
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['H-002', 50 + Math.random() * 30, timestamp]
    )
    
    // 光照传感器数据（5000-15000 Lux）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['L-001', 5000 + Math.random() * 10000, timestamp]
    )
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['L-002', 5000 + Math.random() * 10000, timestamp]
    )
    
    // 土壤湿度传感器数据（30-60%）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['S-001', 30 + Math.random() * 30, timestamp]
    )
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['S-002', 30 + Math.random() * 30, timestamp]
    )
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['S-003', 30 + Math.random() * 30, timestamp]
    )
    
    // 土壤温度传感器数据（15-28°C）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['T-002', 15 + Math.random() * 13, timestamp]
    )
    
    // 土壤电导率传感器数据（200-1000 μS/cm）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['E-001', 200 + Math.random() * 800, timestamp]
    )
    
    // 土壤pH传感器数据（5.5-7.5）
    await connection.query(
      'INSERT INTO sensor_data (sensor_id, value, timestamp) VALUES (?, ?, ?)',
      ['P-001', 5.5 + Math.random() * 2, timestamp]
    )
  }
  
  console.log('✅ 模拟数据生成成功')

  // 查询统计信息
  const [tables] = await connection.query(
    `SELECT TABLE_NAME 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ?`,
    [dbName]
  )

  console.log('\n📊 数据库表：')
  console.log(tables)

  const [sensorTypes] = await connection.query(
    'SELECT COUNT(*) as count FROM sensor_types'
  )
  const [sensors] = await connection.query(
    'SELECT COUNT(*) as count FROM sensors'
  )
  const [sensorData] = await connection.query(
    'SELECT COUNT(*) as count FROM sensor_data'
  )

  console.log('\n📈 数据统计：')
  console.log(`- 传感器类型: ${(sensorTypes as any[])[0].count} 条`)
  console.log(`- 传感器设备: ${(sensors as any[])[0].count} 条`)
  console.log(`- 传感器数据: ${(sensorData as any[])[0].count} 条`)

  await connection.end()

  console.log('\n✨ 数据库初始化完成！')
  console.log('\n💡 提示：现在可以启动开发服务器了：npm run dev')
}

initDatabase().catch((error) => {
  console.error('❌ 数据库初始化失败:', error)
  process.exit(1)
})
