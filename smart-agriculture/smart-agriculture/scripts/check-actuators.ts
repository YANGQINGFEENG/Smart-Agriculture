/**
 * 检查执行器数据脚本
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import mysql from 'mysql2/promise'

async function checkActuators() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
  })

  try {
    console.log('✅ 数据库连接成功\n')

    const [actuators] = await connection.query('SELECT * FROM actuators')
    console.log('📊 执行器数据:')
    console.log(JSON.stringify(actuators, null, 2))

    const [history] = await connection.query('SELECT * FROM actuator_status_history ORDER BY timestamp DESC LIMIT 5')
    console.log('\n📝 最近的状态历史:')
    console.log(JSON.stringify(history, null, 2))

  } finally {
    await connection.end()
  }
}

checkActuators().catch(console.error)
