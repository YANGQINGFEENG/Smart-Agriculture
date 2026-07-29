import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

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