/**
 * 检查数据库中最新的传感器数据
 */

import mysql from 'mysql2/promise'

async function checkLatestSensorData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  try {
    const sensors = ['T-001', 'H-001', 'L-001', 'T-002', 'P-001']

    for (const sensorId of sensors) {
      const [rows] = await connection.execute(
        `SELECT sensor_id, value, timestamp 
         FROM sensor_data 
         WHERE sensor_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 3`,
        [sensorId]
      )

      console.log(`📊 ${sensorId} 最新数据:`)
      rows.forEach((row: any) => {
        const time = new Date(row.timestamp).toLocaleString('zh-CN')
        console.log(`  [${time}] ${row.value}`)
      })
      console.log('')
    }

    const [stats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_count,
        MAX(timestamp) as latest_time,
        MIN(timestamp) as earliest_time
       FROM sensor_data`
    )

    console.log('📈 数据库统计:')
    console.log(`  总数据量: ${(stats as any[])[0].total_count}`)
    console.log(`  最新数据: ${new Date((stats as any[])[0].latest_time).toLocaleString('zh-CN')}`)
    console.log(`  最早数据: ${new Date((stats as any[])[0].earliest_time).toLocaleString('zh-CN')}`)

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await connection.end()
  }
}

checkLatestSensorData()
