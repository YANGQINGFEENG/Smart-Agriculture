import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { createLogger } from '@/lib/logger';

const log = createLogger('WebSocket');

// WebSocket服务器通过独立进程运行，这里通过HTTP转发接口发送命令
const WS_RELAY_URL = process.env.WS_RELAY_URL || 'http://localhost:8081'

/**
 * 发送命令到执行器
 * 通过HTTP转发接口发送到独立WebSocket服务器
 */
export async function sendCommandToActuator(actuatorId: string, command: any) {
  try {
    const response = await fetch(`${WS_RELAY_URL}/send-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actuator_id: actuatorId,
        command: command,
      }),
    })
    
    const result = await response.json()
    
    if (result.success && result.sent) {
      log.info(`Command sent via relay to actuator: ${actuatorId}`)
      return true
    } else {
      log.info(`No active WebSocket connection for actuator: ${actuatorId}`)
      return false
    }
  } catch (error) {
    log.error(`Failed to send command via relay:`, error)
    return false
  }
}

/**
 * 获取WebSocket服务器连接状态
 */
export async function getConnectionStatus() {
  try {
    const response = await fetch(`${WS_RELAY_URL}/status`)
    const result = await response.json()
    return result.success ? result.connections : {
      devices: 0,
      actuators: 0,
      gateways: 0,
      areas: 0,
    }
  } catch (error) {
    log.error('Failed to get status:', error)
    return {
      devices: 0,
      actuators: 0,
      gateways: 0,
      areas: 0,
    }
  }
}

/**
 * GET /api/websocket
 * 获取WebSocket服务器状态（独立进程运行在端口8080）
 */
export async function GET(request: NextRequest) {
  try {
    const connections = await getConnectionStatus()
    
    return NextResponse.json({
      success: true,
      message: 'WebSocket server running on port 8080',
      port: 8080,
      relay_port: 8081,
      connections: connections,
    })
  } catch (error) {
    log.error('Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'WebSocket server not available',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}