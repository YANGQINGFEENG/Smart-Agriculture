import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

/**
 * 获取传感器类型列表
 */
export async function GET(request: NextRequest) {
  try {
    // 获取所有传感器类型
    const [sensorTypes] = await db.query<RowDataPacket[]>(`
      SELECT DISTINCT type, name, unit
      FROM sensors
      ORDER BY type
    `)

    return NextResponse.json({
      success: true,
      data: sensorTypes,
      message: '获取传感器类型列表成功'
    }, { status: 200 })
  } catch (error) {
    console.error('获取传感器类型列表失败:', error)
    return NextResponse.json({
      success: false,
      message: '获取传感器类型列表失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}
