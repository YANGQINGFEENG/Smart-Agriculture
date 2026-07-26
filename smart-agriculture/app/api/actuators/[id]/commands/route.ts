import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { sendCommandToActuator } from '@/app/api/websocket/route'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { ControlType } from '@/lib/device-types'

/**
 * 控制指令接口
 */
interface ActuatorCommand extends RowDataPacket {
  id: number
  actuator_id: string
  command: 'on' | 'off' | 'value'
  control_value?: number
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'timeout'
  created_at: Date
  executed_at: Date | null
}

/**
 * 控制指令超时时间（秒）
 */
const COMMAND_TIMEOUT_SECONDS = 30

/**
 * GET /api/actuators/[id]/commands
 * 硬件端查询待执行的控制指令 / 前端查询指令执行状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 清理超时的命令
    await db.execute(
      `UPDATE actuator_commands 
       SET status = 'timeout', executed_at = ? 
       WHERE actuator_id = ? AND status IN ('pending', 'executing') 
       AND created_at < NOW() - INTERVAL ${COMMAND_TIMEOUT_SECONDS} SECOND`,
      [getBeijingTimeForDB(), id]
    )

    // 解锁超时的执行器
    await db.execute(
      `UPDATE actuators 
       SET locked = 0 
       WHERE id = ? AND locked = 1`,
      [id]
    )

    const commands = await db.query<ActuatorCommand[]>(
      `SELECT id, actuator_id, command, 
              control_value, 
              status, created_at, executed_at
       FROM actuator_commands 
       WHERE actuator_id = ? 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [id]
    )

    if (commands.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '没有待执行的指令',
      })
    }

    // 如果是硬件端查询待执行指令，返回第一条待执行或执行中的指令
    // 允许硬件端重新获取 executing 状态的指令（防止网络中断后无法恢复）
    const pendingCommand = commands.find(c => c.status === 'pending' || c.status === 'executing')
    if (pendingCommand) {
      // 如果是 pending 状态，标记为 executing
      if (pendingCommand.status === 'pending') {
        await db.execute(
          `UPDATE actuator_commands 
           SET status = 'executing' 
           WHERE id = ? AND actuator_id = ?`,
          [pendingCommand.id, id]
        )
      }

      console.log(`[Command] 硬件端查询指令 - 执行器: ${id}, 指令: ${pendingCommand.command}, 控制值: ${pendingCommand.control_value}, 命令ID: ${pendingCommand.id}, 当前状态: ${pendingCommand.status}`)

      return NextResponse.json({
        success: true,
        data: {
          ...pendingCommand,
          status: 'executing'
        },
        message: 'OK',
      })
    }

    // 硬件端查询时，没有待执行指令则返回null
    // 前端查询状态，返回最新一条指令（通过查询参数区分）
    const url = new URL(request.url)
    const isFrontend = url.searchParams.get('frontend') === 'true'
    
    if (isFrontend && commands.length > 0) {
      // 前端查询状态，返回最新一条指令
      const latestCommand = commands[0]
      return NextResponse.json({
        success: true,
        data: latestCommand,
        message: 'OK',
      })
    }

    // 硬件端查询，没有待执行指令
    return NextResponse.json({
      success: true,
      data: null,
      message: '没有待执行的指令',
    })
  } catch (error) {
    console.error('[Command] 查询控制指令失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '查询控制指令失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/actuators/[id]/commands
 * 网页端发送控制指令
 * 支持多种控制类型：
 * - 布尔值控制（on/off）：LED开关、继电器、水泵等
 * - 整数值控制（0-100）：电机速度、亮度调节等
 * - 角度控制（0-180/360）：舵机角度等
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log(`[Command API] 收到控制指令 - 执行器ID: ${id}, Body:`, JSON.stringify(body))

    // 获取执行器信息，确定控制类型
    const actuatorInfo = await db.query<RowDataPacket[]>(
      'SELECT id, type_id, area, locked, status FROM actuators WHERE id = ?',
      [id]
    )

    if (actuatorInfo.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    const actuator = actuatorInfo[0]

    // 检查执行器是否被锁定（正在执行其他指令）
    if (actuator.locked === 1) {
      return NextResponse.json(
        { success: false, error: '执行器正在执行其他指令，请稍后再试' },
        { status: 409 }
      )
    }

    // 检查执行器是否在线（离线时仍然允许发送指令，等待设备上线后查询）
    if (actuator.status !== 'online') {
      console.warn(`[Command] 执行器离线，但仍接受指令: ${id}`)
      // 继续处理，不阻止指令发送
    }

    // 获取执行器类型配置
    const typeInfo = await db.query<RowDataPacket[]>(
      'SELECT type FROM actuator_types WHERE id = ?',
      [actuatorInfo[0].type_id]
    )

    let command: 'on' | 'off' | 'value' = 'on'
    let controlValue: number | null = null
    const controlType = body.control_type || 'boolean'

    switch (controlType) {
      case 'boolean':
        if (!body.command || !['on', 'off'].includes(body.command)) {
          return NextResponse.json(
            { success: false, error: '布尔值控制：command 必须是 on 或 off' },
            { status: 400 }
          )
        }
        command = body.command as 'on' | 'off'
        break
      
      case 'integer':
      case 'angle':
      case 'float':
        if (body.value === undefined || body.value === null) {
          return NextResponse.json(
            { success: false, error: `${controlType}控制：必须提供value字段` },
            { status: 400 }
          )
        }
        command = 'value'
        controlValue = parseFloat(body.value)
        
        // 验证数值范围（可选）
        if (body.min !== undefined && controlValue < body.min) {
          return NextResponse.json(
            { success: false, error: `value不能小于${body.min}` },
            { status: 400 }
          )
        }
        if (body.max !== undefined && controlValue > body.max) {
          return NextResponse.json(
            { success: false, error: `value不能大于${body.max}` },
            { status: 400 }
          )
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: `不支持的控制类型: ${controlType}` },
          { status: 400 }
        )
    }

    // 锁定执行器，防止重复操作
    await db.execute(
      'UPDATE actuators SET locked = 1 WHERE id = ?',
      [id]
    )

    const result = await db.execute<ResultSetHeader>(
      'INSERT INTO actuator_commands (actuator_id, command, control_value) VALUES (?, ?, ?)',
      [id, command, controlValue]
    )

    const commandId = result.lastID
    
    // 尝试通过WebSocket发送实时命令
    const commandData = {
      id: commandId,
      actuator_id: id,
      command: command,
      control_value: controlValue,
      control_type: controlType,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    
    const sentViaWebSocket = await sendCommandToActuator(id, commandData)
    
    console.log(`[Command] 网页端发送指令 - 执行器: ${id}, 指令: ${command}, 控制值: ${controlValue}, 控制类型: ${controlType}, WebSocket: ${sentViaWebSocket}`)

    // 设置超时定时器（后端自动处理超时）
    setTimeout(async () => {
      try {
        // 检查指令是否仍处于待执行或执行中状态
        const checkResult = await db.query<ActuatorCommand[]>(
          'SELECT status FROM actuator_commands WHERE id = ? AND actuator_id = ?',
          [commandId, id]
        )
        
        if (checkResult.length > 0 && 
            (checkResult[0].status === 'pending' || checkResult[0].status === 'executing')) {
          // 标记为超时
          await db.execute(
            'UPDATE actuator_commands SET status = ?, executed_at = ? WHERE id = ? AND actuator_id = ?',
            ['timeout', getBeijingTimeForDB(), commandId, id]
          )
          
          // 解锁执行器
          await db.execute(
            'UPDATE actuators SET locked = 0 WHERE id = ?',
            [id]
          )
          
          console.log(`[Command] 指令超时 - 执行器: ${id}, 指令ID: ${commandId}`)
        }
      } catch (error) {
        console.error('[Command] 超时处理失败:', error)
      }
    }, COMMAND_TIMEOUT_SECONDS * 1000)

    return NextResponse.json({
      success: true,
      data: {
        id: commandId,
        actuator_id: id,
        command: command,
        control_value: controlValue,
        control_type: controlType,
        status: 'pending',
        sent_via_websocket: sentViaWebSocket,
        timeout: COMMAND_TIMEOUT_SECONDS
      },
      message: 'OK',
    })
  } catch (error) {
    console.error('[Command] 发送控制指令失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '发送控制指令失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/actuators/[id]/commands
 * 硬件端确认指令执行结果（回执）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log(`[Command PATCH] 收到回执 - 执行器ID: ${id}, Body:`, JSON.stringify(body))

    if (!body.command_id || !body.status || !['executed', 'failed'].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：command_id 和 status（executed/failed）' },
        { status: 400 }
      )
    }

    // 验证命令是否存在且状态为执行中或待执行
    const existingCommand = await db.query<ActuatorCommand[]>(
      `SELECT id, status, command, control_value FROM actuator_commands 
       WHERE id = ? AND actuator_id = ?`,
      [body.command_id, id]
    )

    if (existingCommand.length === 0) {
      return NextResponse.json(
        { success: false, error: '命令不存在' },
        { status: 404 }
      )
    }

    if (existingCommand[0].status !== 'executing' && existingCommand[0].status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '命令状态不正确' },
        { status: 400 }
      )
    }

    // 更新命令状态
    await db.execute<ResultSetHeader>(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = ? 
       WHERE id = ? AND actuator_id = ?`,
      [body.status, getBeijingTimeForDB(), body.command_id, id]
    )

    // 如果指令执行成功，更新执行器状态
    if (body.status === 'executed') {
      const command = existingCommand[0]
      const controlValue = body.control_value !== undefined ? body.control_value : command.control_value
      
      if (command.command === 'on' || command.command === 'off') {
        await db.execute<ResultSetHeader>(
          'UPDATE actuators SET state = ?, last_update = ? WHERE id = ?',
          [command.command, getBeijingTimeForDB(), id]
        )
      } else if (command.command === 'value' && controlValue !== undefined && controlValue !== null) {
        // 对于数值控制，更新控制值并根据值判断状态
        const state = controlValue > 0 ? 'on' : 'off'
        await db.execute<ResultSetHeader>(
          'UPDATE actuators SET state = ?, control_value = ?, last_update = ? WHERE id = ?',
          [state, controlValue, getBeijingTimeForDB(), id]
        )
      } else if (command.command === 'value') {
        // 如果没有提供控制值，默认关闭
        await db.execute<ResultSetHeader>(
          'UPDATE actuators SET state = ?, last_update = ? WHERE id = ?',
          ['off', getBeijingTimeForDB(), id]
        )
      }

      console.log(`[Command] 硬件回执确认成功 - 执行器: ${id}, 指令ID: ${body.command_id}, 状态: ${body.status}, 控制值: ${controlValue}`)
    } else {
      console.log(`[Command] 硬件回执确认失败 - 执行器: ${id}, 指令ID: ${body.command_id}, 状态: ${body.status}`)
    }

    // 解锁执行器，允许用户继续操作
    await db.execute<ResultSetHeader>(
      'UPDATE actuators SET locked = 0 WHERE id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      message: 'OK',
    })
  } catch (error) {
    console.error('[Command] 确认控制指令失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '确认控制指令失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}