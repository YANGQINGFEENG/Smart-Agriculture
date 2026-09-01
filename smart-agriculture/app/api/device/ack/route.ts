import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'

/**
 * 硬件回执确认API
 * 支持硬件端通过HTTP方式确认控制指令的执行结果
 * 
 * 请求格式：
 * POST /api/device/ack
 * {
 *   "gateway_ip": "192.168.1.100",
 *   "actuator_id": "MT-1-001",
 *   "command_id": 123,
 *   "status": "executed",      // executed / failed
 *   "control_value": 60,       // 实际执行的控制值（可选）
 *   "state": "on"              // 执行后的状态（可选）
 * }
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "message": "OK",
 *   "command_id": 123,
 *   "actuator_id": "MT-1-001"
 * }
 */

/**
 * POST /api/device/ack
 * 硬件端确认控制指令执行结果（回执）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log(`[ACK] 收到回执请求，原始body:`, JSON.stringify(body))
    
    const gateway_ip = body.gateway_ip
    const actuator_id = body.actuator_id || body.actuatorId
    const command_id = body.command_id || body.commandId
    const status = body.status
    const control_value = body.control_value
    const state = body.state
    const color = body.color
    const brightness = body.brightness

    console.log(`[ACK] 解析参数 - actuator_id: ${actuator_id}, command_id: ${command_id} (类型: ${typeof command_id}), status: ${status}`)

    // 验证必要参数
    if (!actuator_id || !command_id || !status || !['executed', 'failed'].includes(status)) {
      console.log(`[ACK] 参数验证失败 - actuator_id: ${!!actuator_id}, command_id: ${!!command_id}, status: ${status}`)
      return NextResponse.json(
        { success: false, error: '缺少必要参数：actuator_id、command_id、status（executed/failed）', 
          received: { actuator_id, command_id, status } },
        { status: 400 }
      )
    }

    // 将command_id转换为数字类型（如果是字符串的话）
    const numericCommandId = typeof command_id === 'string' ? parseInt(command_id) : command_id
    console.log(`[ACK] 收到硬件回执 - 网关IP: ${gateway_ip}, 执行器: ${actuator_id}, 命令ID: ${command_id} (转换后: ${numericCommandId}), 状态: ${status}`)

    // 验证命令是否存在且状态为待执行或执行中
    const existingCommand = await db.query<RowDataPacket[]>(
      `SELECT id, command, control_value, command_data FROM actuator_commands 
       WHERE id = ? AND actuator_id = ?`,
      [numericCommandId, actuator_id]
    )

    if (existingCommand.length === 0) {
      return NextResponse.json(
        { success: false, error: '命令不存在' },
        { status: 404 }
      )
    }

    const command = existingCommand[0]

    // 更新命令状态
    await db.execute(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = ? 
       WHERE id = ? AND actuator_id = ?`,
      [status, getBeijingTimeForDB(), numericCommandId, actuator_id]
    )

    // 如果指令执行成功，更新执行器状态
    if (status === 'executed') {
      // track/gyro/color/reset 命令不改变执行器 state，
      // 但必须同步更新 feedback 中的对应字段，避免前端等待数据上报周期（~30s）
      const noStateChangeCommands = ['track', 'color', 'reset', 'gyro']
      const shouldUpdateState = !noStateChangeCommands.includes(command.command)

      console.log(`[ACK] 命令类型: ${command.command}, shouldUpdateState: ${shouldUpdateState}`)

      if (shouldUpdateState) {
        const actualControlValue = control_value !== undefined ? control_value : command.control_value
        const actualState = state || (command.command === 'value' && (actualControlValue || 0) > 0 ? 'on' : (command.command === 'on' ? 'on' : 'off'))

        console.log(`[ACK] 开始更新执行器 - actualState: ${actualState}, actualControlValue: ${actualControlValue}`)

        // 构建feedback数据（支持RGB扩展格式）
        const feedbackData: any = { state: actualState }

        // 添加RGB相关字段
        if (color) {
          feedbackData.color = color
        }
        if (brightness !== undefined) {
          feedbackData.brightness = brightness
        } else if (control_value !== undefined) {
          feedbackData.brightness = control_value
        }

        console.log(`[ACK] feedbackData:`, JSON.stringify(feedbackData))

        // 序列化feedback为JSON字符串
        const feedbackJson = JSON.stringify(feedbackData)
        console.log(`[ACK] feedbackJson:`, feedbackJson)

        // 更新执行器状态
        await db.execute(
          `UPDATE actuators 
           SET state = ?, 
               control_value = ?, 
               last_update = ?, 
               locked = 0,
               feedback = ?
           WHERE id = ?`,
          [
            actualState,
            actualControlValue !== undefined ? actualControlValue : null,
            getBeijingTimeForDB(),
            feedbackJson,
            actuator_id
          ]
        )

        console.log(`[ACK] 执行器 ${actuator_id} 更新成功`)
      } else {
        // gyro/track/color 命令：合并 feedback 字段后立即写入，不等数据上报
        // 关键：如果 feedback 为空（尚无数据上报），不写入避免丢失 stream_url 等字段
        const [fbRows] = await db.query<RowDataPacket[]>(
          `SELECT feedback FROM actuators WHERE id = ?`, [actuator_id]
        )
        const existingFeedback = (fbRows.length > 0 && fbRows[0].feedback)
          ? (typeof fbRows[0].feedback === 'string' ? JSON.parse(fbRows[0].feedback) : fbRows[0].feedback)
          : {}
        
        const hasExistingData = Object.keys(existingFeedback).length > 0
        
        if (hasExistingData) {
          let cmdData = command.command_data
          if (cmdData && typeof cmdData === 'string') {
            try { cmdData = JSON.parse(cmdData) } catch {}
          }
          
          if (command.command === 'gyro') {
            const gyroValue = (cmdData && cmdData.value) || command.control_value
            existingFeedback.gesture_control_enabled = (gyroValue === 'on' || gyroValue === true || gyroValue === 1)
          } else if (command.command === 'track') {
            const trackValue = (cmdData && cmdData.value) || command.control_value
            existingFeedback.tracking_enabled = (trackValue === 'on' || trackValue === true || trackValue === 1)
          } else if (command.command === 'color') {
            existingFeedback.color_preset = (cmdData && cmdData.color) || existingFeedback.color_preset
          }
          
          await db.execute(
            `UPDATE actuators SET last_update = ?, locked = 0, feedback = ? WHERE id = ?`,
            [getBeijingTimeForDB(), JSON.stringify(existingFeedback), actuator_id]
          )

          console.log(`[ACK] 执行器 ${actuator_id} 已解锁（${command.command} 命令，feedback 已同步）`)
        } else {
          // feedback 为空，仅解锁，等待数据上报补充完整 feedback
          await db.execute(
            'UPDATE actuators SET locked = 0 WHERE id = ?',
            [actuator_id]
          )
          console.log(`[ACK] 执行器 ${actuator_id} 已解锁（${command.command} 命令，feedback 为空，跳过写入）`)
        }
      }
    } else {
      // 执行失败，解锁执行器
      await db.execute(
        'UPDATE actuators SET locked = 0 WHERE id = ?',
        [actuator_id]
      )

      console.log(`[ACK] 执行器 ${actuator_id} 执行失败，已解锁`)
    }

    // 如果提供了网关IP，更新网关状态
    if (gateway_ip) {
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = ? WHERE ip_address = ?',
        ['online', getBeijingTimeForDB(), gateway_ip]
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OK',
      command_id: numericCommandId,
      actuator_id: actuator_id,
      status: status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ACK] 硬件回执处理失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '硬件回执处理失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/device/ack/poll
 * 硬件端轮询待执行的控制指令
 * 
 * 请求格式：
 * GET /api/device/ack/poll?gateway_ip=192.168.1.100&actuator_id=MT-1-001
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "actuator_id": "MT-1-001",
 *     "command": "value",
 *     "control_value": 60,
 *     "control_type": "integer",
 *     "status": "executing"
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gateway_ip = searchParams.get('gateway_ip')
    const actuator_id = searchParams.get('actuator_id')

    if (!actuator_id) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：actuator_id' },
        { status: 400 }
      )
    }

    // 更新网关在线状态（如果提供了网关IP）
    if (gateway_ip) {
      await db.execute(
        'UPDATE gateways SET status = ?, last_heartbeat = ? WHERE ip_address = ?',
        ['online', getBeijingTimeForDB(), gateway_ip]
      )
    }

    // 查询待执行的指令（按创建时间排序，优先处理最早的指令）
    const pendingCommands = await db.query<RowDataPacket[]>(
      `SELECT ac.id, ac.actuator_id, ac.command, ac.control_value, ac.status, ac.created_at,
              a.control_type, a.control_min, a.control_max, a.control_step, a.control_default
       FROM actuator_commands ac
       LEFT JOIN actuators a ON ac.actuator_id = a.id
       WHERE ac.actuator_id = ? AND ac.status = 'pending'
       ORDER BY ac.created_at ASC
       LIMIT 1`,
      [actuator_id]
    )

    if (pendingCommands.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '没有待执行的指令',
      })
    }

    const command = pendingCommands[0]

    // 将指令标记为执行中
    await db.execute(
      `UPDATE actuator_commands 
       SET status = 'executing' 
       WHERE id = ? AND actuator_id = ?`,
      [command.id, actuator_id]
    )

    console.log(`[ACK] 硬件端轮询到指令 - 执行器: ${actuator_id}, 指令: ${command.command}, 控制值: ${command.control_value}, 命令ID: ${command.id}`)

    return NextResponse.json({
      success: true,
      data: {
        id: command.id,
        actuator_id: command.actuator_id,
        command: command.command,
        control_value: command.control_value,
        control_type: command.control_type || 'boolean',
        control_min: command.control_min || 0,
        control_max: command.control_max || 100,
        control_step: command.control_step || 1,
        control_default: command.control_default || 0,
        status: 'executing',
        created_at: command.created_at,
      },
      message: 'OK',
    })
  } catch (error) {
    console.error('[ACK] 硬件端轮询失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '硬件端轮询失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}