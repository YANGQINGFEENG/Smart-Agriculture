/**
 * 检查数据库时区和时间
 */

import mysql from 'mysql2/promise'

async function checkDatabaseTime() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  try {
    const [timeResult] = await connection.execute(
      'SELECT NOW() as db_time, CURRENT_TIMESTAMP as current_ts, @@system_time_zone as system_tz, @@global.time_zone as global_tz'
    )
    
    console.log('📊 数据库时间信息:')
    console.log(JSON.stringify(timeResult, null, 2))

    const [jsTime] = await connection.execute(
      'SELECT ? as js_time',
      [new Date()]
    )
    
    console.log('\n📊 JavaScript时间:')
    console.log(JSON.stringify(jsTime, null, 2))

    console.log('\n📊 当前JavaScript时间:')
    console.log(new Date().toLocaleString('zh-CN'))
    console.log('时区:', Intl.DateTimeFormat().resolvedOptions().timeZone)

    console.log('\n📊 测试更新last_update字段...')
    
    await connection.execute(
      'UPDATE actuators SET last_update = NOW() WHERE id = ?',
      ['WP-002']
    )

    const [updatedActuator] = await connection.execute(
      'SELECT id, name, state, last_update FROM actuators WHERE id = ?',
      ['WP-002']
    )
    
    console.log('\n📊 更新后的执行器:')
    console.log(JSON.stringify(updatedActuator, null, 2))

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await connection.end()
  }
}

checkDatabaseTime()
