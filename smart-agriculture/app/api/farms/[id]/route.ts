import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface Farm extends RowDataPacket {
  id: number
  name: string
  code: string
}

/**
 * GET /api/farms/[id]
 * 获取基地详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await db.query<Farm[]>(
      'SELECT * FROM farms WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '基地不存在' },
        { status: 404 }
      )
    }

    // 获取基地下的区域
    const zones = await db.query<any[]>(
      'SELECT * FROM zones WHERE farm_id = ? ORDER BY name',
      [id]
    )

    // 获取基地下的设备统计
    const sensorCount = await db.query<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM sensors WHERE farm_id = ?',
      [id]
    )

    const actuatorCount = await db.query<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM actuators WHERE farm_id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...rows[0],
        zones,
        stats: {
          zones: zones.length,
          sensors: sensorCount[0]?.count || 0,
          actuators: actuatorCount[0]?.count || 0,
        },
      },
    })
  } catch (error) {
    console.error('获取基地详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取基地详情失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/farms/[id]
 * 更新基地
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.query<Farm[]>(
      'SELECT id FROM farms WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '基地不存在' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
    if (body.address !== undefined) { updates.push('address = ?'); values.push(body.address) }
    if (body.latitude !== undefined) { updates.push('latitude = ?'); values.push(body.latitude) }
    if (body.longitude !== undefined) { updates.push('longitude = ?'); values.push(body.longitude) }
    if (body.area !== undefined) { updates.push('area = ?'); values.push(body.area) }
    if (body.farm_type !== undefined) { updates.push('farm_type = ?'); values.push(body.farm_type) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }
    
    updates.push('updated_at = CURRENT_TIMESTAMP')

    if (updates.length > 0) {
      values.push(id)
      await db.execute(
        `UPDATE farms SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    return NextResponse.json({
      success: true,
      message: '基地更新成功',
    })
  } catch (error) {
    console.error('更新基地失败:', error)
    return NextResponse.json(
      { success: false, error: '更新基地失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/farms/[id]
 * 删除基地
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.query<Farm[]>(
      'SELECT id FROM farms WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '基地不存在' },
        { status: 404 }
      )
    }

    await db.execute('DELETE FROM farms WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: '基地删除成功',
    })
  } catch (error) {
    console.error('删除基地失败:', error)
    return NextResponse.json(
      { success: false, error: '删除基地失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
