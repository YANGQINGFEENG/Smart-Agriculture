/**
 * 检查WP-002执行器的详细状态
 */

import mysql from 'mysql2/promise'

async function checkWP002() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  try {
    const [actuator] = await connection.execute(
      `SELECT id, name, state, mode, status, last_update 
       FROM actuators 
       WHERE id = 'WP-002'`
    )
    
    console.log('📊 WP-002 当前状态:')
    console.log(JSON.stringify(actuator, null, 2))

    const [history] = await connection.execute(
      `SELECT id, actuator_id, state, mode, trigger_source, timestamp 
       FROM actuator_status_history 
       WHERE actuator_id = 'WP-002' 
       ORDER BY timestamp DESC 
       LIMIT 10`
    )
    
    console.log('\n📊 WP-002 最近的状态历史:')
    history.forEach((h: any) => {
      console.log(`[${new Date(h.timestamp).toLocaleString('zh-CN')}] ${h.state} - ${h.mode} (${h.trigger_source})`)
    })

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await connection.end()
  }
}

checkWP002()
