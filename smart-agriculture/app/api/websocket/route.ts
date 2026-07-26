import { NextRequest, NextResponse } from 'next/server'
import { WebSocketServer, WebSocket } from 'ws'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { syncDevice } from '@/lib/device-sync'
import { DeviceCategory, isSensorType, isActuatorType, getUnassignedDeviceType } from '@/lib/device-types'

// 全局WebSocket服务器实例
let wss: WebSocketServer | null = null
// 设备连接映射 (deviceId -> WebSocket)
const deviceConnections = new Map<string, WebSocket>()
// 执行器连接映射 (actuatorId -> WebSocket)
const actuatorConnections = new Map<string, WebSocket>()
// 网关连接映射 (gatewayIp -> WebSocket)
const gatewayConnections = new Map<string, WebSocket>()
// 区域连接映射 (areaName -> Set<WebSocket>) - 支持区域广播
const areaConnections = new Map<string, Set<WebSocket>>()

/**
 * WebSocket消息类型枚举
 */
enum WebSocketMessageType {
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_ACK = 'heartbeat_ack',
  WELCOME = 'welcome',
  SENSOR_DATA = 'sensor_data',
  ACTUATOR_STATUS = 'actuator_status',
  COMMAND = 'command',
  COMMAND_ACK = 'command_ack',           // 命令回执（硬件确认）
  COMMAND_STATUS = 'command_status',     // 命令状态更新（通知前端）
  DEVICE_REGISTER = 'device_register',
  GATEWAY_REGISTER = 'gateway_register',
  DATA_REPORT = 'data_report',
  STATUS_UPDATE = 'status_update',
  AREA_UPDATE = 'area_update',           // 区域数据更新（通知前端）
  ERROR = 'error',
  AREA_SYNC = 'area_sync',
}

/**
 * 初始化WebSocket服务器
 */
function initWebSocketServer() {
  if (!wss) {
    wss = new WebSocketServer({ port: 8080 })
    
    wss.on('connection', (ws: WebSocket, req: any) => {
      // 解析查询参数
      const url = new URL(req.url || '', 'http://localhost')
      const deviceId = url.searchParams.get('device_id')
      const actuatorId = url.searchParams.get('actuator_id')
      const gatewayIp = url.searchParams.get('gateway_ip')
      const area = url.searchParams.get('area')
      
      // 记录连接信息
      const connectionId = deviceId || actuatorId || gatewayIp || area || 'unknown'
      
      // 注册连接到区域（如果提供了area参数）
      if (area) {
        let wsSet = areaConnections.get(area)
        if (!wsSet) {
          wsSet = new Set<WebSocket>()
          areaConnections.set(area, wsSet)
        }
        wsSet.add(ws)
        console.log(`[WebSocket] Area connection registered: ${area}`)
      }
      
      if (deviceId) {
        // 设备连接
        deviceConnections.set(deviceId, ws)
        console.log(`[WebSocket] Device connected: ${deviceId}`)
        
        // 发送欢迎消息
        ws.send(JSON.stringify({
          type: WebSocketMessageType.WELCOME,
          message: 'Device connected successfully',
          device_id: deviceId,
        }))
      } else if (actuatorId) {
        // 执行器连接
        actuatorConnections.set(actuatorId, ws)
        console.log(`[WebSocket] Actuator connected: ${actuatorId}`)
        
        // 发送欢迎消息
        ws.send(JSON.stringify({
          type: WebSocketMessageType.WELCOME,
          message: 'Actuator connected successfully',
          actuator_id: actuatorId,
        }))
      } else if (gatewayIp) {
        // 网关连接（支持同一IP下多个设备）
        gatewayConnections.set(gatewayIp, ws)
        
        // 自动注册区域连接（区域名格式：区域-IP地址）
        const gatewayArea = `区域-${gatewayIp}`
        let wsSet = areaConnections.get(gatewayArea)
        if (!wsSet) {
          wsSet = new Set<WebSocket>()
          areaConnections.set(gatewayArea, wsSet)
        }
        wsSet.add(ws)
        
        console.log(`[WebSocket] Gateway connected: ${gatewayIp}, Area: ${gatewayArea}`)
        
        // 发送欢迎消息
        ws.send(JSON.stringify({
          type: WebSocketMessageType.WELCOME,
          message: 'Gateway connected successfully',
          gateway_ip: gatewayIp,
          area: gatewayArea,
        }))
      }
      
      // 处理消息
      ws.on('message', (message: string) => {
        handleWebSocketMessage(ws, message, deviceId, actuatorId, gatewayIp, area)
      })
      
      // 处理连接关闭
      ws.on('close', () => {
        if (deviceId) {
          deviceConnections.delete(deviceId)
          console.log(`[WebSocket] Device disconnected: ${deviceId}`)
        } else if (actuatorId) {
          actuatorConnections.delete(actuatorId)
          console.log(`[WebSocket] Actuator disconnected: ${actuatorId}`)
        } else if (gatewayIp) {
          gatewayConnections.delete(gatewayIp)
          // 从区域连接中移除
          const gatewayArea = `区域-${gatewayIp}`
          const wsSet = areaConnections.get(gatewayArea)
          if (wsSet) {
            wsSet.delete(ws)
            if (wsSet.size === 0) {
              areaConnections.delete(gatewayArea)
            }
          }
          console.log(`[WebSocket] Gateway disconnected: ${gatewayIp}`)
        }
        
        // 从区域连接中移除（如果提供了area参数）
        if (area) {
          const wsSet = areaConnections.get(area)
          if (wsSet) {
            wsSet.delete(ws)
            if (wsSet.size === 0) {
              areaConnections.delete(area)
            }
          }
        }
      })
      
      // 处理错误
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for ${connectionId}:`, error)
      })
    })
    
    console.log('[WebSocket] Server started on port 8080')
  }
}

/**
 * 处理WebSocket消息
 */
async function handleWebSocketMessage(
  ws: WebSocket, 
  message: string, 
  deviceId: string | null, 
  actuatorId: string | null, 
  gatewayIp: string | null,
  area: string | null
) {
  try {
    const data = JSON.parse(message)
    
    switch (data.type) {
      case WebSocketMessageType.HEARTBEAT:
        // 处理心跳
        handleHeartbeat(ws)
        break
        
      case WebSocketMessageType.DEVICE_REGISTER:
        // 设备注册
        await handleDeviceRegister(data)
        break
        
      case WebSocketMessageType.GATEWAY_REGISTER:
        // 网关注册
        await handleGatewayRegister(data)
        break
        
      case WebSocketMessageType.SENSOR_DATA:
        // 处理传感器数据
        if (gatewayIp) {
          await handleSensorData(gatewayIp, data.data)
        }
        break
        
      case WebSocketMessageType.ACTUATOR_STATUS:
        // 处理执行器状态
        if (gatewayIp) {
          await handleActuatorStatus(gatewayIp, data.data)
        }
        break
        
      case WebSocketMessageType.DATA_REPORT:
        // 处理数据上报（统一格式）
        if (gatewayIp) {
          await handleDataReport(gatewayIp, data.data)
        }
        break
        
      case WebSocketMessageType.COMMAND_ACK:
        // 处理命令确认（硬件回执）
        if (actuatorId && data.command_id) {
          await handleCommandAck(actuatorId, data.command_id, data.status, data.control_value)
        } else if (gatewayIp && data.command_id) {
          // 通过网关连接确认命令
          await handleCommandAck(data.actuator_id || '', data.command_id, data.status, data.control_value)
        }
        break
        
      case WebSocketMessageType.AREA_SYNC:
        // 区域同步请求
        if (area) {
          await handleAreaSync(ws, area)
        }
        break
        
      default:
        console.log('[WebSocket] Unknown message type:', data.type)
    }
  } catch (error) {
    console.error('[WebSocket] Message handling error:', error)
    ws.send(JSON.stringify({
      type: WebSocketMessageType.ERROR,
      message: 'Invalid message format',
    }))
  }
}

/**
 * 处理心跳
 */
function handleHeartbeat(ws: WebSocket) {
  ws.send(JSON.stringify({
    type: WebSocketMessageType.HEARTBEAT_ACK,
    timestamp: Date.now()
  }))
}

/**
 * 处理设备注册
 */
async function handleDeviceRegister(data: any) {
  try {
    const { device_id, type, name, location, area } = data
    
    console.log(`[WebSocket] Device registered: ${device_id}, type: ${type}`)
    
    // 更新或创建设备节点记录
    await db.execute(
      `INSERT INTO device_nodes (node_id, name, node_type, sensor_type, location, area, status)
       VALUES (?, ?, ?, ?, ?, ?, 'online')
       ON DUPLICATE KEY UPDATE name = VALUES(name), sensor_type = VALUES(sensor_type), 
       location = VALUES(location), area = VALUES(area), status = 'online'`,
      [device_id, name || device_id, type === 'actuator' ? 'actuator' : 'sensor', type, location || '', area || '']
    )
  } catch (error) {
    console.error('[WebSocket] Device register error:', error)
  }
}

/**
 * 处理网关注册
 */
async function handleGatewayRegister(data: any) {
  try {
    const { gateway_ip, gateway_type, mac, farm_id, area } = data
    
    console.log(`[WebSocket] Gateway registered: ${gateway_ip}`)
    
    // 更新或创建网关记录
    const existingGateways = await db.query<RowDataPacket[]>(
      'SELECT id FROM gateways WHERE ip_address = ?',
      [gateway_ip]
    )
    
    const defaultArea = area || `区域-${gateway_ip}`
    
    if (existingGateways.length === 0) {
      await db.execute(
        `INSERT INTO gateways (farm_id, name, gateway_type, ip_address, mac_address, status, area)
         VALUES (?, ?, ?, ?, ?, 'online', ?)`,
        [farm_id || 0, `WebSocket-${gateway_ip}`, gateway_type || 'ws_gateway', gateway_ip, mac || null, defaultArea]
      )
    } else {
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = ?, area = ? WHERE ip_address = ?',
        ['online', getBeijingTimeForDB(), defaultArea, gateway_ip]
      )
    }
  } catch (error) {
    console.error('[WebSocket] Gateway register error:', error)
  }
}

/**
 * 处理传感器数据
 */
async function handleSensorData(gatewayIp: string, sensorData: any) {
  try {
    console.log(`[WebSocket] Sensor data from gateway ${gatewayIp}:`, sensorData)
    
    // 获取网关ID
    const gateways = await db.query<RowDataPacket[]>(
      'SELECT id, farm_id FROM gateways WHERE ip_address = ?',
      [gatewayIp]
    )
    
    if (gateways.length === 0) {
      console.warn(`[WebSocket] Gateway not found for IP: ${gatewayIp}`)
      return
    }
    
    const gatewayId = gateways[0].id
    const farmId = gateways[0].farm_id
    const area = `区域-${gatewayIp}`
    
    // 处理传感器数据并同步
    for (const sensor of sensorData) {
      if (sensor.value !== undefined && sensor.type && sensor.node_id) {
        const isSensor = isSensorType(sensor.type)
        const isActuator = isActuatorType(sensor.type)
        
        let deviceClass: DeviceCategory
        let actualType: string
        
        if (isSensor) {
          deviceClass = DeviceCategory.SENSOR
          actualType = sensor.type
        } else if (isActuator) {
          deviceClass = DeviceCategory.ACTUATOR
          actualType = sensor.type
        } else {
          deviceClass = DeviceCategory.UNASSIGNED
          actualType = getUnassignedDeviceType(sensor.value !== undefined, sensor.state !== undefined)
        }
        
        await syncDevice({
          gatewayId,
          farmId,
          nodeId: sensor.node_id,
          type: actualType,
          originalType: sensor.type,
          name: sensor.name || `${actualType}-${sensor.node_id.slice(-4)}`,
          location: sensor.location || '',
          area: sensor.area || area,
          value: sensor.value,
          unit: sensor.unit || '',
          state: sensor.state || 'off',
          mode: sensor.mode || 'auto',
          controlValue: sensor.control_value,
          deviceClass,
        })
      }
    }
  } catch (error) {
    console.error('[WebSocket] Sensor data handling error:', error)
  }
}

/**
 * 处理执行器状态
 */
async function handleActuatorStatus(gatewayIp: string, actuatorData: any) {
  try {
    console.log(`[WebSocket] Actuator status from gateway ${gatewayIp}:`, actuatorData)
    
    // 获取网关ID
    const gateways = await db.query<RowDataPacket[]>(
      'SELECT id, farm_id FROM gateways WHERE ip_address = ?',
      [gatewayIp]
    )
    
    if (gateways.length === 0) {
      console.warn(`[WebSocket] Gateway not found for IP: ${gatewayIp}`)
      return
    }
    
    const gatewayId = gateways[0].id
    const farmId = gateways[0].farm_id
    const area = `区域-${gatewayIp}`
    
    // 处理执行器状态并同步
    for (const actuator of actuatorData) {
      if (actuator.type && actuator.node_id) {
        const isActuator = isActuatorType(actuator.type)
        
        let deviceClass: DeviceCategory
        let actualType: string
        
        if (isActuator) {
          deviceClass = DeviceCategory.ACTUATOR
          actualType = actuator.type
        } else {
          deviceClass = DeviceCategory.UNASSIGNED
          actualType = getUnassignedDeviceType(actuator.value !== undefined, actuator.state !== undefined)
        }
        
        await syncDevice({
          gatewayId,
          farmId,
          nodeId: actuator.node_id,
          type: actualType,
          originalType: actuator.type,
          name: actuator.name || `${actualType}-${actuator.node_id.slice(-4)}`,
          location: actuator.location || '',
          area: actuator.area || area,
          value: actuator.value || 0,
          unit: actuator.unit || '',
          state: actuator.state || 'off',
          mode: actuator.mode || 'auto',
          controlValue: actuator.control_value,
          deviceClass,
        })
      }
    }
  } catch (error) {
    console.error('[WebSocket] Actuator status handling error:', error)
  }
}

/**
 * 处理数据上报（统一格式）
 */
async function handleDataReport(gatewayIp: string, reportData: any) {
  try {
    console.log(`[WebSocket] Data report from gateway ${gatewayIp}:`, reportData)
    
    // 获取网关ID
    const gateways = await db.query<RowDataPacket[]>(
      'SELECT id, farm_id FROM gateways WHERE ip_address = ?',
      [gatewayIp]
    )
    
    if (gateways.length === 0) {
      console.warn(`[WebSocket] Gateway not found for IP: ${gatewayIp}`)
      return
    }
    
    const gatewayId = gateways[0].id
    const farmId = gateways[0].farm_id
    const defaultArea = reportData.area || `区域-${gatewayIp}`
    
    // 更新网关区域信息
    await db.execute(
      'UPDATE gateways SET area = ? WHERE ip_address = ?',
      [defaultArea, gatewayIp]
    )
    
    // 处理上报的节点数据
    if (reportData.nodes && Array.isArray(reportData.nodes)) {
      for (const node of reportData.nodes) {
        if (!node.type || !node.node_id) continue
        
        const isSensor = isSensorType(node.type)
        const isActuator = isActuatorType(node.type)
        
        let deviceClass: DeviceCategory
        let actualType: string
        
        if (isSensor) {
          deviceClass = DeviceCategory.SENSOR
          actualType = node.type
        } else if (isActuator) {
          deviceClass = DeviceCategory.ACTUATOR
          actualType = node.type
        } else {
          deviceClass = DeviceCategory.UNASSIGNED
          actualType = getUnassignedDeviceType(node.value !== undefined, node.state !== undefined)
        }
        
        const deviceArea = node.area || defaultArea
        
        try {
          await syncDevice({
            gatewayId,
            farmId,
            nodeId: node.node_id,
            type: actualType,
            originalType: node.type,
            name: node.name || `${actualType}-${node.node_id.slice(-4)}`,
            location: node.location || '',
            area: deviceArea,
            value: node.value || 0,
            unit: node.unit || '',
            state: node.state || 'off',
            mode: node.mode || 'auto',
            controlValue: node.control_value,
            deviceClass,
          })
        } catch (syncError) {
          console.error(`[WebSocket] Sync error for node ${node.node_id}:`, syncError)
        }
      }
    }
  } catch (error) {
    console.error('[WebSocket] Data report handling error:', error)
  }
}

/**
 * 处理命令确认（硬件回执）
 * 收到回执信息后才更新相关页面
 * 同时通知前端命令执行状态
 */
async function handleCommandAck(actuatorId: string, commandId: number, status: string, controlValue?: number) {
  try {
    console.log(`[WebSocket] Command ack received - Actuator: ${actuatorId}, Command ID: ${commandId}, Status: ${status}`)
    
    if (!actuatorId) {
      console.warn('[WebSocket] Command ack received without actuator_id')
      return
    }
    
    // 验证命令是否存在
    const existingCommands = await db.query<RowDataPacket[]>(
      'SELECT id, command, control_value FROM actuator_commands WHERE id = ? AND actuator_id = ?',
      [commandId, actuatorId]
    )
    
    if (existingCommands.length === 0) {
      console.warn(`[WebSocket] Command not found: ${commandId} for actuator ${actuatorId}`)
      return
    }
    
    const command = existingCommands[0]
    
    // 更新命令状态
    await db.execute(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = ? 
       WHERE id = ? AND actuator_id = ?`,
      [status, getBeijingTimeForDB(), commandId, actuatorId]
    )
    
    // 如果指令执行成功，更新执行器状态
    let newState: string | null = null
    if (status === 'executed') {
      newState = command.command === 'value' && (command.control_value || controlValue) > 0 ? 'on' : (command.command === 'on' ? 'on' : 'off')
      
      await db.execute(
        'UPDATE actuators SET state = ?, control_value = ?, last_update = ?, locked = 0 WHERE id = ?',
        [newState, controlValue || command.control_value || null, getBeijingTimeForDB(), actuatorId]
      )
      
      console.log(`[WebSocket] Actuator ${actuatorId} updated - state: ${newState}, control_value: ${controlValue}`)
    } else {
      // 执行失败或超时，解锁执行器
      await db.execute(
        'UPDATE actuators SET locked = 0 WHERE id = ?',
        [actuatorId]
      )
    }
    
    // 通知前端命令执行状态（实时推送）
    notifyCommandStatus(actuatorId, commandId, status, controlValue, newState)
    
    // 通知相关区域的前端客户端数据更新
    await notifyAreaUpdate(actuatorId)
    
  } catch (error) {
    console.error('[WebSocket] Command ack handling error:', error)
  }
}

/**
 * 通知前端命令执行状态
 * 通过WebSocket实时推送命令状态更新
 */
function notifyCommandStatus(actuatorId: string, commandId: number, status: string, controlValue?: number, state?: string | null) {
  // 构建状态更新消息
  const statusMessage = {
    type: WebSocketMessageType.COMMAND_STATUS,
    data: {
      actuator_id: actuatorId,
      command_id: commandId,
      status: status,
      control_value: controlValue,
      state: state,
      timestamp: Date.now(),
    },
  }
  
  // 通过执行器连接发送
  const actuatorWs = actuatorConnections.get(actuatorId)
  if (actuatorWs && actuatorWs.readyState === WebSocket.OPEN) {
    actuatorWs.send(JSON.stringify(statusMessage))
    console.log(`[WebSocket] Command status sent to actuator client: ${actuatorId}`)
  }
  
  // 通过区域连接广播
  // 先查询执行器所属区域
  db.query<RowDataPacket[]>('SELECT area FROM actuators WHERE id = ?', [actuatorId])
    .then((results) => {
      if (results.length > 0 && results[0].area) {
        const areaWsSet = areaConnections.get(results[0].area)
        if (areaWsSet && areaWsSet.size > 0) {
          areaWsSet.forEach((conn) => {
            if (conn.readyState === WebSocket.OPEN) {
              conn.send(JSON.stringify(statusMessage))
            }
          })
          console.log(`[WebSocket] Command status broadcast to area: ${results[0].area}`)
        }
      }
    })
    .catch((error) => {
      console.error('[WebSocket] Error querying actuator area:', error)
    })
}

/**
 * 通知区域数据更新
 * 当区域内设备状态变化时，通知所有订阅该区域的前端客户端
 */
async function notifyAreaUpdate(actuatorId: string) {
  try {
    // 查询执行器所属区域
    const actuators = await db.query<RowDataPacket[]>(
      'SELECT area FROM actuators WHERE id = ?',
      [actuatorId]
    )
    
    if (actuators.length === 0 || !actuators[0].area) {
      return
    }
    
    const area = actuators[0].area
    
    // 获取区域内最新的传感器和执行器数据
    const sensors = await db.query<RowDataPacket[]>(
      `SELECT s.*, sd.value, sd.timestamp as last_data_time 
       FROM sensors s 
       LEFT JOIN sensor_data sd ON s.id = sd.sensor_id 
       WHERE s.area = ? AND s.status = 'online' 
       ORDER BY sd.timestamp DESC`,
      [area]
    )
    
    const actuatorList = await db.query<RowDataPacket[]>(
      'SELECT * FROM actuators WHERE area = ? AND status = "online"',
      [area]
    )
    
    // 构建区域更新消息
    const updateMessage = {
      type: WebSocketMessageType.AREA_UPDATE,
      data: {
        area,
        sensors: sensors.length,
        actuators: actuatorList.length,
        timestamp: Date.now(),
      },
    }
    
    // 通过区域连接广播
    const areaWsSet = areaConnections.get(area)
    if (areaWsSet && areaWsSet.size > 0) {
      areaWsSet.forEach((conn) => {
        if (conn.readyState === WebSocket.OPEN) {
          conn.send(JSON.stringify(updateMessage))
        }
      })
      console.log(`[WebSocket] Area update broadcast to area: ${area}`)
    }
  } catch (error) {
    console.error('[WebSocket] Area update notification error:', error)
  }
}

/**
 * 处理区域同步请求
 */
async function handleAreaSync(ws: WebSocket, area: string) {
  try {
    console.log(`[WebSocket] Area sync request for: ${area}`)
    
    // 获取区域内的传感器和执行器
    const sensors = await db.query<RowDataPacket[]>(
      'SELECT * FROM sensors WHERE area = ? AND status = "online"',
      [area]
    )
    
    const actuators = await db.query<RowDataPacket[]>(
      'SELECT * FROM actuators WHERE area = ? AND status = "online"',
      [area]
    )
    
    ws.send(JSON.stringify({
      type: WebSocketMessageType.AREA_SYNC,
      data: {
        area,
        sensors: sensors.length,
        actuators: actuators.length,
        sensor_list: sensors,
        actuator_list: actuators,
      },
    }))
  } catch (error) {
    console.error('[WebSocket] Area sync error:', error)
    ws.send(JSON.stringify({
      type: WebSocketMessageType.ERROR,
      message: 'Area sync failed',
    }))
  }
}

/**
 * 发送命令到执行器
 * 通过WebSocket实时推送控制指令
 */
export async function sendCommandToActuator(actuatorId: string, command: any) {
  // 优先尝试通过执行器直接连接发送
  let ws = actuatorConnections.get(actuatorId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: WebSocketMessageType.COMMAND,
      data: command
    }))
    console.log(`[WebSocket] Command sent directly to actuator: ${actuatorId}`)
    return true
  }
  
  // 如果执行器没有直接连接，尝试通过网关连接发送
  // 查询执行器所属区域/网关
  const actuators = await db.query<RowDataPacket[]>(
    'SELECT area FROM actuators WHERE id = ?',
    [actuatorId]
  )
  
  if (actuators.length > 0) {
    const area = actuators[0].area
    
    // 通过区域名查找网关（区域名格式：区域-IP地址）
    if (area && area.startsWith('区域-')) {
      const gatewayIp = area.replace('区域-', '')
      ws = gatewayConnections.get(gatewayIp)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: WebSocketMessageType.COMMAND,
          data: {
            ...command,
            actuator_id: actuatorId
          }
        }))
        console.log(`[WebSocket] Command sent via gateway ${gatewayIp} to actuator: ${actuatorId}`)
        return true
      }
    }
    
    // 通过区域连接广播发送
    const areaWsSet = areaConnections.get(area)
    if (areaWsSet && areaWsSet.size > 0) {
      let sent = false
      areaWsSet.forEach(conn => {
        if (conn.readyState === WebSocket.OPEN) {
          conn.send(JSON.stringify({
            type: WebSocketMessageType.COMMAND,
            data: {
              ...command,
              actuator_id: actuatorId
            }
          }))
          sent = true
        }
      })
      if (sent) {
        console.log(`[WebSocket] Command sent via area broadcast ${area} to actuator: ${actuatorId}`)
        return true
      }
    }
  }
  
  console.log(`[WebSocket] No active connection found for actuator: ${actuatorId}`)
  return false
}

/**
 * 发送消息到指定区域的所有连接
 */
export async function sendMessageToArea(area: string, message: any) {
  const wsSet = areaConnections.get(area)
  if (!wsSet || wsSet.size === 0) {
    console.log(`[WebSocket] No connections in area: ${area}`)
    return false
  }
  
  let sent = false
  wsSet.forEach(conn => {
    if (conn.readyState === WebSocket.OPEN) {
      conn.send(JSON.stringify(message))
      sent = true
    }
  })
  
  if (sent) {
    console.log(`[WebSocket] Message sent to area: ${area}, connections: ${wsSet.size}`)
  }
  
  return sent
}

/**
 * 获取连接状态
 */
export function getConnectionStatus() {
  return {
    devices: deviceConnections.size,
    actuators: actuatorConnections.size,
    gateways: gatewayConnections.size,
    areas: areaConnections.size,
  }
}

/**
 * GET /api/websocket
 * 初始化WebSocket服务器并返回状态
 */
export async function GET(request: NextRequest) {
  try {
    initWebSocketServer()
    
    return NextResponse.json({
      success: true,
      message: 'WebSocket server initialized',
      port: 8080,
      connections: getConnectionStatus(),
    })
  } catch (error) {
    console.error('[WebSocket] Initialization error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize WebSocket server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}