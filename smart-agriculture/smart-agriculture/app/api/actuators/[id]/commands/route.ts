import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

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

    console.log(`[Command] 硬件端查询指令 - 执行器: ${id}, 指令: ${commands[0].command}`)

    return NextResponse.json({
      success: true,
      data: commands[0],
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

    console.log(`[Command] 网页端发送指令 - 执行器: ${id}, 指令: ${body.command}`)

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertId,
        actuator_id: id,
        command: body.command,
        status: 'pending',
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

    await db.execute<ResultSetHeader>(
      `UPDATE actuator_commands 
       SET status = ?, executed_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND actuator_id = ?`,
      [body.status, body.command_id, id]
    )

    if (body.status === 'executed') {
      const command = await db.query<ActuatorCommand[]>(
        'SELECT command FROM actuator_commands WHERE id = ?',
        [body.command_id]
      )

      if (command.length > 0) {
        await db.execute<ResultSetHeader>(
          'UPDATE actuators SET state = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?',
          [command[0].command, id]
        )
      }
    }

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
