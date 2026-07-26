/**
 * 数据库结构更新脚本 v2.0
 * 用于添加区域(area)、控制值(control_value)、锁定(locked)等字段
 * 以及创建执行器控制指令表(actuator_commands)
 * 
 * 使用方法：
 * 1. 确保数据库服务已启动
 * 2. 修改 .env.local 文件中的数据库连接信息
 * 3. 运行：npx tsx scripts/update-db-v2.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function updateDatabase() {
  console.log('🚀 开始更新数据库结构...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  })

  console.log('✅ 数据库连接成功')

  const dbName = process.env.DB_NAME || 'smart_agriculture'
  await connection.query(`USE \`${dbName}\``)

  // ========== 1. 更新传感器表 - 添加区域字段 ==========
  console.log('📝 更新 sensors 表 - 添加 area 字段...')
  try {
    await connection.query('ALTER TABLE sensors ADD COLUMN area VARCHAR(100) DEFAULT ""')
    console.log('✅ sensors 表更新成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ area 字段已存在，跳过')
    } else {
      console.error('❌ sensors 表更新失败:', error.message)
    }
  }

  // ========== 2. 更新执行器表 - 添加区域、控制值、锁定字段 ==========
  console.log('📝 更新 actuators 表 - 添加 area, control_value, locked 字段...')
  
  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN area VARCHAR(100) DEFAULT ""')
    console.log('✅ actuators 表添加 area 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ area 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 area 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN control_value DECIMAL(10, 2) DEFAULT NULL')
    console.log('✅ actuators 表添加 control_value 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ control_value 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 control_value 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN locked TINYINT(1) DEFAULT 0')
    console.log('✅ actuators 表添加 locked 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ locked 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 locked 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN farm_id INT DEFAULT 0')
    console.log('✅ actuators 表添加 farm_id 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ farm_id 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 farm_id 字段失败:', error.message)
    }
  }

  // 添加执行器控制类型字段（用于硬件上报的控制类型和控制范围）
  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN control_type VARCHAR(20) DEFAULT "boolean"')
    console.log('✅ actuators 表添加 control_type 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ control_type 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 control_type 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN control_min DECIMAL(10, 2) DEFAULT 0')
    console.log('✅ actuators 表添加 control_min 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ control_min 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 control_min 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN control_max DECIMAL(10, 2) DEFAULT 100')
    console.log('✅ actuators 表添加 control_max 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ control_max 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 control_max 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN control_step DECIMAL(10, 2) DEFAULT 1')
    console.log('✅ actuators 表添加 control_step 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ control_step 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 control_step 字段失败:', error.message)
    }
  }

  try {
    await connection.query('ALTER TABLE actuators ADD COLUMN control_default DECIMAL(10, 2) DEFAULT 0')
    console.log('✅ actuators 表添加 control_default 字段成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️ control_default 字段已存在，跳过')
    } else {
      console.error('❌ actuators 表添加 control_default 字段失败:', error.message)
    }
  }

  // ========== 3. 创建网关表 ==========
  console.log('📝 创建 gateways 表...')
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gateways (
        id INT PRIMARY KEY AUTO_INCREMENT,
        farm_id INT DEFAULT 0,
        name VARCHAR(100) NOT NULL,
        gateway_type VARCHAR(50) DEFAULT 'wifi_sensor',
        ip_address VARCHAR(50),
        mac_address VARCHAR(50),
        status ENUM('online', 'offline') DEFAULT 'offline',
        area VARCHAR(100) DEFAULT '',
        last_heartbeat TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ip_address (ip_address),
        INDEX idx_mac_address (mac_address)
      )
    `)
    console.log('✅ gateways 表创建成功')
  } catch (error: any) {
    console.error('❌ gateways 表创建失败:', error.message)
  }

  // ========== 4. 创建设备节点表 ==========
  console.log('📝 创建 device_nodes 表...')
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_nodes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        gateway_id INT NOT NULL,
        node_id VARCHAR(50) NOT NULL,
        name VARCHAR(100),
        node_type ENUM('sensor', 'actuator') NOT NULL,
        sensor_type VARCHAR(50),
        location VARCHAR(255),
        status ENUM('online', 'offline') DEFAULT 'online',
        area VARCHAR(100) DEFAULT '',
        last_update TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_gateway_node (gateway_id, node_id),
        INDEX idx_gateway_id (gateway_id),
        INDEX idx_node_id (node_id)
      )
    `)
    console.log('✅ device_nodes 表创建成功')
  } catch (error: any) {
    console.error('❌ device_nodes 表创建失败:', error.message)
  }

  // ========== 5. 创建设备原始数据表 ==========
  console.log('📝 创建 device_data 表...')
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_data (
        id INT PRIMARY KEY AUTO_INCREMENT,
        gateway_id INT NOT NULL,
        node_id VARCHAR(50) NOT NULL,
        sensor_type VARCHAR(50),
        value DECIMAL(10, 2),
        unit VARCHAR(20),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_gateway_node (gateway_id, node_id),
        INDEX idx_timestamp (timestamp)
      )
    `)
    console.log('✅ device_data 表创建成功')
  } catch (error: any) {
    console.error('❌ device_data 表创建失败:', error.message)
  }

  // ========== 6. 创建执行器控制指令表 ==========
  console.log('📝 创建 actuator_commands 表...')
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS actuator_commands (
        id INT PRIMARY KEY AUTO_INCREMENT,
        actuator_id VARCHAR(20) NOT NULL,
        command ENUM('on', 'off', 'value') NOT NULL,
        control_value DECIMAL(10, 2) DEFAULT NULL,
        status ENUM('pending', 'executing', 'executed', 'failed', 'timeout') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP NULL,
        INDEX idx_actuator_id (actuator_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `)
    console.log('✅ actuator_commands 表创建成功')
  } catch (error: any) {
    console.error('❌ actuator_commands 表创建失败:', error.message)
  }

  // ========== 7. 创建农场表 ==========
  console.log('📝 创建 farms 表...')
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS farms (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ farms 表创建成功')
  } catch (error: any) {
    console.error('❌ farms 表创建失败:', error.message)
  }

  // ========== 8. 添加缺失的传感器类型 ==========
  console.log('📝 添加缺失的传感器类型...')
  const sensorTypesToAdd = [
    { type: 'soil_moisture', name: '土壤湿度传感器', unit: '%' },
    { type: 'co2', name: 'CO₂浓度传感器', unit: 'ppm' },
    { type: 'pm25', name: 'PM2.5传感器', unit: 'μg/m³' },
    { type: 'water_level', name: '水位传感器', unit: 'cm' },
    { type: 'pressure', name: '气压传感器', unit: 'hPa' },
    { type: 'vibration', name: '振动传感器', unit: 'mm/s' },
    { type: 'altitude', name: '海拔传感器', unit: 'm' },
    { type: 'unknown_sensor', name: '未分配传感器', unit: '' },
  ]

  for (const st of sensorTypesToAdd) {
    try {
      await connection.query(
        'INSERT IGNORE INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
        [st.type, st.name, st.unit]
      )
    } catch (error) {
      // 忽略重复插入错误
    }
  }
  console.log('✅ 传感器类型添加成功')

  // ========== 9. 添加缺失的执行器类型 ==========
  console.log('📝 添加缺失的执行器类型...')
  const actuatorTypesToAdd = [
    { type: 'ventilator', name: '通风机', description: '用于空气循环' },
    { type: 'fogger', name: '雾化器', description: '用于湿度调节和降温' },
    { type: 'motor', name: '电机', description: '用于驱动控制，支持速度调节' },
    { type: 'servo', name: '舵机', description: '用于角度控制，支持0-180度旋转' },
    { type: 'led', name: 'LED灯', description: '用于照明和指示，支持开关控制' },
    { type: 'unknown_actuator', name: '未分配执行器', description: '未知执行器设备' },
  ]

  for (const at of actuatorTypesToAdd) {
    try {
      await connection.query(
        'INSERT IGNORE INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
        [at.type, at.name, at.description]
      )
    } catch (error) {
      // 忽略重复插入错误
    }
  }
  console.log('✅ 执行器类型添加成功')

  // ========== 10. 检查并更新已存在的设备区域信息 ==========
  console.log('📝 更新现有设备的区域信息...')
  try {
    // 更新传感器区域（根据location字段推断）
    await connection.query(
      `UPDATE sensors 
       SET area = CASE 
         WHEN location LIKE '%A区%' THEN 'A区'
         WHEN location LIKE '%B区%' THEN 'B区'
         WHEN location LIKE '%C区%' THEN 'C区'
         ELSE location
       END
       WHERE area = '' OR area IS NULL`
    )
    
    // 更新执行器区域
    await connection.query(
      `UPDATE actuators 
       SET area = CASE 
         WHEN location LIKE '%A区%' THEN 'A区'
         WHEN location LIKE '%B区%' THEN 'B区'
         WHEN location LIKE '%C区%' THEN 'C区'
         ELSE location
       END
       WHERE area = '' OR area IS NULL`
    )
    console.log('✅ 设备区域信息更新成功')
  } catch (error: any) {
    console.error('❌ 设备区域信息更新失败:', error.message)
  }

  // 查询统计信息
  const [tables] = await connection.query(
    `SELECT TABLE_NAME 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ?`,
    [dbName]
  )

  console.log('\n📊 数据库表：')
  console.log(tables)

  const [sensorTypes] = await connection.query('SELECT COUNT(*) as count FROM sensor_types')
  const [sensors] = await connection.query('SELECT COUNT(*) as count FROM sensors')
  const [actuatorTypes] = await connection.query('SELECT COUNT(*) as count FROM actuator_types')
  const [actuators] = await connection.query('SELECT COUNT(*) as count FROM actuators')
  const [gateways] = await connection.query('SELECT COUNT(*) as count FROM gateways')

  console.log('\n📈 数据统计：')
  console.log(`- 传感器类型: ${(sensorTypes as any[])[0].count} 条`)
  console.log(`- 传感器设备: ${(sensors as any[])[0].count} 条`)
  console.log(`- 执行器类型: ${(actuatorTypes as any[])[0].count} 条`)
  console.log(`- 执行器设备: ${(actuators as any[])[0].count} 条`)
  console.log(`- 网关设备: ${(gateways as any[])[0].count} 条`)

  await connection.end()

  console.log('\n✨ 数据库结构更新完成！')
}

updateDatabase().catch((error) => {
  console.error('❌ 数据库更新失败:', error)
  process.exit(1)
})