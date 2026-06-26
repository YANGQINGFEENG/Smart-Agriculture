// 数据库连接模块 - 使用MySQL
import mysql, { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: mysql.Pool | null = null;

async function initDatabase() {
  if (pool) return pool;

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'smart123',
      database: process.env.DB_NAME || 'smart_agriculture',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 测试连接
    await pool.getConnection();
    console.log('MySQL数据库连接成功');
    return pool;
  } catch (error) {
    console.error('MySQL数据库连接失败:', error);
    throw error;
  }
}

// 测试连接
async function testConnection() {
  try {
    const pool = await initDatabase();
    await pool.getConnection();
    return true;
  } catch (error) {
    console.error('数据库连接测试失败:', error);
    return false;
  }
}

// 导出数据库连接对象
export const db = {
  query: async <T>(sql: string, params?: any[]) => {
    const pool = await initDatabase();
    const [results] = await pool.query<T & RowDataPacket[]>(sql, params);
    return results;
  },
  execute: async <T>(sql: string, params?: any[]) => {
    const pool = await initDatabase();
    const [result] = await pool.execute<T & ResultSetHeader>(sql, params);
    return result;
  },
  executeWithRetry: async <T>(sql: string, params?: any[], maxRetries: number = 3): Promise<T> => {
    const pool = await initDatabase();
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [result] = await pool.execute<T & ResultSetHeader>(sql, params);
        return result as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }
      }
    }
    throw lastError;
  },
  testConnection
};

// 导出类型
export type { RowDataPacket, ResultSetHeader };