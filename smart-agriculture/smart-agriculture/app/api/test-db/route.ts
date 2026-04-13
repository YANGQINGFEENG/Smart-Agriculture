import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/test-db
 * 测试数据库连接
 * 用于健康检查和调试
 */
export async function GET() {
  try {
    const isConnected = await db.testConnection()
    
    if (!isConnected) {
      return NextResponse.json(
        {
          success: false,
          error: '数据库连接失败',
          config: {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || '3306',
            database: process.env.DB_NAME || 'smart_agriculture',
            user: process.env.DB_USER || 'root',
          }
        },
        { status: 500 }
      )
    }

    const tables = await db.query<any[]>(
      `SELECT TABLE_NAME 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ?`,
      [process.env.DB_NAME || 'smart_agriculture']
    )

    const sensorTypesCount = await db.query<any[]>(
      'SELECT COUNT(*) as count FROM sensor_types'
    )

    const sensorsCount = await db.query<any[]>(
      'SELECT COUNT(*) as count FROM sensors'
    )

    const sensorDataCount = await db.query<any[]>(
      'SELECT COUNT(*) as count FROM sensor_data'
    )

    return NextResponse.json({
      success: true,
      message: '数据库连接成功',
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '3306',
        database: process.env.DB_NAME || 'smart_agriculture',
        user: process.env.DB_USER || 'root',
      },
      tables: tables.map(t => t.TABLE_NAME),
      statistics: {
        sensorTypes: sensorTypesCount[0]?.count || 0,
        sensors: sensorsCount[0]?.count || 0,
        sensorData: sensorDataCount[0]?.count || 0,
      }
    })
  } catch (error) {
    console.error('数据库测试失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '数据库测试失败',
        details: error instanceof Error ? error.message : '未知错误',
        config: {
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || '3306',
          database: process.env.DB_NAME || 'smart_agriculture',
          user: process.env.DB_USER || 'root',
        }
      },
      { status: 500 }
    )
  }
}
