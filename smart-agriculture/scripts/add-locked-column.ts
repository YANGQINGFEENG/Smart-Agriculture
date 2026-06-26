/**
 * 为执行器表添加 locked 字段
 * 用于实现执行器操作锁定机制
 * 
 * 使用方法：
 * npx tsx scripts/add-locked-column.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function addLockedColumn() {
  console.log('🚀 开始为执行器表添加 locked 字段...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功')

  try {
    // 添加 locked 字段
    console.log('📝 添加 locked 字段到执行器表...')
    await connection.query(`
      ALTER TABLE actuators 
      ADD COLUMN locked TINYINT(1) DEFAULT 0,
      ADD INDEX idx_locked (locked)
    `)
    console.log('✅ locked 字段添加成功')

    // 验证字段是否添加成功
    const [columns] = await connection.query(
      'SHOW COLUMNS FROM actuators'
    )
    console.log('\n📊 执行器表结构：')
    console.table(columns)

    console.log('\n✅ 操作完成！')

  } catch (error) {
    console.error('❌ 添加失败:', error)
    throw error
  } finally {
    await connection.end()
  }
}

addLockedColumn().catch(console.error)
