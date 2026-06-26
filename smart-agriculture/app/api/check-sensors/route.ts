import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

/**
 * 检查传感器表结构和数据
 */
export async function GET(request: NextRequest) {
  try {
    // 检查传感器表是否存在
    const [tables] = await db.query<RowDataPacket[]>(`
      SHOW TABLES LIKE 'sensors'
    `)

    if (tables.length === 0) {
      return NextResponse.json({
        success: false,
        message: '传感器表不存在'
      }, { status: 404 })
    }

    // 检查传感器表结构
    const [columns] = await db.query<RowDataPacket[]>(`
      SHOW COLUMNS FROM sensors
    `)

    // 检查传感器数据
    const [sensors] = await db.query<RowDataPacket[]>(`
      SELECT id, type, name, unit, location
      FROM sensors
      LIMIT 10
    `)

    // 检查传感器类型
    const [sensorTypes] = await db.query<RowDataPacket[]>(`
      SELECT DISTINCT type, name, unit
      FROM sensors
      ORDER BY type
    `)

    return NextResponse.json({
      success: true,
      data: {
        tableExists: tables.length > 0,
        columns,
        sensors,
        sensorTypes
      },
      message: '检查传感器表成功'
    }, { status: 200 })
  } catch (error) {
    console.error('检查传感器表失败:', error)
    return NextResponse.json({
      success: false,
      message: '检查传感器表失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}
