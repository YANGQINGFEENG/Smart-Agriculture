import { NextRequest, NextResponse } from 'next/server'
import { db, ResultSetHeader } from '@/lib/db'

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