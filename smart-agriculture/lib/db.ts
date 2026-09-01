// 数据库连接模块 - 动态选择数据库类型
import { db as mysqlDb } from './db-mysql'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

// 根据环境变量选择数据库类型（默认 MySQL）
const databaseType = process.env.DATABASE_TYPE || 'mysql'

// 延迟加载 SQLite 模块，仅在运行时需要时动态导入
// 避免构建时静态分析引入 sqlite3 原生模块导致打包失败
let _cachedDb: any = null

function getDb() {
  if (_cachedDb) return _cachedDb
  
  if (databaseType === 'sqlite') {
    // 使用 eval 包装 require，避免 Turbopack/webpack 静态分析
    // 仅在 SQLite 模式下加载，生产环境使用 MySQL 不会触发此路径
    const sqliteMod = eval('require')('./db-sqlite')
    _cachedDb = sqliteMod.db
    return _cachedDb
  }
  
  _cachedDb = mysqlDb
  return _cachedDb
}

// 导出数据库连接对象（兼容同步调用）
export const db = {
  query: async <T>(sql: string, params?: any[]) => {
    return getDb().query<T>(sql, params)
  },
  execute: async <T>(sql: string, params?: any[]) => {
    return getDb().execute<T>(sql, params)
  },
  executeWithRetry: async <T>(sql: string, params?: any[], maxRetries?: number) => {
    return getDb().executeWithRetry<T>(sql, params, maxRetries)
  },
  testConnection: async () => {
    return getDb().testConnection()
  }
}

// 导出类型
export type { RowDataPacket, ResultSetHeader }