import { db } from '@/lib/db'

/**
 * 执行SQL文件
 * @param filePath SQL文件路径
 */
async function executeSqlFile(filePath: string): Promise<void> {
  const fs = await import('fs/promises')
  const path = await import('path')
  
  try {
    // 读取SQL文件内容
    const sqlContent = await fs.readFile(path.resolve(filePath), 'utf8')
    
    // 分割SQL语句
    const sqlStatements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0)
    
    // 执行每个SQL语句
    for (const statement of sqlStatements) {
      await db.execute(statement)
      console.log(`执行SQL语句成功: ${statement.substring(0, 50)}...`)
    }
    
    console.log('策略表和执行日志表创建成功！')
  } catch (error) {
    console.error('创建策略表失败:', error)
    throw error
  }
}

// 执行脚本
executeSqlFile('./scripts/create-strategy-table.sql')
  .then(() => {
    console.log('脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
