import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

interface Gateway extends RowDataPacket {
  id: number
  farm_id: number
  name: string
}

interface DeviceNode extends RowDataPacket {
  id: number
  gateway_id: number
  node_id: string
}

/**
 * POST /api/device/report
 * 设备数据上报（支持自动发现和注册）
 * 
 * 场景1：WiFi直连传感器
 * {
 *   "gateway_ip": "192.168.1.101",
 *   "gateway_type": "wifi_sensor",
 *   "mac": "AA:BB:CC:DD:EE:FF",
 *   "data": [{"type": "temperature", "value": 25.5, "unit": "°C"}]
 * }
 * 
 * 场景2：网关聚合上报
 * {
 *   "gateway_ip": "192.168.1.100",
 *   "gateway_type": "lorawan_gateway",
 *   "mac": "11:22:33:44:55:66",
 *   "nodes": [
 *     {"node_id": "sensor_001", "type": "temperature", "value": 24.5}
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gateway_ip, gateway_type, mac, farm_id, nodes, data } = body

    if (!gateway_ip) {
      return NextResponse.json(
        { success: false, error: '缺少网关IP地址' },
        { status: 400 }
      )
    }

    // 1. 查找或创建网关
    let gateway = await db.query<Gateway[]>(
      'SELECT * FROM gateways WHERE ip_address = ? OR mac_address = ?',
      [gateway_ip, mac || '']
    )

    if (gateway.length === 0) {
      // 自动创建网关（需要farm_id）
      if (!farm_id) {
        return NextResponse.json(
          { success: false, error: '新设备需要指定farm_id' },
          { status: 400 }
        )
      }

      const result = await db.execute<any>(
        `INSERT INTO gateways (farm_id, name, gateway_type, ip_address, mac_address, status)
         VALUES (?, ?, ?, ?, ?, 'online')`,
        [farm_id, `自动发现-${gateway_ip}`, gateway_type || 'wifi_sensor', gateway_ip, mac || null]
      )

      const newGatewayId = (result as any).lastID || (result as any).insertId
      gateway = await db.query<Gateway[]>('SELECT * FROM gateways WHERE id = ?', [newGatewayId])
      
      console.log(`自动创建网关: ${gateway_ip}`)
    } else {
      // 更新网关状态
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?',
        ['online', gateway[0].id]
      )
    }

    const gatewayId = gateway[0].id

    // 2. 处理设备节点数据
    if (nodes && Array.isArray(nodes)) {
      // 场景2：网关聚合上报
      for (const node of nodes) {
        await processNodeData(gatewayId, node)
      }
    } else if (data && Array.isArray(data)) {
      // 场景1：WiFi直连传感器，数据直接作为节点
      await processNodeData(gatewayId, {
        node_id: mac || gateway_ip,
        name: `${gateway_type || '传感器'}-${gateway_ip}`,
        type: data[0]?.type || 'unknown',
        value: data[0]?.value,
        unit: data[0]?.unit,
      })
    }

    return NextResponse.json({
      success: true,
      message: '数据上报成功',
      gateway_id: gatewayId,
    })
  } catch (error) {
    console.error('设备数据上报失败:', error)
    return NextResponse.json(
      { success: false, error: '数据上报失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 处理设备节点数据
 */
async function processNodeData(gatewayId: number, nodeData: any) {
  const { node_id, name, type, value, unit, location } = nodeData

  if (!node_id) return

  // 查找或创建设备节点
  let node = await db.query<DeviceNode[]>(
    'SELECT * FROM device_nodes WHERE gateway_id = ? AND node_id = ?',
    [gatewayId, node_id]
  )

  if (node.length === 0) {
    // 自动创建设备节点
    await db.execute(
      `INSERT INTO device_nodes (gateway_id, node_id, name, node_type, sensor_type, location, status)
       VALUES (?, ?, ?, 'sensor', ?, ?, 'online')`,
      [gatewayId, node_id, name || `设备-${node_id}`, type || null, location || null]
    )
    console.log(`自动创建设备节点: ${node_id}`)
  } else {
    // 更新设备状态
    await db.execute(
      'UPDATE device_nodes SET status = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?',
      ['online', node[0].id]
    )
  }

  // 存储数据（如果有值）
  if (value !== undefined && value !== null) {
    await db.execute(
      `INSERT INTO device_data (gateway_id, node_id, sensor_type, value, unit)
       VALUES (?, ?, ?, ?, ?)`,
      [gatewayId, node_id, type || 'unknown', value, unit || null]
    )
  }
}
