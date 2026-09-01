import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import http from 'http'

/**
 * 执行器命令下发 API
 * 路由: /api/actuators/[id]/commands
 *
 * 提供三个方法：
 * - POST: 前端下发控制命令（含 boolean/integer/angle/float/rgb/camera 多种控制类型）
 * - GET : 前端轮询命令状态（?frontend=true）或硬件端轮询待执行命令（默认）
 * - PATCH: 硬件端回执确认（备用，主用 /api/device/ack）
 *
 * camera 命令支持六种子类型：on / off / value / track / color / reset
 * 详见文档《摄像头模块集成说明.md》第十三章、第十六章
 */

/** 命令记录接口 */
interface CommandRow extends RowDataPacket {
  id: number
  actuator_id: string
  command: string
  control_value: number | null
  command_data: string | null
  status: string
  created_at: Date
  executed_at: Date | null
}

/** 执行器记录接口（actuators 表无 type 字段，type 通过 JOIN actuator_types 获取） */
interface ActuatorRow extends RowDataPacket {
  id: string
  name: string
  type_id: number
  state: string
  mode: string
  status: string
  locked: number
  control_type: string | null
}

/** 支持的摄像头命令子类型 */
const CAMERA_COMMANDS = ['on', 'off', 'value', 'track', 'color', 'reset', 'gyro'] as const
/** 支持的追踪颜色预设 */
const CAMERA_COLORS = ['red', 'blue', 'green', 'yellow', 'orange']
/** 支持的 RGB 命令子类型 */
const RGB_COMMANDS = ['value', 'color', 'preset'] as const

/**
 * 通过 HTTP 转发将命令推送到 WebSocket 服务器
 * WebSocket 服务器监听 8081 端口的 /send-command 接口
 * 推送失败不影响命令入库，硬件端可通过 HTTP 轮询兜底获取
 */
function pushCommandViaWebSocket(actuatorId: string, commandData: Record<string, any>): Promise<boolean> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ actuator_id: actuatorId, command: commandData })
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8081,
        path: '/send-command',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          try {
            const result = JSON.parse(body)
            resolve(result.success === true)
          } catch {
            resolve(false)
          }
        })
      }
    )
    req.on('error', (err) => {
      console.error('[Commands] WebSocket 推送失败:', err.message)
      resolve(false)
    })
    req.on('timeout', () => {
      req.destroy()
      console.error('[Commands] WebSocket 推送超时')
      resolve(false)
    })
    req.write(payload)
    req.end()
  })
}

/**
 * 校验并构造 camera 命令的存储数据
 * 返回 { controlValue, commandData, wsPayload } 或抛出错误
 */
function buildCameraCommand(
  command: string,
  body: any
): { controlValue: number | null; commandData: any; wsPayload: any } {
  const wsPayload: any = { control_type: 'camera', camera_command: command }

  switch (command) {
    case 'on':
    case 'off':
    case 'reset':
      return {
        controlValue: null,
        commandData: { type: command },
        wsPayload,
      }

    case 'value': {
      // 三种参数形式：pan+tilt 绝对角度 / pan_delta+tilt_delta 增量 / value 字符串
      if (typeof body.pan === 'number' && typeof body.tilt === 'number') {
        const pan = Math.max(0, Math.min(180, body.pan))
        const tilt = Math.max(0, Math.min(180, body.tilt))
        Object.assign(wsPayload, { pan, tilt })
        return {
          controlValue: pan,
          commandData: { type: 'value', pan, tilt },
          wsPayload,
        }
      }
      if (typeof body.pan_delta === 'number' && typeof body.tilt_delta === 'number') {
        Object.assign(wsPayload, { pan_delta: body.pan_delta, tilt_delta: body.tilt_delta })
        return {
          controlValue: body.pan_delta,
          commandData: { type: 'value', pan_delta: body.pan_delta, tilt_delta: body.tilt_delta },
          wsPayload,
        }
      }
      if (body.value !== undefined && body.value !== null) {
        const strVal = String(body.value)
        wsPayload.value = strVal
        return {
          controlValue: null,
          commandData: { type: 'value', value: strVal },
          wsPayload,
        }
      }
      throw new Error('value 命令需要 pan+tilt 或 pan_delta+tilt_delta 或 value 参数')
    }

    case 'track': {
      // 支持 on/off/true/false/1/0 多种格式
      const v = body.value
      let trackOn: boolean
      if (v === 'on' || v === true || v === 1) trackOn = true
      else if (v === 'off' || v === false || v === 0) trackOn = false
      else throw new Error("track 命令的 value 必须是 on/off/true/false/1/0")

      wsPayload.value = trackOn ? 'on' : 'off'
      return {
        controlValue: trackOn ? 1 : 0,
        commandData: { type: 'track', value: trackOn ? 'on' : 'off' },
        wsPayload,
      }
    }

    case 'color': {
      const color = body.color || body.value
      if (!color || !CAMERA_COLORS.includes(String(color))) {
        throw new Error(`color 命令需要合法颜色: ${CAMERA_COLORS.join('/')}`)
      }
      wsPayload.color = String(color)
      return {
        controlValue: null,
        commandData: { type: 'color', color: String(color) },
        wsPayload,
      }
    }

    case 'gyro': {
      // 陀螺仪手势控制开关：value 为 'on'/'off'/true/false/1/0
      const v = body.value
      let gyroOn: boolean
      if (v === 'on' || v === true || v === 1) gyroOn = true
      else if (v === 'off' || v === false || v === 0) gyroOn = false
      else throw new Error("gyro 命令的 value 必须是 on/off/true/false/1/0")

      wsPayload.value = gyroOn ? 'on' : 'off'
      return {
        controlValue: gyroOn ? 1 : 0,
        commandData: { type: 'gyro', value: gyroOn ? 'on' : 'off' },
        wsPayload,
      }
    }

    default:
      throw new Error(`不支持的 camera 命令: ${command}`)
  }
}

/**
 * 校验并构造 RGB 命令的存储数据
 */
function buildRgbCommand(
  command: string,
  body: any
): { controlValue: number | null; commandData: any; wsPayload: any } {
  const wsPayload: any = { control_type: 'rgb' }

  switch (command) {
    case 'value': {
      if (typeof body.value !== 'number') throw new Error('RGB value 命令需要 value 数值')
      wsPayload.value = body.value
      return {
        controlValue: body.value,
        commandData: { type: 'value', value: body.value },
        wsPayload,
      }
    }
    case 'color': {
      const r = Number(body.r) || 0
      const g = Number(body.g) || 0
      const b = Number(body.b) || 0
      if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error('RGB color 命令的 r/g/b 范围必须是 0-255')
      }
      Object.assign(wsPayload, { r, g, b })
      return {
        controlValue: null,
        commandData: { type: 'color', r, g, b },
        wsPayload,
      }
    }
    case 'preset': {
      if (!body.preset) throw new Error('RGB preset 命令需要 preset 字段')
      wsPayload.preset = body.preset
      return {
        controlValue: null,
        commandData: { type: 'preset', preset: body.preset },
        wsPayload,
      }
    }
    default:
      throw new Error(`不支持的 rgb 命令: ${command}`)
  }
}

/**
 * POST /api/actuators/[id]/commands
 * 前端下发控制命令
 *
 * 请求体根据 control_type 不同而不同：
 * - boolean: { control_type:'boolean', command:'on'|'off' }
 * - integer/angle/float: { control_type:'integer', command:'value', value:60 }
 * - rgb: { control_type:'rgb', command:'value'|'color'|'preset', ... }
 * - camera: { control_type:'camera', command:'on'|'off'|'value'|'track'|'color'|'reset', ... }
 *
 * 返回: { success, data: { id, ... } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const controlType = body.control_type || 'boolean'
    const command = body.command

    console.log(`[Commands] 收到命令 - 执行器: ${id}, control_type: ${controlType}, command: ${command}`)

    // 校验执行器存在且未锁定
    const actuators = await db.query<ActuatorRow[]>(
      'SELECT id, name, type_id, state, mode, status, locked, control_type FROM actuators WHERE id = ?',
      [id]
    )
    if (actuators.length === 0) {
      return NextResponse.json({ success: false, error: '执行器不存在' }, { status: 404 })
    }
    if (actuators[0].locked) {
      return NextResponse.json(
        { success: false, error: '执行器正在执行操作，请稍后再试' },
        { status: 423 }
      )
    }

    // 根据 control_type 构造命令存储数据
    let controlValue: number | null = null
    let commandData: any = null
    let wsPayload: any = { actuator_id: id }

    switch (controlType) {
      case 'boolean': {
        if (!['on', 'off'].includes(command)) {
          return NextResponse.json(
            { success: false, error: 'boolean 命令必须是 on/off' },
            { status: 400 }
          )
        }
        wsPayload.command = command
        commandData = { type: command }
        break
      }

      case 'integer':
      case 'angle':
      case 'float': {
        if (command !== 'value' && command !== 'on' && command !== 'off') {
          return NextResponse.json(
            { success: false, error: `${controlType} 命令必须是 value/on/off` },
            { status: 400 }
          )
        }
        if (command === 'value') {
          if (typeof body.value !== 'number') {
            return NextResponse.json(
              { success: false, error: 'value 命令需要 value 数值' },
              { status: 400 }
            )
          }
          controlValue = body.value
          wsPayload.command = 'value'
          wsPayload.value = body.value
          commandData = { type: 'value', value: body.value }
        } else {
          wsPayload.command = command
          commandData = { type: command }
        }
        break
      }

      case 'rgb': {
        if (!RGB_COMMANDS.includes(command)) {
          return NextResponse.json(
            { success: false, error: `rgb 命令必须是 ${RGB_COMMANDS.join('/')}` },
            { status: 400 }
          )
        }
        const rgb = buildRgbCommand(command, body)
        controlValue = rgb.controlValue
        commandData = rgb.commandData
        wsPayload = { ...wsPayload, ...rgb.wsPayload }
        break
      }

      case 'camera': {
        if (!CAMERA_COMMANDS.includes(command)) {
          return NextResponse.json(
            { success: false, error: `camera 命令必须是 ${CAMERA_COMMANDS.join('/')}` },
            { status: 400 }
          )
        }
        const cam = buildCameraCommand(command, body)
        controlValue = cam.controlValue
        commandData = cam.commandData
        wsPayload = { ...wsPayload, ...cam.wsPayload }
        break
      }

      default:
        return NextResponse.json(
          { success: false, error: `不支持的 control_type: ${controlType}` },
          { status: 400 }
        )
    }

    // 入库：插入 actuator_commands 表
    const insertResult = await db.query<ResultSetHeader>(
      `INSERT INTO actuator_commands (actuator_id, command, control_value, command_data, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [id, String(command), controlValue, JSON.stringify(commandData), getBeijingTimeForDB()]
    )
    const commandId = insertResult.insertId
    console.log(`[Commands] 命令已入库 - ID: ${commandId}, command: ${command}, control_value: ${controlValue}`)

    // 锁定执行器
    await db.execute(
      'UPDATE actuators SET locked = 1, last_update = ? WHERE id = ?',
      [getBeijingTimeForDB(), id]
    )

    // 通过 WebSocket 实时推送（失败不影响主流程，硬件可轮询兜底）
    wsPayload.id = commandId
    wsPayload.actuator_id = id
    wsPayload.command = String(command)
    wsPayload.control_value = controlValue
    wsPayload.status = 'pending'
    wsPayload.created_at = getBeijingTimeForDB()

    const pushed = await pushCommandViaWebSocket(id, wsPayload)
    console.log(`[Commands] WebSocket 推送结果: ${pushed ? '成功' : '失败（硬件可轮询兜底）'}`)

    return NextResponse.json({
      success: true,
      data: {
        id: commandId,
        actuator_id: id,
        command: String(command),
        control_value: controlValue,
        control_type: controlType,
        status: 'pending',
        ws_pushed: pushed,
      },
      message: '命令已下发，等待硬件回执',
    })
  } catch (error) {
    console.error('[Commands] 下发命令失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '下发命令失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/actuators/[id]/commands
 * 获取命令状态/待执行命令
 *
 * - ?frontend=true: 前端轮询，返回该执行器最新一条命令的状态
 * - 默认: 硬件端轮询，返回最早一条 pending 命令并标记为 executing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const isFrontend = searchParams.get('frontend') === 'true'

    // 校验执行器存在
    const actuators = await db.query<ActuatorRow[]>(
      'SELECT id FROM actuators WHERE id = ?',
      [id]
    )
    if (actuators.length === 0) {
      return NextResponse.json({ success: false, error: '执行器不存在' }, { status: 404 })
    }

    // 前端轮询：返回最新一条命令
    if (isFrontend) {
      const rows = await db.query<CommandRow[]>(
        `SELECT id, actuator_id, command, control_value, command_data, status, created_at, executed_at
         FROM actuator_commands
         WHERE actuator_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [id]
      )
      if (rows.length === 0) {
        return NextResponse.json({ success: true, data: null })
      }
      const row = rows[0]
      let parsedData: any = null
      if (row.command_data) {
        try {
          parsedData = typeof row.command_data === 'string' ? JSON.parse(row.command_data) : row.command_data
        } catch {
          parsedData = null
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          id: row.id,
          actuator_id: row.actuator_id,
          command: row.command,
          control_value: row.control_value,
          command_data: parsedData,
          status: row.status,
          created_at: row.created_at,
          executed_at: row.executed_at,
        },
      })
    }

    // 硬件端轮询：返回最早一条 pending 命令并标记为 executing
    const pending = await db.query<CommandRow[]>(
      `SELECT id, actuator_id, command, control_value, command_data, status, created_at
       FROM actuator_commands
       WHERE actuator_id = ? AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
      [id]
    )

    if (pending.length === 0) {
      return NextResponse.json({ success: true, data: null, message: '没有待执行的指令' })
    }

    const cmd = pending[0]
    await db.execute(
      `UPDATE actuator_commands SET status = 'executing' WHERE id = ? AND actuator_id = ?`,
      [cmd.id, id]
    )

    let parsedData: any = null
    if (cmd.command_data) {
      try {
        parsedData = typeof cmd.command_data === 'string' ? JSON.parse(cmd.command_data) : cmd.command_data
      } catch {
        parsedData = null
      }
    }

    console.log(`[Commands] 硬件轮询到指令 - 执行器: ${id}, 命令ID: ${cmd.id}, command: ${cmd.command}`)

    return NextResponse.json({
      success: true,
      data: {
        id: cmd.id,
        actuator_id: cmd.actuator_id,
        command: cmd.command,
        control_value: cmd.control_value,
        command_data: parsedData,
        status: 'executing',
        created_at: cmd.created_at,
      },
      message: 'OK',
    })
  } catch (error) {
    console.error('[Commands] 获取命令失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取命令失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/actuators/[id]/commands
 * 硬件端回执确认（备用接口，主用 /api/device/ack）
 *
 * 请求体: { command_id, status: 'executed'|'failed', control_value?, state? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const commandId = body.command_id || body.commandId
    const status = body.status

    if (!commandId || !status || !['executed', 'failed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '需要 command_id 和 status(executed/failed)' },
        { status: 400 }
      )
    }

    // 查询命令是否存在
    const existing = await db.query<CommandRow[]>(
      'SELECT id, command, control_value FROM actuator_commands WHERE id = ? AND actuator_id = ?',
      [commandId, id]
    )
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '命令不存在' }, { status: 404 })
    }

    const cmd = existing[0]

    // 更新命令状态
    await db.execute(
      `UPDATE actuator_commands SET status = ?, executed_at = ? WHERE id = ? AND actuator_id = ?`,
      [status, getBeijingTimeForDB(), commandId, id]
    )

    if (status === 'executed') {
      const actualControlValue = body.control_value !== undefined ? body.control_value : cmd.control_value
      // 推断执行后状态
      let actualState = body.state
      if (!actualState) {
        if (cmd.command === 'on') actualState = 'on'
        else if (cmd.command === 'off') actualState = 'off'
        else if (cmd.command === 'value' && (actualControlValue || 0) > 0) actualState = 'on'
        else actualState = 'off'
      }

      // track/color/reset/gyro 命令不改变 state（由 feedback 上报反映），
      // 但必须同步更新 feedback 中的对应字段，避免前端等待数据上报周期（~30s）
      const noStateChangeCommands = ['track', 'color', 'reset', 'gyro']
      const shouldUpdateState = !noStateChangeCommands.includes(cmd.command)

      if (shouldUpdateState) {
        await db.execute(
          `UPDATE actuators SET state = ?, control_value = ?, last_update = ?, locked = 0 WHERE id = ?`,
          [actualState, actualControlValue !== undefined ? actualControlValue : null, getBeijingTimeForDB(), id]
        )
      } else {
        // 对 gyro/track/color 命令，合并 feedback 字段后立即写入，不等数据上报
        // 关键：只有当 feedback 已有数据时才合并写入，避免空对象覆盖 stream_url 等字段
        const [rows] = await db.query<any[]>(
          `SELECT feedback FROM actuators WHERE id = ?`, [id]
        )
        const existingFeedback = (rows.length > 0 && rows[0].feedback) 
          ? (typeof rows[0].feedback === 'string' ? JSON.parse(rows[0].feedback) : rows[0].feedback) 
          : {}
        
        const hasExistingData = Object.keys(existingFeedback).length > 0
        
        if (hasExistingData) {
          if (cmd.command === 'gyro') {
            // 从 command_data 或 control_value 中提取 gyro 值
            let cmdData = cmd.command_data
            if (cmdData && typeof cmdData === 'string') {
              try { cmdData = JSON.parse(cmdData) } catch {}
            }
            const gyroValue = (cmdData && cmdData.value) || cmd.control_value
            existingFeedback.gesture_control_enabled = (gyroValue === 'on' || gyroValue === true || gyroValue === 1)
          } else if (cmd.command === 'track') {
            let cmdData = cmd.command_data
            if (cmdData && typeof cmdData === 'string') {
              try { cmdData = JSON.parse(cmdData) } catch {}
            }
            const trackValue = (cmdData && cmdData.value) || cmd.control_value
            existingFeedback.tracking_enabled = (trackValue === 'on' || trackValue === true || trackValue === 1)
          } else if (cmd.command === 'color') {
            let cmdData = cmd.command_data
            if (cmdData && typeof cmdData === 'string') {
              try { cmdData = JSON.parse(cmdData) } catch {}
            }
            existingFeedback.color_preset = (cmdData && cmdData.color) || existingFeedback.color_preset
          }
          
          await db.execute(
            `UPDATE actuators SET last_update = ?, locked = 0, feedback = ? WHERE id = ?`,
            [getBeijingTimeForDB(), JSON.stringify(existingFeedback), id]
          )
          console.log(`[Commands] 回执成功(no-state-change) - 命令ID: ${commandId}, cmd: ${cmd.command}, feedback已同步`)
        } else {
          // feedback 为空（尚无数据上报），仅解锁，等待数据上报补充完整 feedback
          await db.execute(
            'UPDATE actuators SET last_update = ?, locked = 0 WHERE id = ?',
            [getBeijingTimeForDB(), id]
          )
          console.log(`[Commands] 回执成功(no-state-change) - 命令ID: ${commandId}, cmd: ${cmd.command}, feedback为空跳过写入`)
        }
      }
      console.log(`[Commands] 回执成功 - 命令ID: ${commandId}, 状态: ${actualState}`)
    } else {
      // 执行失败，仅解锁
      await db.execute('UPDATE actuators SET locked = 0 WHERE id = ?', [id])
      console.log(`[Commands] 回执失败 - 命令ID: ${commandId}`)
    }

    return NextResponse.json({
      success: true,
      message: 'OK',
      command_id: commandId,
      actuator_id: id,
      status,
    })
  } catch (error) {
    console.error('[Commands] 回执处理失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '回执处理失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
