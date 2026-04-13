/**
 * 清理数据库中不合理的数据
 * 删除值为0的传感器数据
 * 
 * 使用方法：
 * npx tsx scripts/clean-invalid-data.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import mysql from 'mysql2/promise'

async function cleanInvalidData() {
  console.log('🧹 开始清理数据库中的无效数据...\n')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_agriculture',
  })

  console.log('✅ 数据库连接成功\n')

  try {
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as count FROM sensor_data WHERE value = 0'
    )
    const invalidCount = (countResult as any[])[0].count

    console.log(`📊 发现 ${invalidCount} 条值为0的无效数据\n`)

    if (invalidCount === 0) {
      console.log('✨ 数据库中没有无效数据，无需清理')
      return
    }

    console.log('🗑️  正在删除无效数据...')
    
    const [deleteResult] = await connection.query(
      'DELETE FROM sensor_data WHERE value = 0'
    )
    
    const deletedRows = (deleteResult as any).affectedRows
    console.log(`✅ 已删除 ${deletedRows} 条无效数据\n`)

    const [statsResult] = await connection.query(`
      SELECT 
        sensor_id,
        COUNT(*) as total_count,
        MIN(value) as min_value,
        MAX(value) as max_value,
        AVG(value) as avg_value
      FROM sensor_data
      GROUP BY sensor_id
      ORDER BY sensor_id
    `)

    console.log('📈 清理后各传感器数据统计：')
    console.log('─'.repeat(70))
    console.log('传感器ID\t数据量\t最小值\t最大值\t平均值')
    console.log('─'.repeat(70))
    
    for (const row of statsResult as any[]) {
      console.log(
        `${row.sensor_id}\t\t${row.total_count}\t${Number(row.min_value).toFixed(2)}\t${Number(row.max_value).toFixed(2)}\t${Number(row.avg_value).toFixed(2)}`
      )
    }
    console.log('─'.repeat(70))

    const [totalResult] = await connection.query(
      'SELECT COUNT(*) as count FROM sensor_data'
    )
    const totalCount = (totalResult as any[])[0].count
    console.log(`\n📊 数据库现有数据总量: ${totalCount} 条`)

    console.log('\n✨ 数据清理完成！')

  } catch (error) {
    console.error('❌ 清理数据时出错:', error)
    throw error
  } finally {
    await connection.end()
  }
}

cleanInvalidData().catch((error) => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})
