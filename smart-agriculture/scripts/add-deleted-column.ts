import { createConnection, Connection } from 'mysql2/promise'

async function addDeletedColumn() {
  let connection: Connection | null = null
  
  try {
    // 创建数据库连接
    connection = await createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'smart_agriculture'
    })

    console.log('数据库连接成功')

    // 为执行器表添加 deleted 字段
    await connection.query(`
      ALTER TABLE actuators 
      ADD COLUMN deleted TINYINT(1) DEFAULT 0,
      ADD INDEX idx_deleted (deleted)
    `)

    console.log('已成功为执行器表添加 deleted 字段')

    // 查看修改后的表结构
    const [result] = await connection.query('DESCRIBE actuators')
    console.log('修改后的表结构:')
    console.log(result)

  } catch (error) {
    console.error('添加 deleted 字段失败:', error)
  } finally {
    if (connection) {
      await connection.end()
      console.log('数据库连接已关闭')
    }
  }
}

addDeletedColumn()
