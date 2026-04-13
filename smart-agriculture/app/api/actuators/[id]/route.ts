import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'

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
  last_update: Date | null
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

    if (actuators.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: actuators[0],
    })
  } catch (error) {
    console.error('获取执行器详情失败:', error)
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
 * 更新执行器状态（开关、模式）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log(`[Actuator] 收到执行器状态更新请求 - ID: ${id}, 数据:`, JSON.stringify(body))

    const actuators = await db.query<Actuator[]>(
      'SELECT id FROM actuators WHERE id = ?',
      [id]
    )

    if (actuators.length === 0) {
      console.log(`[Actuator] 执行器不存在: ${id}`)
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

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

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的字段' },
        { status: 400 }
      )
    }

    updates.push('last_update = CURRENT_TIMESTAMP')
    values.push(id)

    await db.execute<ResultSetHeader>(
      `UPDATE actuators SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // 记录状态历史
    if (body.state !== undefined || body.mode !== undefined) {
      const currentState = await db.query<Actuator[]>(
        'SELECT state, mode FROM actuators WHERE id = ?',
        [id]
      )

      if (currentState.length > 0) {
        await db.execute<ResultSetHeader>(
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

    console.log(`[Actuator] 执行器状态更新成功 - ID: ${id}, 状态: ${updatedActuators[0].state}, 模式: ${updatedActuators[0].mode}`)

    return NextResponse.json({
      success: true,
      data: updatedActuators[0],
      message: 'OK',
    })
  } catch (error) {
    console.error('[Actuator] 更新执行器状态失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '更新执行器状态失败',
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
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log(`[Actuator] 收到执行器状态上传请求 - ID: ${id}, 数据:`, JSON.stringify(body))

    const actuators = await db.query<Actuator[]>(
      'SELECT id FROM actuators WHERE id = ?',
      [id]
    )

    if (actuators.length === 0) {
      console.log(`[Actuator] 执行器不存在: ${id}`)
      return NextResponse.json(
        { success: false, error: '执行器不存在' },
        { status: 404 }
      )
    }

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

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的字段' },
        { status: 400 }
      )
    }

    updates.push('last_update = CURRENT_TIMESTAMP')
    values.push(id)

    await db.execute<ResultSetHeader>(
      `UPDATE actuators SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const currentState = await db.query<Actuator[]>(
      'SELECT state, mode FROM actuators WHERE id = ?',
      [id]
    )

    if (currentState.length > 0) {
      await db.execute<ResultSetHeader>(
        `INSERT INTO actuator_status_history (actuator_id, state, mode, trigger_source, timestamp) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          id,
          currentState[0].state,
          currentState[0].mode,
          body.trigger_source || 'hardware'
        ]
      )
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

    console.log(`[Actuator] 执行器状态更新成功 - ID: ${id}, 状态: ${updatedActuators[0].state}, 模式: ${updatedActuators[0].mode}`)

    return NextResponse.json({
      success: true,
      data: updatedActuators[0],
      message: 'OK',
    })
  } catch (error) {
    console.error('[Actuator] 上传执行器状态失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '上传执行器状态失败',
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
    console.error('删除执行器失败:', error)
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
