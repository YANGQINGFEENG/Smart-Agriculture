import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { sendCommandToActuator } from '@/app/api/websocket/route'

/**
 * 控制指令接口
 */
interface ActuatorCommand extends RowDataPacket {
  id: number
  actuator_id: string
  command: 'on' | 'off'
  status: 'pending' | 'executed' | 'failed'
  created_at: Date
  executed_at: Date | null
}

/**
 * GET /api/actuators/[id]/commands
 * 硬件端查询待执行的控制指令
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
       SET status = 'failed', executed_at = CURRENT_TIMESTAMP 
       WHERE actuator_id = ? AND status = 'pending' 
       AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [id]
    )

    const commands = await db.query<ActuatorCommand[]>(
      `SELECT id, actuator_id, command, status, created_at 
       FROM actuator_commands 
       WHERE actuator_id = ? AND status = 'pending' 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [id]
    )

    if (commands.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '没有待执行的指令',
      })
    }

    const command = commands[0]
    
    // 将命令状态更新为执行中，避免重复执行
    await db.execute(
      `UPDATE actuator_commands 
       SET status = 'executing' 
       WHERE id = ? AND actuator_id = ?`,
      [command.id, id]
    )

    console.log(`[Command] 硬件端查询指令 - 执行器: ${id}, 指令: ${command.command}, 命令ID: ${command.id}`)

    return NextResponse.json({
      success: true,
      data: {
        ...command,
        status: 'executing'
      },
      message: 'OK',
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
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.command || !['on', 'off'].includes(body.command)) {
      return NextResponse.json(
        { success: false, error: 'command 必须是 on 或 off' },
        { status: 400 }
      )
    }

    const actuators = await db.query<RowDataPacket[]>(
      'SELECT id FROM actuators WHERE id = ?',
      [id]
    )

    if (actuators.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    const result = await db.execute<ResultSetHeader>(
      'INSERT INTO actuator_commands (actuator_id, command) VALUES (?, ?)',
      [id, body.command]
    )

    const commandId = result.insertId
    
    // 尝试通过WebSocket发送实时命令
    const commandData = {
      id: commandId,
      actuator_id: id,
      command: body.command,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    
    const sentViaWebSocket = await sendCommandToActuator(id, commandData)
    
    console.log(`[Command] 网页端发送指令 - 执行器: ${id}, 指令: ${body.command}, WebSocket: ${sentViaWebSocket}`)

    return NextResponse.json({
      success: true,
      data: {
        id: commandId,
        actuator_id: id,
        command: body.command,
        status: 'pending',
        sent_via_websocket: sentViaWebSocket
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
 * 硬件端确认指令执行结果
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.command_id || !body.status || !['executed', 'failed'].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：command_id 和 status（executed/failed）' },
        { status: 400 }
      )
    }

    // 验证命令是否存在且状态为执行中
    const existingCommand = await db.query<ActuatorCommand[]>(
      `SELECT id, status FROM actuator_commands 
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

    await db.execute<ResultSetHeader>(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND actuator_id = ?`,
      [body.status, body.command_id, id]
    )

    // 解锁执行器，允许用户继续操作
    await db.execute<ResultSetHeader>(
      'UPDATE actuators SET locked = 0 WHERE id = ?',
      [id]
    )

    console.log(`[Command] 硬件端确认指令 - 执行器: ${id}, 指令ID: ${body.command_id}, 状态: ${body.status}`)

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
