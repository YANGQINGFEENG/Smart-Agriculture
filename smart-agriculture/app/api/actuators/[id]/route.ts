import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { createLogger } from '@/lib/logger';

const log = createLogger('ActuatorId');

/**
 * 执行器数据接口
 */
interface Actuator extends RowDataPacket {
  id: string
  name: string
  type_id: number
  location: string
  status: 'online' | 'offline'
  state: 'on' | 'off'
  mode: 'auto' | 'manual'
  control_value: number | null
  last_update: Date | null
  locked: number
  feedback: string | null
}

/**
 * 执行器状态历史接口
 */
interface ActuatorStatusHistory extends RowDataPacket {
  id: number
  actuator_id: string
  state: 'on' | 'off'
  mode: 'auto' | 'manual'
  trigger_source: string
  timestamp: Date
}

/**
 * GET /api/actuators/[id]
 * 获取单个执行器详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const actuators = await db.query<Actuator[]>(
      `SELECT 
        a.id, 
        a.name, 
        a.type_id, 
        a.location, 
        a.status, 
        a.state, 
        a.mode,
        a.control_value,
        a.last_update, 
        a.created_at,
        a.feedback,
        at.type,
        at.name as type_name,
        at.description
      FROM actuators a
      INNER JOIN actuator_types at ON a.type_id = at.id
      WHERE a.id = ?`,
      [id]
    )

    if (actuators.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    // 解析feedback JSON字段
    const actuator = actuators[0]
    const result: any = { ...actuator }
    
    // feedback可能是：
    // 1. null (数据库返回的NULL)
    // 2. 字符串 (需要JSON.parse)
    // 3. 对象 (mysql2自动解析了JSON字段)
    if (result.feedback !== null && result.feedback !== undefined) {
      if (typeof result.feedback === 'string') {
        try {
          result.feedback = JSON.parse(result.feedback)
        } catch {
          result.feedback = {}
        }
      }
      // 如果已经是对象，直接使用
    }
    
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    log.error('获取执行器详情失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取执行器详情失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/actuators/[id]
 * 更新执行器状态（仅限用户操作）
 * 
 * 服务器状态锁定原则：
 * - 只有用户通过网页端操作才能修改执行器的 state 和 mode
 * - 硬件端上报的状态不会通过此接口修改服务器状态
 * - 修改后服务器状态立即锁定，等待硬件端同步
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    log.info(`收到用户操作请求 - ID: ${id}, 数据:`, JSON.stringify(body))

    const actuators = await db.query<Actuator[]>(
      'SELECT id, state, mode, locked FROM actuators WHERE id = ?',
      [id]
    )

    if (actuators.length === 0) {
      log.info(`执行器不存在: ${id}`)
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    // 检查执行器是否被锁定
    if (actuators[0].locked) {
      log.info(`执行器已被锁定，拒绝操作: ${id}`)
      return NextResponse.json(
        { success: false, error: '执行器正在执行操作，请稍后再试' },
        { status: 423 }
      )
    }

    const oldState = actuators[0].state
    const oldMode = actuators[0].mode

    const updates: string[] = []
    const values: any[] = []

    if (body.state !== undefined) {
      let stateValue: 'on' | 'off'
      
      if (typeof body.state === 'number') {
        stateValue = body.state === 1 ? 'on' : 'off'
      } else if (typeof body.state === 'string') {
        if (!['on', 'off'].includes(body.state)) {
          return NextResponse.json(
            { success: false, error: 'state 必须是 on/off 或 0/1' },
            { status: 400 }
          )
        }
        stateValue = body.state
      } else {
        return NextResponse.json(
          { success: false, error: 'state 格式错误' },
          { status: 400 }
        )
      }
      
      updates.push('state = ?')
      values.push(stateValue)
    }

    if (body.mode !== undefined) {
      let modeValue: 'auto' | 'manual'
      
      if (typeof body.mode === 'number') {
        modeValue = body.mode === 1 ? 'manual' : 'auto'
      } else if (typeof body.mode === 'string') {
        if (!['auto', 'manual'].includes(body.mode)) {
          return NextResponse.json(
            { success: false, error: 'mode 必须是 auto/manual 或 0/1' },
            { status: 400 }
          )
        }
        modeValue = body.mode
      } else {
        return NextResponse.json(
          { success: false, error: 'mode 格式错误' },
          { status: 400 }
        )
      }
      
      updates.push('mode = ?')
      values.push(modeValue)
    }

    if (body.status !== undefined) {
      let statusValue: 'online' | 'offline'
      
      if (typeof body.status === 'number') {
        statusValue = body.status === 1 ? 'online' : 'offline'
      } else if (typeof body.status === 'string') {
        if (!['online', 'offline'].includes(body.status)) {
          return NextResponse.json(
            { success: false, error: 'status 必须是 online/offline 或 0/1' },
            { status: 400 }
          )
        }
        statusValue = body.status
      } else {
        return NextResponse.json(
          { success: false, error: 'status 格式错误' },
          { status: 400 }
        )
      }
      
      updates.push('status = ?')
      values.push(statusValue)
    }

    if (body.locked !== undefined) {
      let lockedValue: number
      
      if (typeof body.locked === 'number') {
        lockedValue = body.locked === 1 ? 1 : 0
      } else if (typeof body.locked === 'boolean') {
        lockedValue = body.locked ? 1 : 0
      } else {
        return NextResponse.json(
          { success: false, error: 'locked 格式错误' },
          { status: 400 }
        )
      }
      
      updates.push('locked = ?')
      values.push(lockedValue)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的字段' },
        { status: 400 }
      )
    }

    // 只有当不是专门更新 locked 字段时，才自动设置 locked = 1
    const isLockedUpdateOnly = updates.length === 1 && updates[0].includes('locked')
    if (!isLockedUpdateOnly) {
      updates.push(`last_update = '${getBeijingTimeForDB()}', locked = 1`)
    } else {
      // 如果是专门更新 locked 字段，只更新时间戳
      updates.push(`last_update = '${getBeijingTimeForDB()}'`)
    }
    values.push(id)

    // 更新服务器执行器状态（锁定为用户期望的状态）
    await db.execute<ResultSetHeader>(
      `UPDATE actuators SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // 记录用户操作到历史表
    if (body.state !== undefined || body.mode !== undefined) {
      const currentState = await db.query<Actuator[]>(
        'SELECT state, mode FROM actuators WHERE id = ?',
        [id]
      )

      if (currentState.length > 0) {
        await db.executeWithRetry(
          `INSERT INTO actuator_status_history (actuator_id, state, mode, trigger_source) 
           VALUES (?, ?, ?, ?)`,
          [
            id,
            currentState[0].state,
            currentState[0].mode,
            body.trigger_source || 'user'
          ]
        )
      }
    }

    // 如果用户修改了 state，同时下发一条控制指令到指令表
    if (body.state !== undefined) {
      const newState = body.state === 1 ? 'on' : body.state === 0 ? 'off' : body.state
      await db.executeWithRetry(
        `INSERT INTO actuator_commands (actuator_id, command, status, created_at) 
         VALUES (?, ?, 'pending', ?)`,
        [id, newState, getBeijingTimeForDB()]
      )
      log.info(`用户操作已锁定 - ID: ${id}, 新状态: ${newState}, 已下发控制指令`)
    }

    const updatedActuators = await db.query<Actuator[]>(
      `SELECT 
        a.id, 
        a.name, 
        a.type_id, 
        a.location, 
        a.status, 
        a.state, 
        a.mode,
        a.last_update, 
        a.created_at,
        at.type,
        at.name as type_name,
        at.description
      FROM actuators a
      INNER JOIN actuator_types at ON a.type_id = at.id
      WHERE a.id = ?`,
      [id]
    )

    log.info(`服务器状态已锁定 - ID: ${id}, 状态: ${updatedActuators[0].state}, 模式: ${updatedActuators[0].mode}`)

    return NextResponse.json({
      success: true,
      data: updatedActuators[0],
      message: '服务器状态已锁定，等待硬件同步',
    })
  } catch (error) {
    log.error('用户操作失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '用户操作失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/actuators/[id]
 * 硬件端上传执行器状态
 * 支持数字格式：state(0/1), mode(0/1), status(0/1)
 * 
 * 服务器状态锁定逻辑（用户操作优先，硬件状态只用于对比）：
 * 1. 服务器状态由用户手动操作锁定，硬件上报的状态不会修改服务器状态
 * 2. 硬件上传状态仅用于与服务器状态对比
 * 3. 如果状态一致，返回成功，不做任何修改
 * 4. 如果状态不一致，返回 force_sync 指令，要求硬件强制同步服务器状态
 * 5. 硬件端必须无条件执行服务器状态
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    log.info(`收到硬件状态上报 - ID: ${id}, 数据:`, JSON.stringify(body))

    const actuators = await db.query<Actuator[]>(
      'SELECT id, state, mode FROM actuators WHERE id = ?',
      [id]
    )

    if (actuators.length === 0) {
      log.info(`执行器不存在: ${id}`)
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    const hardwareState: 'on' | 'off' | undefined = 
      body.state === 1 ? 'on' : body.state === 0 ? 'off' : 
      typeof body.state === 'string' ? body.state : undefined
    
    const hardwareMode: 'auto' | 'manual' | undefined = 
      body.mode === 1 ? 'manual' : body.mode === 0 ? 'auto' : 
      typeof body.mode === 'string' ? body.mode : undefined

    const serverState = actuators[0].state
    const serverMode = actuators[0].mode

    log.info(`状态对比 - ID: ${id}`)
    log.info(`  服务器锁定状态: ${serverState}, 服务器模式: ${serverMode}`)
    log.info(`  硬件上报状态: ${hardwareState || '未提供'}, 硬件模式: ${hardwareMode || '未提供'}`)

    // 更新设备在线状态（仅此一项允许硬件修改）
    if (body.status !== undefined) {
      let statusValue: 'online' | 'offline'
      
      if (typeof body.status === 'number') {
        statusValue = body.status === 1 ? 'online' : 'offline'
      } else if (typeof body.status === 'string') {
        if (!['online', 'offline'].includes(body.status)) {
          return NextResponse.json(
            { success: false, error: 'status 必须是 online/offline 或 0/1' },
            { status: 400 }
          )
        }
        statusValue = body.status
      } else {
        return NextResponse.json(
          { success: false, error: 'status 格式错误' },
          { status: 400 }
        )
      }
      
      await db.execute<ResultSetHeader>(
        'UPDATE actuators SET status = ?, last_update = ? WHERE id = ?',
        [statusValue, getBeijingTimeForDB(), id]
      )
    }

    // 对比硬件状态与服务器锁定状态
    const stateMismatch = hardwareState && hardwareState !== serverState
    const modeMismatch = hardwareMode && hardwareMode !== serverMode

    if (stateMismatch || modeMismatch) {
      // 状态不一致 → 服务器状态锁定，要求硬件强制同步
      log.info(`状态冲突 - ID: ${id}, 服务器锁定状态: ${serverState}/${serverMode}, 硬件上报: ${hardwareState}/${hardwareMode}`)
      log.info(`下发强制同步指令，要求硬件匹配服务器状态`)

      // 记录硬件上报的状态到历史表（用于追踪硬件实际状态变化）
      await db.executeWithRetry(
        `INSERT INTO actuator_status_history (actuator_id, state, mode, trigger_source, timestamp) 
         VALUES (?, ?, ?, 'hardware_report', ?)`,
        [id, hardwareState || serverState, hardwareMode || serverMode, getBeijingTimeForDB()]
      )

      // 同时下发一条控制指令到指令表（双保险：即使硬件不处理force_sync响应，下次查询指令也能获取）
      await db.executeWithRetry(
        `INSERT INTO actuator_commands (actuator_id, command, status, created_at) 
         VALUES (?, ?, 'pending', ?)`,
        [id, serverState, getBeijingTimeForDB()]
      )

      return NextResponse.json({
        success: true,
        action: 'force_sync',
        data: {
          server_state: serverState,
          server_mode: serverMode,
          hardware_state: hardwareState,
          hardware_mode: hardwareMode,
          mismatch: {
            state: stateMismatch,
            mode: modeMismatch,
          },
        },
        message: '状态不一致，硬件必须强制同步服务器锁定状态',
      })
    }

    // 状态一致 → 无需任何操作
    log.info(`状态一致 - ID: ${id}, 服务器锁定状态: ${serverState}/${serverMode}`)

    return NextResponse.json({
      success: true,
      action: 'sync_success',
      data: {
        server_state: serverState,
        server_mode: serverMode,
      },
      message: '状态一致，服务器锁定状态不变',
    })
  } catch (error) {
    log.error('硬件状态上报处理失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '硬件状态上报处理失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/actuators/[id]
 * 更新执行器信息
 * 支持更新：name（名称）、location（位置）、area（区域）等字段
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // 检查执行器是否存在
    const existing = await db.query<Actuator[]>(
      'SELECT id FROM actuators WHERE id = ?',
      [id]
    )

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    const updates: string[] = []
    const values: any[] = []

    // 允许更新的字段
    if (body.name !== undefined && body.name !== null) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.location !== undefined && body.location !== null) {
      updates.push('location = ?')
      values.push(body.location)
    }
    if (body.area !== undefined) {
      updates.push('area = ?')
      values.push(body.area)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有提供需要更新的字段' },
        { status: 400 }
      )
    }

    values.push(id)
    await db.execute(
      `UPDATE actuators SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // 获取更新后的执行器信息
    const updatedActuator = await db.query<Actuator[]>(
      `SELECT 
        a.id, 
        a.name, 
        a.type_id, 
        a.location, 
        a.status, 
        a.state, 
        a.mode,
        a.last_update, 
        a.created_at,
        at.type,
        at.name as type_name,
        at.description
      FROM actuators a
      INNER JOIN actuator_types at ON a.type_id = at.id
      WHERE a.id = ?`,
      [id]
    )

    return NextResponse.json({
      success: true,
      data: updatedActuator[0],
      message: '执行器信息更新成功',
    })
  } catch (error) {
    log.error('更新执行器失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新执行器失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/actuators/[id]
 * 删除执行器
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const actuators = await db.query<Actuator[]>(
      'SELECT id FROM actuators WHERE id = ?',
      [id]
    )

    if (actuators.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    await db.execute<ResultSetHeader>(
      'DELETE FROM actuator_status_history WHERE actuator_id = ?',
      [id]
    )

    await db.execute<ResultSetHeader>(
      'DELETE FROM actuators WHERE id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      message: '执行器删除成功',
    })
  } catch (error) {
    log.error('删除执行器失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '删除执行器失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
