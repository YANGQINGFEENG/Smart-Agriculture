import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { createLogger } from '@/lib/logger';

const log = createLogger('Heartbeat');

interface Gateway extends RowDataPacket {
  id: number
  farm_id: number
  name: string
  ip_address: string
}

/**
 * 设备心跳接口
 * 
 * 硬件端定期发送心跳，用于：
 * 1. 更新网关在线状态
 * 2. 更新最后心跳时间
 * 3. 确保网关保持在线状态
 * 
 * 请求格式：
 * {
 *   "gateway_ip": "192.168.1.100",
 *   "gateway_type": "wifi_sensor",
 *   "mac": "AA:BB:CC:DD:EE:FF",
 *   "farm_id": 1,
 *   "area": "温室1号区域"
 * }
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "message": "心跳成功",
 *   "gateway_id": 1,
 *   "area": "温室1号区域",
 *   "timestamp": "2026-07-26T10:30:00.000Z"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gateway_ip, gateway_type, mac, farm_id, area } = body

    if (!gateway_ip) {
      return NextResponse.json(
        { success: false, error: '缺少网关IP地址' },
        { status: 400 }
      )
    }

    // 查找网关（优先按IP，其次按MAC）
    let gateway = await db.query<Gateway[]>(
      'SELECT * FROM gateways WHERE ip_address = ? OR mac_address = ?',
      [gateway_ip, mac || '']
    )

    let gatewayId: number
    let farmId: number = farm_id || 0

    if (gateway.length === 0) {
      // 自动创建网关（需要farm_id）
      if (!farm_id) {
        return NextResponse.json(
          { success: false, error: '新设备需要指定farm_id' },
          { status: 400 }
        )
      }

      const result = await db.execute<any>(
        `INSERT INTO gateways (farm_id, name, gateway_type, ip_address, mac_address, status, area, last_heartbeat)
         VALUES (?, ?, ?, ?, ?, 'online', ?, ?)`,
        [farm_id, `自动发现-${gateway_ip}`, gateway_type || 'wifi_sensor', gateway_ip, mac || null, area || `区域-${gateway_ip}`, getBeijingTimeForDB()]
      )

      gatewayId = (result as any).lastID || (result as any).insertId
      farmId = farm_id

      log.info(`自动创建网关: ${gateway_ip}`)
    } else {
      gatewayId = gateway[0].id
      farmId = gateway[0].farm_id

      // 更新网关状态、最后心跳时间和区域信息
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = ?, area = ? WHERE id = ?',
        ['online', getBeijingTimeForDB(), area || gateway[0].area || `区域-${gateway_ip}`, gatewayId]
      )
    }

    return NextResponse.json({
      success: true,
      message: '心跳成功',
      gateway_id: gatewayId,
      farm_id: farmId,
      gateway_ip: gateway_ip,
      area: area || `区域-${gateway_ip}`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error('心跳处理失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '心跳处理失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * 获取网关心跳状态（GET方式，用于查询）
 * 
 * 请求参数：
 * - gateway_ip: 网关IP地址
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "name": "温室1号网关",
 *     "ip_address": "192.168.1.100",
 *     "status": "online",
 *     "last_heartbeat": "2026-07-26T10:30:00.000Z",
 *     "area": "温室1号区域"
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gateway_ip = searchParams.get('gateway_ip')

    if (!gateway_ip) {
      return NextResponse.json(
        { success: false, error: '缺少gateway_ip参数' },
        { status: 400 }
      )
    }

    const gateway = await db.query<Gateway[]>(
      'SELECT id, name, ip_address, mac_address, status, last_heartbeat, area FROM gateways WHERE ip_address = ?',
      [gateway_ip]
    )

    if (gateway.length === 0) {
      return NextResponse.json(
        { success: false, error: '网关不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: gateway[0],
    })
  } catch (error) {
    log.error('查询心跳状态失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '查询失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
