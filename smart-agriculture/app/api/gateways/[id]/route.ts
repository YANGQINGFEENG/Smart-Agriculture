import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

/**
 * DELETE /api/gateways/[id]
 * 删除网关
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 删除关联的设备节点
    await db.execute('DELETE FROM device_nodes WHERE gateway_id = ?', [id])

    // 删除网关
    await db.execute('DELETE FROM gateways WHERE id = ?', [id])

    return NextResponse.json({
      success: true,
      message: '网关删除成功',
    })
  } catch (error) {
    console.error('删除网关失败:', error)
    return NextResponse.json(
      { success: false, error: '删除网关失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}