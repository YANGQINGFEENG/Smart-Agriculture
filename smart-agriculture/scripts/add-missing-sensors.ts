/**
 * 添加缺失的传感器类型和传感器
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function addMissingSensors() {
  console.log('🔧 添加缺失的传感器...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功')

  // 查询当前传感器类型
  const [types] = await connection.query('SELECT * FROM sensor_types')
  console.log('📋 当前传感器类型：')
  console.table(types)

  // 添加传感器类型（如果不存在）
  console.log('\n📝 添加传感器类型...')
  await connection.query(`
    INSERT INTO sensor_types (type, name, unit) VALUES
    ('ec', '土壤电导率传感器', 'μS/cm'),
    ('ph', '土壤pH值传感器', 'pH')
    ON DUPLICATE KEY UPDATE name = VALUES(name), unit = VALUES(unit)
  `)

  // 再次查询获取正确的ID
  const [newTypes] = await connection.query('SELECT * FROM sensor_types')
  console.log('📋 更新后的传感器类型：')
  console.table(newTypes)

  // 获取EC和pH的type_id
  const ecType = (newTypes as any[]).find(t => t.type === 'ec')
  const phType = (newTypes as any[]).find(t => t.type === 'ph')

  if (!ecType || !phType) {
    console.error('❌ 找不到EC或pH类型')
    return
  }

  console.log(`\n📋 EC类型ID: ${ecType.id}, pH类型ID: ${phType.id}`)

  // 添加传感器设备
  console.log('\n📝 添加传感器设备...')
  await connection.query(`
    INSERT INTO sensors (id, name, type_id, location, status, battery, last_update) VALUES
    ('E-001', 'A区温室1号土壤EC传感器', ?, 'A区温室', 'online', 90, CURRENT_TIMESTAMP),
    ('P-001', 'A区温室1号土壤pH传感器', ?, 'A区温室', 'online', 88, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE name = VALUES(name), type_id = VALUES(type_id), location = VALUES(location), status = VALUES(status), battery = VALUES(battery), last_update = VALUES(last_update)
  `, [ecType.id, phType.id])
  console.log('✅ 传感器设备添加成功')

  // 查询所有传感器
  const [sensors] = await connection.query(`
    SELECT s.id, s.name, st.type, st.name as type_name, st.unit, s.location, s.status
    FROM sensors s
    JOIN sensor_types st ON s.type_id = st.id
    ORDER BY s.id
  `)

  console.log('\n📊 当前传感器列表：')
  console.table(sensors)

  await connection.end()

  console.log('\n✨ 完成！')
}

addMissingSensors().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
