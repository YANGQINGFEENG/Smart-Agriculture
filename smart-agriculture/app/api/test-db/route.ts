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
            database: process.env.SQLITE_DB_PATH || './smart_agriculture.db',
          }
        },
        { status: 500 }
      )
    }

    // SQLite获取表列表的方法
    const tables = await db.query<any[]>(
      `SELECT name FROM sqlite_master WHERE type='table'`
    )

    let sensorTypesCount = 0
    let sensorsCount = 0
    let sensorDataCount = 0

    try {
      const sensorTypesResult = await db.query<any[]>(
        'SELECT COUNT(*) as count FROM sensor_types'
      )
      sensorTypesCount = sensorTypesResult[0]?.count || 0
    } catch (error) {
      // 表可能还不存在
    }

    try {
      const sensorsResult = await db.query<any[]>(
        'SELECT COUNT(*) as count FROM sensors'
      )
      sensorsCount = sensorsResult[0]?.count || 0
    } catch (error) {
      // 表可能还不存在
    }

    try {
      const sensorDataResult = await db.query<any[]>(
        'SELECT COUNT(*) as count FROM sensor_data'
      )
      sensorDataCount = sensorDataResult[0]?.count || 0
    } catch (error) {
      // 表可能还不存在
    }

    return NextResponse.json({
      success: true,
      message: '数据库连接成功',
      config: {
        database: process.env.SQLITE_DB_PATH || './smart_agriculture.db',
      },
      tables: tables.map(t => t.name),
      statistics: {
        sensorTypes: sensorTypesCount,
        sensors: sensorsCount,
        sensorData: sensorDataCount,
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
          database: process.env.SQLITE_DB_PATH || './smart_agriculture.db',
        }
      },
      { status: 500 }
    )
  }
}
