/**
 * 模拟硬件上传执行器数据
 * 测试执行器状态更新和前端显示
 */

import mysql from 'mysql2/promise'

async function testActuatorUpdate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Yjh@437507',
    database: 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功')

  try {
    const testCases = [
      { id: 'WP-001', state: 1, mode: 0, description: 'A区温室1号水泵 - 开启 - 自动模式' },
      { id: 'WP-002', state: 0, mode: 1, description: 'B区温室2号水泵 - 关闭 - 手动模式' },
      { id: 'FN-001', state: 1, mode: 0, description: 'A区温室1号风扇 - 开启 - 自动模式' },
      { id: 'LT-001', state: 1, mode: 1, description: 'A区温室1号补光灯 - 开启 - 手动模式' },
    ]

    for (const testCase of testCases) {
      const stateValue = testCase.state === 1 ? 'on' : 'off'
      const modeValue = testCase.mode === 0 ? 'auto' : 'manual'
      
      await connection.execute(
        `UPDATE actuators 
         SET state = ?, mode = ?, last_update = NOW(), status = 'online'
         WHERE id = ?`,
        [stateValue, modeValue, testCase.id]
      )

      await connection.execute(
        `INSERT INTO actuator_status_history (actuator_id, state, mode, trigger_source, timestamp)
         VALUES (?, ?, ?, 'hardware', NOW())`,
        [testCase.id, stateValue, modeValue]
      )

      console.log(`✅ 更新执行器: ${testCase.description}`)
    }

    const [rows] = await connection.execute(
      `SELECT id, name, state, mode, status, last_update 
       FROM actuators 
       WHERE id IN ('WP-001', 'WP-002', 'FN-001', 'LT-001')`
    )

    console.log('\n📊 更新后的执行器状态:')
    console.log(JSON.stringify(rows, null, 2))

    console.log('\n✅ 测试完成！')
    console.log('💡 现在刷新浏览器页面，应该能看到执行器状态卡片')
    console.log('💡 开启的执行器应该显示为绿色，关闭的显示为灰色')

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await connection.end()
  }
}

testActuatorUpdate()
