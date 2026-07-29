import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getActuatorTypes } from '@/lib/device-types'

/**
 * 执行器类型数据接口
 */
interface ActuatorType extends RowDataPacket {
  id: number
  type: string
  name: string
  description: string | null
  created_at: Date
}

/**
 * GET /api/actuator-types
 * 获取所有执行器类型
 */
export async function GET(request: NextRequest) {
  try {
    // 从actuator_types表查询（与sensor-types保持一致）
    const actuatorTypes = await db.query<ActuatorType[]>(`
      SELECT id, type, name, description, created_at
      FROM actuator_types
      ORDER BY id
    `)

    return NextResponse.json({
      success: true,
      data: actuatorTypes,
      total: actuatorTypes.length,
      message: '获取执行器类型列表成功'
    }, { status: 200 })
  } catch (error) {
    console.error('获取执行器类型列表失败:', error)
    return NextResponse.json({
      success: false,
      message: '获取执行器类型列表失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}

/**
 * POST /api/actuator-types
 * 新增执行器类型
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, description } = body

    if (!type || !name) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：type, name' },
        { status: 400 }
      )
    }

    // 检查是否已存在
    const existing = await db.query<ActuatorType[]>(
      'SELECT id FROM actuator_types WHERE type = ?',
      [type]
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '执行器类型已存在' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      'INSERT INTO actuator_types (type, name, description) VALUES (?, ?, ?)',
      [type, name, description || null]
    )

    const newId = (result as any).lastID || (result as any).insertId
    const newType = await db.query<ActuatorType[]>('SELECT * FROM actuator_types WHERE id = ?', [newId])

    return NextResponse.json({
      success: true,
      data: newType[0],
      message: '执行器类型创建成功'
    }, { status: 201 })
  } catch (error) {
    console.error('创建执行器类型失败:', error)
    return NextResponse.json({
      success: false,
      message: '创建执行器类型失败',
      error: (error as Error).message
    }, { status: 500 })
  }
}