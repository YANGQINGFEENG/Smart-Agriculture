import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { createLogger } from '@/lib/logger';

const log = createLogger('YoloModelSwitch');

/**
 * 识别模型切换接口（网页端 -> 云端 -> 树莓派）
 *
 * POST /api/device/yolo-models/switch
 *      { gateway_ip, model_id? , filename?, file_url? }
 *      1) 把目标模型标记为该网关的期望模型（is_active）
 *      2) 写入切换请求记录（yolo_model_switch_logs，状态 pending）
 *      3) 经独立 WebSocket 服务（localhost:8081/send-gateway-message）下发
 *         { type: 'model_switch', data: { request_id, model_id, filename, file_url } }
 *      4) 树莓派热切换后回 model_status（WS）或 POST /yolo-models/status（HTTP）完成闭环
 *
 * GET  /api/device/yolo-models/switch?gateway_ip=&limit=20
 *      查询该网关最近的切换请求与回执（超过 90 秒未回执自动标记 timeout）
 */

const WS_RELAY_URL = process.env.WS_RELAY_URL || 'http://localhost:8081'
const OFFICIAL_MODEL_NAMES = ['yolov8n.pt', 'yolov8s.pt', 'yolo11n.pt', 'yolo11s.pt']
const SWITCH_TIMEOUT_SECONDS = 90

async function resolveGatewayId(gatewayIp: string): Promise<number | null> {
  if (!gatewayIp) return null
  const rows = await db.query<RowDataPacket[]>(
    'SELECT id FROM gateways WHERE ip_address = ? LIMIT 1',
    [gatewayIp]
  )
  return rows.length > 0 ? (rows[0].id as number) : null
}

/** 把站内相对地址补全为树莓派可访问的绝对地址 */
function absoluteUrl(request: NextRequest, fileUrl: string | null): string | null {
  if (!fileUrl) return null
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  const base = process.env.CLOUD_PUBLIC_URL || request.nextUrl.origin
  return `${base.replace(/\/$/, '')}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`
}

/** 北京时间字符串（可带偏移秒数，避免依赖 MySQL 服务器时区） */
function beijingTimeForDB(offsetSeconds = 0): string {
  const now = new Date()
  const beijing = new Date(
    now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60 * 1000 + offsetSeconds * 1000
  )
  const p = (n: number) => String(n).padStart(2, '0')
  return `${beijing.getFullYear()}-${p(beijing.getMonth() + 1)}-${p(beijing.getDate())} ` +
    `${p(beijing.getHours())}:${p(beijing.getMinutes())}:${p(beijing.getSeconds())}`
}

/** 通过独立 WebSocket 服务把消息推给指定网关 */
async function pushGatewayMessage(gatewayIp: string, message: any) {
  try {
    const resp = await fetch(`${WS_RELAY_URL}/send-gateway-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateway_ip: gatewayIp, message }),
    })
    const result = await resp.json()
    return { ok: Boolean(result.success && result.sent), detail: result }
  } catch (error) {
    log.error('网关消息下发失败:', error)
    return { ok: false, detail: { error: error instanceof Error ? error.message : '未知错误' } }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const gatewayIp = (body.gateway_ip || '').trim()
    const modelId = body.model_id ? parseInt(body.model_id, 10) : null
    const reqFilename = (body.filename || '').trim()

    if (!gatewayIp) {
      return NextResponse.json({ success: false, error: '缺少 gateway_ip' }, { status: 400 })
    }
    if (!modelId && !reqFilename) {
      return NextResponse.json(
        { success: false, error: '缺少 model_id 或 filename' },
        { status: 400 }
      )
    }

    // ---------- 定位目标模型（未登记时按官方/自训练规则自动登记） ----------
    let rows: RowDataPacket[]
    if (modelId) {
      rows = await db.query<RowDataPacket[]>(
        'SELECT * FROM yolo_models WHERE id = ? LIMIT 1',
        [modelId]
      )
    } else {
      rows = await db.query<RowDataPacket[]>(
        'SELECT * FROM yolo_models WHERE gateway_ip = ? AND filename = ? LIMIT 1',
        [gatewayIp, reqFilename]
      )
    }

    let model = rows.length > 0 ? rows[0] : null

    if (!model && reqFilename) {
      const source = OFFICIAL_MODEL_NAMES.includes(reqFilename) ? 'official' : 'trained'
      const gatewayId = await resolveGatewayId(gatewayIp)
      await db.execute<ResultSetHeader>(
        `INSERT INTO yolo_models (gateway_id, gateway_ip, name, filename, description, source, file_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE gateway_id = VALUES(gateway_id)`,
        [
          gatewayId,
          gatewayIp,
          body.name || reqFilename,
          reqFilename,
          body.description || '',
          body.source || source,
          body.file_url || null,
        ]
      )
      const inserted = await db.query<RowDataPacket[]>(
        'SELECT * FROM yolo_models WHERE gateway_ip = ? AND filename = ? LIMIT 1',
        [gatewayIp, reqFilename]
      )
      model = inserted.length > 0 ? inserted[0] : null
    }

    if (!model) {
      return NextResponse.json(
        { success: false, error: '未找到目标模型登记记录' },
        { status: 404 }
      )
    }

    const filename = model.filename as string
    const targetId = model.id as number
    const fileUrl = absoluteUrl(request, body.file_url || model.file_url)

    // ---------- 记录切换前模型 ----------
    const statusRows = await db.query<RowDataPacket[]>(
      'SELECT current_model FROM yolo_model_status WHERE gateway_ip = ? LIMIT 1',
      [gatewayIp]
    )
    const fromModel = statusRows.length > 0 ? statusRows[0].current_model : null

    // ---------- 更新期望模型 + 写入切换请求 ----------
    const now = beijingTimeForDB()
    await db.execute<ResultSetHeader>(
      'UPDATE yolo_models SET is_active = 0 WHERE gateway_ip = ?',
      [gatewayIp]
    )
    await db.execute<ResultSetHeader>(
      `UPDATE yolo_models
       SET is_active = 1, status = 'switching', last_message = '切换指令下发中'
       WHERE id = ?`,
      [targetId]
    )

    const logResult = await db.execute<ResultSetHeader>(
      `INSERT INTO yolo_model_switch_logs (gateway_ip, model_id, filename, from_model, status, pushed_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [gatewayIp, targetId, filename, fromModel, now]
    )
    const requestId = logResult.insertId

    // ---------- 下发指令到树莓派 ----------
    const pushed = await pushGatewayMessage(gatewayIp, {
      type: 'model_switch',
      data: {
        request_id: requestId,
        model_id: targetId,
        filename,
        file_url: fileUrl,
        name: model.name,
      },
    })

    if (pushed.ok) {
      await db.execute<ResultSetHeader>(
        `UPDATE yolo_model_switch_logs SET status = 'pushed' WHERE id = ?`,
        [requestId]
      )
    } else {
      const message = '网关未连接 WebSocket，指令未送达（设备重连后将自动补切换）'
      await db.execute<ResultSetHeader>(
        `UPDATE yolo_model_switch_logs SET status = 'failed', message = ? WHERE id = ?`,
        [message, requestId]
      )
      await db.execute<ResultSetHeader>(
        `UPDATE yolo_models SET status = 'failed', last_message = ? WHERE id = ?`,
        [message, targetId]
      )
    }

    log.info(
      `切换请求 #${requestId}: ${gatewayIp} -> ${filename} (sent=${pushed.ok})`
    )

    return NextResponse.json({
      success: true,
      sent: pushed.ok,
      request_id: requestId,
      gateway_ip: gatewayIp,
      model_id: targetId,
      filename,
      from_model: fromModel,
      file_url: fileUrl,
      message: pushed.ok ? '切换指令已下发，等待硬件端回执' : '指令未送达：网关离线',
      detail: pushed.detail,
      timestamp: now,
    })
  } catch (error) {
    log.error('切换失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '模型切换失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gatewayIp = searchParams.get('gateway_ip') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100)

    // 超时未回执的请求标记为 timeout（指令下发后设备无响应）
    const cutoff = beijingTimeForDB(-SWITCH_TIMEOUT_SECONDS)
    await db.execute<ResultSetHeader>(
      `UPDATE yolo_model_switch_logs
       SET status = 'timeout', message = '硬件端超时未回执'
       WHERE status IN ('pending', 'pushed')
         AND pushed_at IS NOT NULL
         AND pushed_at < ?`,
      [cutoff]
    )

    const logs = await db.query<RowDataPacket[]>(
      `SELECT id, gateway_ip, model_id, filename, from_model, status, message,
              pushed_at, acked_at, created_at
       FROM yolo_model_switch_logs
       WHERE (? = '' OR gateway_ip = ?)
       ORDER BY id DESC
       LIMIT ${limit}`,
      [gatewayIp, gatewayIp]
    )

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    log.error('查询切换记录失败:', error)
    return NextResponse.json({ success: false, error: '查询切换记录失败' }, { status: 500 })
  }
}
