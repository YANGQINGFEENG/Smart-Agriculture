import { NextRequest, NextResponse } from 'next/server'
import { db, ResultSetHeader } from '@/lib/db'

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

    // 先删除关联的设备节点
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

/**
 * PUT /api/gateways/[id]
 * 更新网关
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name) }
    if (body.gateway_type !== undefined) { updates.push('gateway_type = ?'); values.push(body.gateway_type) }
    if (body.ip_address !== undefined) { updates.push('ip_address = ?'); values.push(body.ip_address) }
    if (body.mac_address !== undefined) { updates.push('mac_address = ?'); values.push(body.mac_address) }
    if (body.protocol !== undefined) { updates.push('protocol = ?'); values.push(body.protocol) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }

    if (updates.length > 0) {
      values.push(id)
      await db.execute(
        `UPDATE gateways SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    return NextResponse.json({
      success: true,
      message: '网关更新成功',
    })
  } catch (error) {
    console.error('更新网关失败:', error)
    return NextResponse.json(
      { success: false, error: '更新网关失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
