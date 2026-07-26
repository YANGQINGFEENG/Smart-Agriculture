import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { syncDevice } from '@/lib/device-sync'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { DeviceCategory, isSensorType, isActuatorType, getDeviceTypeConfig, getUnassignedDeviceType, ControlType } from '@/lib/device-types'

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
 * 执行器控制类型枚举（硬件上报时使用）
 * 用于标识执行器支持的控制方式，服务器根据此自动加载对应控制卡片
 */
export enum NodeControlType {
  BOOLEAN = 'boolean',    // 布尔值控制（on/off）- LED开关、继电器、水泵等
  INTEGER = 'integer',    // 整数值控制（0-100）- 电机速度、亮度调节等
  ANGLE = 'angle',        // 角度控制（0-180/360）- 舵机角度等
  FLOAT = 'float',        // 浮点值控制 - 精确参数调节
  STRING = 'string',      // 字符串指令 - 自定义指令
}

/**
 * 上报数据节点接口
 * 硬件端上报的单个设备节点数据
 */
interface ReportNode {
  node_id: string                        // 设备节点唯一标识（MAC地址或序列号）
  name?: string                          // 设备名称（可选，自动生成）
  type: string                           // 设备类型（必须匹配DEVICE_TYPES中的type）
  value?: number                         // 传感器数值（传感器必填）
  unit?: string                          // 单位（可选，使用类型字典中的默认值）
  location?: string                      // 安装位置（可选）
  area?: string                          // 区域名称（可选，可覆盖网关级区域设置）
  state?: 'on' | 'off'                   // 执行器状态（执行器必填）
  mode?: 'auto' | 'manual'               // 执行器模式（可选，默认auto）
  control_value?: number                 // 执行器当前控制值（如电机速度、舵机角度）
  control_type?: NodeControlType         // 执行器控制类型（可选，服务器根据此自动加载对应控制卡片）
  control_range?: {                      // 执行器控制参数范围（可选）
    min: number                          // 最小值
    max: number                          // 最大值
    step: number                         // 步进值
    default: number                      // 默认值
  }
  firmware_version?: string              // 固件版本（可选）
  signal_strength?: number               // 信号强度（可选，0-100）
  battery_level?: number                 // 电池电量（可选，0-100）
}

/**
 * 设备数据上报协议
 * 
 * 统一上报协议，支持三种场景：
 * 
 * 场景1：独立传感器直接上报
 * {
 *   "gateway_ip": "192.168.1.101",
 *   "gateway_type": "wifi_sensor",
 *   "mac": "AA:BB:CC:DD:EE:FF",
 *   "farm_id": 1,
 *   "area": "A区温室",      // 区域名称（可选，同一IP地址下的设备默认属于同一区域）
 *   "nodes": [
 *     {
 *       "node_id": "AA:BB:CC:DD:EE:FF",
 *       "type": "temperature",
 *       "value": 25.5,
 *       "unit": "°C",
 *       "location": "1号传感器"
 *     }
 *   ]
 * }
 * 
 * 场景2：网关聚合上报多个传感器和执行器（包含控制类型）
 * {
 *   "gateway_ip": "192.168.1.100",
 *   "gateway_type": "lorawan_gateway",
 *   "mac": "11:22:33:44:55:66",
 *   "farm_id": 1,
 *   "area": "B区大棚",      // 整个网关所属区域
 *   "nodes": [
 *     {"node_id": "sensor_001", "type": "temperature", "value": 24.5, "location": "北侧"},
 *     {"node_id": "sensor_002", "type": "soil_moisture", "value": 45.2, "location": "南侧"},
 *     {"node_id": "motor_001", "type": "motor", "state": "on", "control_value": 60, "control_type": "integer", "control_range": {"min": 0, "max": 100, "step": 5, "default": 0}, "location": "水泵房"},
 *     {"node_id": "servo_001", "type": "servo", "state": "on", "control_value": 90, "control_type": "angle", "control_range": {"min": 0, "max": 180, "step": 1, "default": 90}, "location": "阀门组"}
 *   ]
 * }
 * 
 * 场景3：执行器状态上报（包含完整控制信息）
 * {
 *   "gateway_ip": "192.168.1.100",
 *   "gateway_type": "serial_gateway",
 *   "mac": "11:22:33:44:55:66",
 *   "farm_id": 1,
 *   "area": "C区温室",
 *   "nodes": [
 *     {
 *       "node_id": "pump_001",
 *       "type": "water_pump",
 *       "state": "on",
 *       "mode": "auto",
 *       "location": "1号水泵",
 *       "control_value": 100,
 *       "control_type": "boolean"      // 布尔值控制
 *     },
 *     {
 *       "node_id": "servo_001",
 *       "type": "servo",
 *       "state": "on",
 *       "mode": "manual",
 *       "location": "遮阳板舵机",
 *       "control_value": 45,           // 当前舵机角度
 *       "control_type": "angle",       // 角度控制
 *       "control_range": {"min": 0, "max": 180, "step": 1, "default": 90}
 *     },
 *     {
 *       "node_id": "fan_001",
 *       "type": "fan",
 *       "state": "on",
 *       "mode": "manual",
 *       "location": "通风扇",
 *       "control_value": 75,           // 当前风速百分比
 *       "control_type": "integer",     // 整数值控制
 *       "control_range": {"min": 0, "max": 100, "step": 10, "default": 50}
 *     },
 *     {
 *       "node_id": "led_001",
 *       "type": "led",
 *       "state": "off",
 *       "mode": "auto",
 *       "location": "指示灯",
 *       "control_type": "boolean"      // 布尔值控制
 *     }
 *   ]
 * }
 * 
 * 区域划分规则：
 * 1. 优先使用上报数据中的area字段（网关级）
 * 2. 如果没有area字段，使用gateway_ip生成默认区域名（如：区域-192.168.1.100）
 * 3. 同一IP地址的设备默认属于同一区域
 * 4. nodes中的单个设备可以通过area字段覆盖网关级区域设置
 * 
 * 执行器控制类型说明：
 * - boolean：布尔值控制（on/off）- LED开关、继电器、水泵等
 * - integer：整数值控制（0-100）- 电机速度、亮度调节等
 * - angle：角度控制（0-180/360）- 舵机角度等
 * - float：浮点值控制 - 精确参数调节
 * - string：字符串指令 - 自定义指令
 * 
 * 服务器处理逻辑：
 * 1. 根据IP地址自动划分区域
 * 2. 根据控制类型自动加载对应控制卡片
 * 3. 发送控制指令后等待硬件回执
 * 4. 收到回执后更新页面状态
 * 5. 超时未收到回执则标记为控制超时并提醒用户
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gateway_ip, gateway_type, mac, farm_id, nodes, area } = body

    if (!gateway_ip) {
      return NextResponse.json(
        { success: false, error: '缺少网关IP地址' },
        { status: 400 }
      )
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少设备节点数据（nodes数组不能为空）' },
        { status: 400 }
      )
    }

    // 根据IP地址生成默认区域名（如果没有提供area）
    const defaultArea = area || `区域-${gateway_ip}`

    // 检查是否有未知类型的设备（不再拒绝，而是标记为未分配）
    const unknownTypeNodes = nodes.filter(node => !isSensorType(node.type) && !isActuatorType(node.type))
    if (unknownTypeNodes.length > 0) {
      console.log(`[Report] 检测到未知设备类型: ${unknownTypeNodes.map(n => n.type).join(', ')}，将自动分配到"未分配"类别`)
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
        `INSERT INTO gateways (farm_id, name, gateway_type, ip_address, mac_address, status, area)
         VALUES (?, ?, ?, ?, ?, 'online', ?)`,
        [farm_id, `自动发现-${gateway_ip}`, gateway_type || 'wifi_sensor', gateway_ip, mac || null, defaultArea]
      )

      const newGatewayId = (result as any).lastID || (result as any).insertId
      gateway = await db.query<Gateway[]>('SELECT * FROM gateways WHERE id = ?', [newGatewayId])

      console.log(`[Report] 自动创建网关: ${gateway_ip}`)
    } else {
      // 更新网关状态和区域信息
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = ?, area = ? WHERE id = ?',
        ['online', getBeijingTimeForDB(), defaultArea, gateway[0].id]
      )
    }

    const gatewayId = gateway[0].id
    const farmId = gateway[0].farm_id

    // 2. 处理所有设备节点数据（传递区域信息）
    const processedNodes: any[] = []
    for (const node of nodes) {
      const result = await processNodeData(gatewayId, farmId, node, defaultArea)
      processedNodes.push(result)
    }

    // 统计处理结果
    const successCount = processedNodes.filter(n => n.success).length
    const failedCount = processedNodes.filter(n => !n.success).length

    return NextResponse.json({
      success: true,
      message: `数据上报成功，共处理${nodes.length}个设备节点`,
      gateway_id: gatewayId,
      area: defaultArea,
      gateway_ip: gateway_ip,
      processed_nodes: processedNodes,
      total_nodes: processedNodes.length,
      success_count: successCount,
      failed_count: failedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Report] 设备数据上报失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '数据上报失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * 设备类型映射修正表
 * 处理常见的硬件映射错误，确保设备能被正确识别
 */
const deviceTypeMappings: Record<string, string> = {
  // 气压传感器映射错误修正
  'co2': 'pressure',           // BMP280气压传感器错误映射为CO2
  // 振动传感器映射错误修正
  'battery': 'vibration',      // 振动传感器错误映射为电池
  // 其他常见映射错误
  'soil': 'soil_moisture',     // 土壤湿度简写
  'temp': 'temperature',       // 温度简写
  'hum': 'humidity',           // 湿度简写
}

/**
 * 处理单个设备节点数据
 * 根据设备类型自动分类并同步到对应的表
 * 支持传感器数据和执行器状态上报
 * 支持硬件上报的控制类型和控制范围信息
 */
async function processNodeData(gatewayId: number, farmId: number, nodeData: ReportNode, area?: string) {
  const {
    node_id,
    name,
    type,
    value,
    unit,
    location,
    state,
    mode,
    control_value,
    control_type,
    control_range,
    firmware_version,
    signal_strength,
    battery_level
  } = nodeData

  if (!node_id || !type) {
    return { node_id: node_id || 'unknown', success: false, error: '缺少必要参数: node_id 或 type' }
  }

  // 使用上报数据中的area字段，或者使用默认区域（基于IP地址）
  const deviceArea = nodeData.area || area || `区域-${gatewayId}`

  // 应用设备类型映射修正
  const correctedType = deviceTypeMappings[type] || type

  if (correctedType !== type) {
    console.log(`[Report] 设备类型映射修正: ${type} -> ${correctedType}`)
  }

  // 检查是否为已知设备类型
  const deviceConfig = getDeviceTypeConfig(correctedType)

  // 确定设备类别和实际类型
  let deviceClass: DeviceCategory
  let actualType: string

  if (deviceConfig && deviceConfig.category !== DeviceCategory.UNASSIGNED) {
    // 已知类型，使用修正后的类型
    actualType = correctedType
    if (isSensorType(correctedType)) {
      deviceClass = DeviceCategory.SENSOR
    } else if (isActuatorType(correctedType)) {
      deviceClass = DeviceCategory.ACTUATOR
    } else {
      deviceClass = DeviceCategory.GATEWAY
    }
  } else {
    // 未知类型，分配到"未分配"类别
    deviceClass = DeviceCategory.UNASSIGNED
    actualType = getUnassignedDeviceType(value !== undefined, state !== undefined)

    console.log(`[Report] 设备 ${node_id} (原始类型: ${type}, 修正后: ${correctedType}) 已分配到未分配类别: ${actualType}`)
  }

  // 验证必填字段（未分配设备不强制要求）
  if (deviceClass === DeviceCategory.SENSOR && value === undefined) {
    return { node_id, type, success: false, error: '传感器类型必须提供value字段' }
  }
  if (deviceClass === DeviceCategory.ACTUATOR && state === undefined) {
    return { node_id, type, success: false, error: '执行器类型必须提供state字段' }
  }

  // 获取实际的设备配置（处理未知类型）
  const actualConfig = getDeviceTypeConfig(actualType)

  // 构建控制配置信息（仅执行器需要，传感器不需要控制类型）
  let controlConfig = {
    controlType: ControlType.BOOLEAN as string,
    controlRange: { min: 0, max: 100, step: 1, default: 0 } as ControlRange,
  }

  if (deviceClass === DeviceCategory.ACTUATOR) {
    controlConfig = {
      controlType: control_type || actualConfig?.controlType || ControlType.BOOLEAN,
      controlRange: control_range || actualConfig?.controlRange || { min: 0, max: 100, step: 1, default: 0 },
    }
  }

  try {
    // 使用统一的同步函数
    const syncResult = await syncDevice({
      gatewayId,
      farmId,
      nodeId: node_id,
      type: actualType,
      originalType: type, // 保存原始类型（用于显示）
      name: name || `${actualConfig?.name || '未知设备'}-${node_id.slice(-4)}`,
      location: location || '',
      area: deviceArea, // 区域信息
      value: value,
      unit: unit || actualConfig?.unit || '',
      state: state || 'off',
      mode: mode || 'auto',
      controlValue: deviceClass === DeviceCategory.ACTUATOR ? control_value : undefined, // 仅执行器传递控制值
      controlType: deviceClass === DeviceCategory.ACTUATOR ? controlConfig.controlType : undefined, // 仅执行器传递控制类型
      controlRange: deviceClass === DeviceCategory.ACTUATOR ? controlConfig.controlRange : undefined, // 仅执行器传递控制范围
      deviceClass,
      firmware_version: firmware_version || '',
      signal_strength: signal_strength || null,
      battery_level: battery_level || null,
    })

    // 存储原始数据到device_data表（仅传感器）
    if (deviceClass === DeviceCategory.SENSOR && value !== undefined) {
      await db.execute(
        `INSERT INTO device_data (gateway_id, node_id, sensor_type, value, unit, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [gatewayId, node_id, actualType, value, unit || actualConfig?.unit || null, getBeijingTimeForDB()]
      )
    }

    // 如果是执行器且上报了控制类型，更新执行器表中的控制类型配置
    if (deviceClass === DeviceCategory.ACTUATOR && control_type) {
      await db.execute(
        `UPDATE actuators 
         SET control_type = ?, control_min = ?, control_max = ?, control_step = ?, control_default = ? 
         WHERE id = ?`,
        [
          control_type,
          control_range?.min || 0,
          control_range?.max || 100,
          control_range?.step || 1,
          control_range?.default || 0,
          syncResult.deviceId
        ]
      )
    }

    // 日志输出：传感器只显示基本信息，执行器显示控制类型
    const logInfo = deviceClass === DeviceCategory.ACTUATOR 
      ? `[控制类型: ${controlConfig.controlType}, 控制范围: ${controlConfig.controlRange.min}-${controlConfig.controlRange.max}]`
      : ''
    
    console.log(`[Report] 设备节点处理成功: ${node_id} -> ${type}(${actualType}) (${deviceClass}) ${logInfo}`)

    // 返回结果：传感器不包含控制类型信息
    const result: any = {
      node_id,
      type: actualType,
      original_type: type, // 返回原始类型
      name: syncResult.deviceId,
      category: deviceClass,
      area: deviceArea,    // 返回所属区域
      success: true,
      message: deviceClass === DeviceCategory.UNASSIGNED ? '已分配到未分配类别' : '同步成功',
    }

    // 仅执行器返回控制类型和控制范围
    if (deviceClass === DeviceCategory.ACTUATOR) {
      result.control_type = controlConfig.controlType
      result.control_range = controlConfig.controlRange
    }

    return result
  } catch (error) {
    console.error(`[Report] 设备节点处理失败: ${node_id}`, error)
    return {
      node_id,
      type,
      success: false,
      error: error instanceof Error ? error.message : '同步失败',
    }
  }
}