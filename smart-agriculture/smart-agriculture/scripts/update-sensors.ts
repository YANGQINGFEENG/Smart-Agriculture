/**
 * 更新数据库脚本
 * 添加土壤温度、EC、pH传感器类型和数据
 * 
 * 使用方法：
 * npx tsx scripts/update-sensors.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function updateDatabase() {
  console.log('🚀 开始更新数据库...\n')

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
    // 1. 添加新的传感器类型
    console.log('📝 添加新的传感器类型...')
    await connection.query(`
      INSERT INTO sensor_types (type, name, unit) VALUES
      ('soil_temperature', '土壤温度传感器', '°C'),
      ('ec', '土壤电导率传感器', 'μS/cm'),
      ('ph', '土壤pH值传感器', 'pH')
      ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit)
    `)
    console.log('✅ 传感器类型添加成功')

    // 2. 更新 T-002 传感器为土壤温度传感器
    console.log('📝 更新 T-002 传感器...')
    await connection.query(`
      UPDATE sensors 
      SET name = 'A区温室1号土壤温度传感器', 
          type_id = (SELECT id FROM sensor_types WHERE type = 'soil_temperature')
      WHERE id = 'T-002'
    `)
    console.log('✅ T-002 传感器更新成功')

    // 3. 添加 E-001 和 P-001 传感器
    console.log('📝 添加 E-001 和 P-001 传感器...')
    await connection.query(`
      INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES
      ('E-001', 'A区温室1号土壤EC传感器', 
       (SELECT id FROM sensor_types WHERE type = 'ec'), 
       'A区温室', 'online', 90, CURRENT_TIMESTAMP),
      ('P-001', 'A区温室1号土壤pH传感器', 
       (SELECT id FROM sensor_types WHERE type = 'ph'), 
       'A区温室', 'online', 88, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name), 
        type_id = VALUES(type_id), 
        location = VALUES(location), 
        status = VALUES(status), 
        battery = VALUES(battery), 
        last_update = VALUES(last_update)
    `)
    console.log('✅ E-001 和 P-001 传感器添加成功')

    // 4. 为新传感器生成模拟数据
    console.log('📝 生成模拟数据（最近24小时）...')
    const now = new Date()
    
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      
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

    // 5. 查询统计信息
    const [sensorTypes] = await connection.query(
      'SELECT id, type, name, unit FROM sensor_types ORDER BY id'
    )
    const [sensors] = await connection.query(`
      SELECT s.id, s.name, st.type, s.location, s.status 
      FROM sensors s 
      JOIN sensor_types st ON s.type_id = st.id 
      ORDER BY s.id
    `)

    console.log('\n📊 传感器类型：')
    console.table(sensorTypes)

    console.log('\n📊 传感器设备：')
    console.table(sensors)

    console.log('\n✅ 数据库更新完成！')

  } catch (error) {
    console.error('❌ 更新失败:', error)
    throw error
  } finally {
    await connection.end()
  }
}

updateDatabase().catch(console.error)
