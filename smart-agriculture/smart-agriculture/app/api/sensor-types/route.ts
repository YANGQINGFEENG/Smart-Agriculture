import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * 传感器类型数据接口
 */
interface SensorType extends RowDataPacket {
  id: number
  type: string
  name: string
  unit: string
  created_at: Date
}

/**
 * GET /api/sensor-types
 * 获取所有传感器类型
 */
export async function GET() {
  try {
    const rows = await db.query<SensorType[]>(
      'SELECT id, type, name, unit, created_at FROM sensor_types ORDER BY id'
    )

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    })
  } catch (error) {
    console.error('获取传感器类型失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取传感器类型失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sensor-types
 * 新增传感器类型
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.type || !body.name || !body.unit) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：type, name, unit' },
        { status: 400 }
      )
    }

    const existingTypes = await db.query<SensorType[]>(
      'SELECT id FROM sensor_types WHERE type = ?',
      [body.type]
    )

    if (existingTypes.length > 0) {
      return NextResponse.json(
        { success: false, error: '传感器类型已存在' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
      [body.type, body.name, body.unit]
    )

    const newTypes = await db.query<SensorType[]>(
      'SELECT id, type, name, unit, created_at FROM sensor_types WHERE id = ?',
      [result.insertId]
    )

    return NextResponse.json({
      success: true,
      data: newTypes[0],
      message: '传感器类型创建成功',
    })
  } catch (error) {
    console.error('创建传感器类型失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '创建传感器类型失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
