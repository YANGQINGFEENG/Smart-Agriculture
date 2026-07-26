import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getSensorTypes } from '@/lib/device-types'

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
export async function GET(request: NextRequest) {
  try {
    // 从sensor_types表查询（正确的数据源）
    const sensorTypes = await db.query<SensorType[]>(`
      SELECT id, type, name, unit, created_at
      FROM sensor_types
      ORDER BY id
    `)

    return NextResponse.json({
      success: true,
      data: sensorTypes,
      total: sensorTypes.length,
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

/**
 * POST /api/sensor-types
 * 新增传感器类型
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, unit } = body

    if (!type || !name || !unit) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：type, name, unit' },
        { status: 400 }
      )
    }

    // 检查是否已存在
    const existing = await db.query<SensorType[]>(
      'SELECT id FROM sensor_types WHERE type = ?',
      [type]
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '传感器类型已存在' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      'INSERT INTO sensor_types (type, name, unit) VALUES (?, ?, ?)',
      [type, name, unit]
    )

    const newId = (result as any).lastID || (result as any).insertId
    const newType = await db.query<SensorType[]>('SELECT * FROM sensor_types WHERE id = ?', [newId])

    return NextResponse.json({
      success: true,
      data: newType[0],
      message: '传感器类型创建成功'
    }, { status: 201 })
  } catch (error) {
    console.error('创建传感器类型失败:', error)
    return NextResponse.json({
      success: false,
      message: '创建传感器类型失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}

/**
 * DELETE /api/sensor-types/[id]
 * 删除传感器类型
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 检查是否有传感器使用该类型
    const sensors = await db.query<any[]>(
      'SELECT id FROM sensors WHERE type_id = ?',
      [id]
    )

    if (sensors.length > 0) {
      return NextResponse.json(
        { success: false, error: '该类型下存在传感器，无法删除' },
        { status: 400 }
      )
    }

    await db.execute('DELETE FROM sensor_types WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: '传感器类型删除成功'
    }, { status: 200 })
  } catch (error) {
    console.error('删除传感器类型失败:', error)
    return NextResponse.json({
      success: false,
      message: '删除传感器类型失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}