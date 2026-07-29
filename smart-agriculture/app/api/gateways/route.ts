import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getDeviceTypeConfig } from '@/lib/device-types'

interface Gateway extends RowDataPacket {
  id: number
  farm_id: number
  name: string
  gateway_type: string
  ip_address: string | null
  mac_address: string | null
  protocol: string | null
  status: string
  nodes?: DeviceNode[]
}

interface DeviceNode extends RowDataPacket {
  id: number
  gateway_id: number
  node_id: string
  name: string
  node_type: 'sensor' | 'actuator'
  sensor_type: string | null
  location: string | null
  status: string
  last_update: string | null
  // 传感器特有字段
  value?: number
  unit?: string
  battery?: number
  signal_strength?: number
  // 执行器特有字段
  state?: 'on' | 'off'
  mode?: 'auto' | 'manual'
}

/**
 * GET /api/gateways
 * 获取网关列表（包含完整设备节点数据）
 * 
 * 返回每个网关下的设备节点，并关联sensors/actuators表获取最新数据
 * 传感器返回：当前数值、单位、电量、信号强度
 * 执行器返回：开关状态、控制模式
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

    // 获取每个网关下的设备节点（包含完整数据）
    for (const gateway of gateways) {
      const nodes = await getGatewayNodesWithData(gateway.id)
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
 * 获取网关下的所有设备节点，并关联sensors/actuators表获取最新数据
 */
async function getGatewayNodesWithData(gatewayId: number): Promise<DeviceNode[]> {
  // 获取设备节点基础信息
  const nodes = await db.query<any[]>(
    'SELECT * FROM device_nodes WHERE gateway_id = ? ORDER BY name',
    [gatewayId]
  )

  // 为每个节点获取关联数据
  const nodesWithData: DeviceNode[] = []
  
  for (const node of nodes) {
    const nodeWithData: DeviceNode = {
      id: node.id,
      gateway_id: node.gateway_id,
      node_id: node.node_id,
      name: node.name,
      node_type: node.node_type,
      sensor_type: node.sensor_type,
      location: node.location,
      status: node.status,
      last_update: node.last_update,
    }

    // 根据设备类别获取不同数据
    if (node.node_type === 'sensor') {
      // 从sensors表获取传感器信息
      const sensors = await db.query<any[]>(
        'SELECT battery, status FROM sensors WHERE id LIKE ? OR name = ? LIMIT 1',
        [`%-${gatewayId}-%`, node.name]
      )
      
      if (sensors.length > 0) {
        nodeWithData.battery = sensors[0].battery
        nodeWithData.status = sensors[0].status
      }

      // 获取最新的传感器数据
      const latestData = await db.query<any[]>(
        `SELECT sd.value, sd.timestamp 
         FROM sensor_data sd
         INNER JOIN sensors s ON sd.sensor_id = s.id
         WHERE s.id LIKE ? OR s.name = ?
         ORDER BY sd.timestamp DESC
         LIMIT 1`,
        [`%-${gatewayId}-%`, node.name]
      )

      if (latestData.length > 0) {
        nodeWithData.value = latestData[0].value
        nodeWithData.last_update = latestData[0].timestamp
        
        // 获取单位
        const deviceConfig = getDeviceTypeConfig(node.sensor_type || '')
        nodeWithData.unit = deviceConfig?.unit || ''
      }

    } else if (node.node_type === 'actuator') {
      // 从actuators表获取执行器信息
      const actuators = await db.query<any[]>(
        'SELECT state, mode, status FROM actuators WHERE id LIKE ? OR name = ? LIMIT 1',
        [`%-${gatewayId}-%`, node.name]
      )

      if (actuators.length > 0) {
        nodeWithData.state = actuators[0].state
        nodeWithData.mode = actuators[0].mode
        nodeWithData.status = actuators[0].status
      }
    }

    nodesWithData.push(nodeWithData)
  }

  return nodesWithData
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

