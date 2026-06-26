/**
 * 检查actuators表结构
 */

import mysql from 'mysql2/promise'

async function checkActuatorsTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  try {
    const [rows] = await connection.execute('DESCRIBE actuators')
    console.log('📊 actuators表结构:')
    console.table(rows)

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await connection.end()
  }
}

checkActuatorsTable()
