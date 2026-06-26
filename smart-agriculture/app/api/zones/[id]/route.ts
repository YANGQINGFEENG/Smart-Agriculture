import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface Zone extends RowDataPacket {
  id: number
  farm_id: number
  name: string
  code: string
}

/**
 * GET /api/zones/[id]
 * 获取区域详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await db.query<Zone[]>(
      'SELECT * FROM zones WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '区域不存在' },
        { status: 404 }
      )
    }

    // 获取区域下的监控点
    const monitorPoints = await db.query<any[]>(
      'SELECT * FROM monitor_points WHERE zone_id = ? ORDER BY name',
      [id]
    )

    // 获取区域下的设备
    const sensors = await db.query<any[]>(
      'SELECT * FROM sensors WHERE zone_id = ?',
      [id]
    )

    const actuators = await db.query<any[]>(
      'SELECT * FROM actuators WHERE zone_id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...rows[0],
        monitor_points: monitorPoints,
        sensors,
        actuators,
        stats: {
          monitor_points: monitorPoints.length,
          sensors: sensors.length,
          actuators: actuators.length,
        },
      },
    })
  } catch (error) {
    console.error('获取区域详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取区域详情失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/zones/[id]
 * 更新区域
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.query<Zone[]>(
      'SELECT id FROM zones WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '区域不存在' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
    if (body.zone_type !== undefined) { updates.push('zone_type = ?'); values.push(body.zone_type) }
    if (body.area !== undefined) { updates.push('area = ?'); values.push(body.area) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }

    if (updates.length > 0) {
      values.push(id)
      await db.execute(
        `UPDATE zones SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    return NextResponse.json({
      success: true,
      message: '区域更新成功',
    })
  } catch (error) {
    console.error('更新区域失败:', error)
    return NextResponse.json(
      { success: false, error: '更新区域失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/zones/[id]
 * 删除区域
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.query<Zone[]>(
      'SELECT id FROM zones WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '区域不存在' },
        { status: 404 }
      )
    }

    await db.execute('DELETE FROM zones WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: '区域删除成功',
    })
  } catch (error) {
    console.error('删除区域失败:', error)
    return NextResponse.json(
      { success: false, error: '删除区域失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
