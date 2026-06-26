import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface DeviceNode extends RowDataPacket {
  id: number
  gateway_id: number
  node_id: string
  name: string
  node_type: string
  sensor_type: string | null
  location: string | null
  status: string
}

/**
 * GET /api/device-nodes
 * 获取设备节点列表
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const gatewayId = url.searchParams.get('gateway_id')
    const farmId = url.searchParams.get('farm_id')

    let query = `
      SELECT dn.*, g.name as gateway_name, g.farm_id
      FROM device_nodes dn
      INNER JOIN gateways g ON dn.gateway_id = g.id
    `
    const conditions: string[] = []
    const params: any[] = []

    if (gatewayId) {
      conditions.push('dn.gateway_id = ?')
      params.push(parseInt(gatewayId))
    }
    if (farmId) {
      conditions.push('g.farm_id = ?')
      params.push(parseInt(farmId))
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY dn.name'

    const rows = await db.query<DeviceNode[]>(query, params)

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
    })
  } catch (error) {
    console.error('获取设备节点列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取设备节点列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/device-nodes
 * 创建设备节点
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gateway_id, node_id, name, node_type, sensor_type, location } = body

    if (!gateway_id || !node_id || !name) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 检查是否已存在
    const existing = await db.query<DeviceNode[]>(
      'SELECT id FROM device_nodes WHERE gateway_id = ? AND node_id = ?',
      [gateway_id, node_id]
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '设备节点已存在' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO device_nodes (gateway_id, node_id, name, node_type, sensor_type, location)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [gateway_id, node_id, name, node_type || 'sensor', sensor_type || null, location || null]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: { id: newId, name },
      message: '设备节点创建成功',
    })
  } catch (error) {
    console.error('创建设备节点失败:', error)
    return NextResponse.json(
      { success: false, error: '创建设备节点失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
