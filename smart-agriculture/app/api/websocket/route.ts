import { NextRequest, NextResponse } from 'next/server'
import { WebSocketServer } from 'ws'
import { db, RowDataPacket } from '@/lib/db'

// 全局WebSocket服务器实例
let wss: WebSocketServer | null = null
// 设备连接映射
const deviceConnections = new Map<string, WebSocket>()
// 执行器连接映射
const actuatorConnections = new Map<string, WebSocket>()

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
      
      if (deviceId) {
        // 设备连接
        deviceConnections.set(deviceId, ws)
        console.log(`[WebSocket] Device connected: ${deviceId}`)
        
        // 发送欢迎消息
        ws.send(JSON.stringify({
          type: 'welcome',
          message: 'Device connected successfully'
        }))
      } else if (actuatorId) {
        // 执行器连接
        actuatorConnections.set(actuatorId, ws)
        console.log(`[WebSocket] Actuator connected: ${actuatorId}`)
        
        // 发送欢迎消息
        ws.send(JSON.stringify({
          type: 'welcome',
          message: 'Actuator connected successfully'
        }))
      }
      
      // 处理消息
      ws.on('message', (message: string) => {
        handleWebSocketMessage(ws, message, deviceId, actuatorId)
      })
      
      // 处理连接关闭
      ws.on('close', () => {
        if (deviceId) {
          deviceConnections.delete(deviceId)
          console.log(`[WebSocket] Device disconnected: ${deviceId}`)
        } else if (actuatorId) {
          actuatorConnections.delete(actuatorId)
          console.log(`[WebSocket] Actuator disconnected: ${actuatorId}`)
        }
      })
      
      // 处理错误
      ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error)
      })
    })
    
    console.log('[WebSocket] Server started on port 8080')
  }
}

/**
 * 处理WebSocket消息
 */
async function handleWebSocketMessage(ws: WebSocket, message: string, deviceId: string | null, actuatorId: string | null) {
  try {
    const data = JSON.parse(message)
    
    switch (data.type) {
      case 'heartbeat':
        // 处理心跳
        ws.send(JSON.stringify({
          type: 'heartbeat_ack',
          timestamp: Date.now()
        }))
        break
        
      case 'sensor_data':
        // 处理传感器数据
        if (deviceId) {
          await handleSensorData(deviceId, data.data)
        }
        break
        
      case 'command_ack':
        // 处理命令确认
        if (actuatorId && data.command_id) {
          await handleCommandAck(actuatorId, data.command_id, data.status)
        }
        break
        
      default:
        console.log('[WebSocket] Unknown message type:', data.type)
    }
  } catch (error) {
    console.error('[WebSocket] Message handling error:', error)
  }
}

/**
 * 处理传感器数据
 */
async function handleSensorData(deviceId: string, sensorData: any) {
  try {
    // 保存传感器数据到数据库
    // 这里可以添加具体的数据库操作
    console.log(`[WebSocket] Sensor data from device ${deviceId}:`, sensorData)
  } catch (error) {
    console.error('[WebSocket] Sensor data handling error:', error)
  }
}

/**
 * 处理命令确认
 */
async function handleCommandAck(actuatorId: string, commandId: number, status: string) {
  try {
    // 更新命令状态
    await db.execute(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND actuator_id = ?`,
      [status, commandId, actuatorId]
    )
    
    // 解锁执行器
    await db.execute(
      'UPDATE actuators SET locked = 0 WHERE id = ?',
      [actuatorId]
    )
    
    console.log(`[WebSocket] Command ack received - Actuator: ${actuatorId}, Command ID: ${commandId}, Status: ${status}`)
  } catch (error) {
    console.error('[WebSocket] Command ack handling error:', error)
  }
}

/**
 * 发送命令到执行器
 */
export async function sendCommandToActuator(actuatorId: string, command: any) {
  const ws = actuatorConnections.get(actuatorId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'command',
      data: command
    }))
    return true
  }
  return false
}

/**
 * GET /api/websocket
 * 初始化WebSocket服务器
 */
export async function GET(request: NextRequest) {
  try {
    initWebSocketServer()
    return NextResponse.json({
      success: true,
      message: 'WebSocket server initialized',
      port: 8080
    })
  } catch (error) {
    console.error('[WebSocket] Initialization error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize WebSocket server'
      },
      { status: 500 }
    )
  }
}
