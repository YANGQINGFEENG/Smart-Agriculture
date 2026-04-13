/**
 * 检查传感器数据
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function checkSensorData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  // 查询最近的数据
  const [recentData] = await connection.query(`
    SELECT sd.id, sd.sensor_id, sd.value, sd.timestamp, s.name as sensor_name
    FROM sensor_data sd
    JOIN sensors s ON sd.sensor_id = s.id
    ORDER BY sd.timestamp DESC
    LIMIT 20
  `)

  console.log('📊 最近20条传感器数据：')
  console.table(recentData)

  // 按传感器统计
  const [stats] = await connection.query(`
    SELECT sd.sensor_id, s.name, COUNT(*) as count, MAX(sd.timestamp) as last_update
    FROM sensor_data sd
    JOIN sensors s ON sd.sensor_id = s.id
    GROUP BY sd.sensor_id, s.name
    ORDER BY last_update DESC
  `)

  console.log('\n📈 各传感器数据统计：')
  console.table(stats)

  // 检查最近5分钟的数据
  const [recent5min] = await connection.query(`
    SELECT sd.sensor_id, s.name, COUNT(*) as count, MIN(sd.timestamp) as first_data, MAX(sd.timestamp) as last_data
    FROM sensor_data sd
    JOIN sensors s ON sd.sensor_id = s.id
    WHERE sd.timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    GROUP BY sd.sensor_id, s.name
  `)

  console.log('\n⏰ 最近5分钟的数据：')
  if ((recent5min as any[]).length === 0) {
    console.log('❌ 没有最近5分钟的数据！')
  } else {
    console.table(recent5min)
  }

  await connection.end()
}

checkSensorData().catch((error) => {
  console.error('❌ 失败:', error)
  process.exit(1)
})
