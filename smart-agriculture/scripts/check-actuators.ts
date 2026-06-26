import { createConnection, Connection } from 'mysql2/promise'

async function checkActuators() {
  let connection: Connection | null = null
  
  try {
    // 创建数据库连接
    connection = await createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '123456',
      database: 'smart_agriculture'
    })

    console.log('数据库连接成功')

    // 查询所有执行器的状态
    const [rows] = await connection.query<Array<{
      id: string
      name: string
      state: string
      mode: string
      status: string
      locked: number
      last_update: Date | null
    }>>('SELECT id, name, state, mode, status, locked, last_update FROM actuators')

    console.log('执行器状态：')
    console.log('='.repeat(80))
    console.log('ID          | Name        | State | Mode  | Status  | Locked | Last Update')
    console.log('='.repeat(80))

    rows.forEach(actuator => {
      const lastUpdate = actuator.last_update 
        ? new Date(actuator.last_update).toLocaleString('zh-CN') 
        : 'N/A'
      
      console.log(`${actuator.id.padEnd(12)} | ${actuator.name.padEnd(12)} | ${actuator.state.padEnd(5)} | ${actuator.mode.padEnd(5)} | ${actuator.status.padEnd(7)} | ${actuator.locked ? 'Yes' : 'No'}`.padEnd(60) + ` | ${lastUpdate}`)
    })

    console.log('='.repeat(80))

    // 检查是否有被锁定的执行器
    const lockedActuators = rows.filter(a => a.locked === 1)
    if (lockedActuators.length > 0) {
      console.log(`\n发现 ${lockedActuators.length} 个被锁定的执行器：`)
      lockedActuators.forEach(a => {
        console.log(`- ${a.name} (${a.id}) - 锁定状态: ${a.locked}`)
      })
    } else {
      console.log('\n没有发现被锁定的执行器')
    }

  } catch (error) {
    console.error('检查执行器状态失败:', error)
  } finally {
    if (connection) {
      await connection.end()
      console.log('数据库连接已关闭')
    }
  }
}

checkActuators()
