import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * DELETE /api/actuator-types/[id]
 * 删除执行器类型
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 检查是否有执行器使用该类型
    const actuators = await db.query<any[]>(
      'SELECT id FROM actuators WHERE type_id = ?',
      [id]
    )

    if (actuators.length > 0) {
      return NextResponse.json(
        { success: false, error: '该类型下存在执行器，无法删除' },
        { status: 400 }
      )
    }

    // 删除执行器类型
    await db.execute('DELETE FROM actuator_types WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: '执行器类型删除成功',
    })
  } catch (error) {
    console.error('删除执行器类型失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除执行器类型失败',
      details: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 })
  }
}