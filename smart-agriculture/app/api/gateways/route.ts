import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface Gateway extends RowDataPacket {
  id: number
  farm_id: number
  name: string
  gateway_type: string
  ip_address: string | null
  mac_address: string | null
  protocol: string | null
  status: string
}

/**
 * GET /api/gateways
 * 获取网关列表
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const farmId = url.searchParams.get('farm_id')

    let query = 'SELECT * FROM gateways'
    const params: any[] = []

    if (farmId) {
      query += ' WHERE farm_id = ?'
      params.push(parseInt(farmId))
    }

    query += ' ORDER BY created_at DESC'

    const gateways = await db.query<Gateway[]>(query, params)

    // 获取每个网关下的设备节点
    for (const gateway of gateways) {
      const nodes = await db.query<any[]>(
        'SELECT * FROM device_nodes WHERE gateway_id = ? ORDER BY name',
        [gateway.id]
      )
      gateway.nodes = nodes
    }

    return NextResponse.json({
      success: true,
      data: gateways,
      total: gateways.length,
    })
  } catch (error) {
    console.error('获取网关列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取网关列表失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gateways
 * 创建网关
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { farm_id, name, gateway_type, ip_address, mac_address, protocol } = body

    if (!farm_id || !name || !gateway_type) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      `INSERT INTO gateways (farm_id, name, gateway_type, ip_address, mac_address, protocol)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [farm_id, name, gateway_type, ip_address || null, mac_address || null, protocol || null]
    )

    const newId = (result as any).lastID || (result as any).insertId

    return NextResponse.json({
      success: true,
      data: { id: newId, name },
      message: '网关创建成功',
    })
  } catch (error) {
    console.error('创建网关失败:', error)
    return NextResponse.json(
      { success: false, error: '创建网关失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
