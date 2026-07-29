import { NextRequest, NextResponse } from 'next/server'
import { db, ResultSetHeader, RowDataPacket } from '@/lib/db'

/**
 * PUT /api/sensors/[id]
 * 更新传感器信息
 * 支持更新：name（名称）、location（位置）、area（区域）、status（状态）等字段
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // 检查传感器是否存在
    const existing = await db.query<RowDataPacket[]>(
      'SELECT id FROM sensors WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '传感器不存在' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    // 允许更新的字段
    if (body.name !== undefined && body.name !== null) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.location !== undefined && body.location !== null) {
      updates.push('location = ?')
      values.push(body.location)
    }
    if (body.area !== undefined) {
      updates.push('area = ?')
      values.push(body.area)
    }
    if (body.status !== undefined && body.status !== null) {
      updates.push('status = ?')
      values.push(body.status)
    }
    if (body.unit !== undefined && body.unit !== null) {
      updates.push('unit = ?')
      values.push(body.unit)
    }
    if (body.battery !== undefined && body.battery !== null) {
      updates.push('battery = ?')
      values.push(body.battery)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有提供需要更新的字段' },
        { status: 400 }
      )
    }

    values.push(id)
    await db.execute(
      `UPDATE sensors SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // 获取更新后的传感器信息
    const updatedSensor = await db.query<RowDataPacket[]>(
      'SELECT s.id, s.name, s.type_id, s.location, s.status, s.battery, s.last_update, st.type, st.name as type_name, st.unit FROM sensors s INNER JOIN sensor_types st ON s.type_id = st.id WHERE s.id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      data: updatedSensor[0],
      message: '传感器信息更新成功',
    })
  } catch (error) {
    console.error('更新传感器失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新传感器失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sensors/[id]
 * 删除传感器（同时删除关联的传感器数据）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 先删除关联的传感器数据
    await db.execute('DELETE FROM sensor_data WHERE sensor_id = ?', [id])

    // 删除传感器记录
    const result = await db.execute<ResultSetHeader>(
      'DELETE FROM sensors WHERE id = ?',
      [id]
    )

    const affectedRows = (result as any).affectedRows || 0

    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: '传感器不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '传感器删除成功',
    })
  } catch (error) {
    console.error('删除传感器失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '删除传感器失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}