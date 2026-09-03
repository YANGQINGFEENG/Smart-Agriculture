import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'

/**
 * 树莓派识别模型状态上报接口
 *
 * POST /api/device/yolo-models/status
 *      硬件端（services/model_manager.py）在启动、切换模型后上报：
 *      {
 *        gateway_ip, current_model, loaded, class_count, class_names,
 *        img_size, conf_threshold, avg_inference_time_ms, total_inferences,
 *        switch_count, last_switch_at, last_error, switching,
 *        request_id, switch_result: { request_id, success, message },
 *        local_models: [{ filename, size_mb, modified_at, is_active, source }],
 *        reported_at
 *      }
 *
 *      处理：
 *      1) upsert yolo_model_status（每网关一行）
 *      2) 按 local_models 自动登记/更新 yolo_models 清单（设备已有模型免手工登记）
 *      3) 刷新 yolo_models.status（当前加载模型标为 active）
 *      4) 若带 switch_result，则回填切换请求记录（success/failed）并对齐期望模型
 *
 * GET /api/device/yolo-models/status?gateway_ip=
 *      查询网关当前模型运行状态
 */

const OFFICIAL_MODEL_NAMES = ['yolov8n.pt', 'yolov8s.pt', 'yolo11n.pt', 'yolo11s.pt']

async function resolveGatewayId(gatewayIp: string): Promise<number | null> {
  if (!gatewayIp) return null
  const rows = await db.query<RowDataPacket[]>(
    'SELECT id FROM gateways WHERE ip_address = ? LIMIT 1',
    [gatewayIp]
  )
  return rows.length > 0 ? (rows[0].id as number) : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const gatewayIp = (body.gateway_ip || '').trim()
    if (!gatewayIp) {
      return NextResponse.json({ success: false, error: '缺少 gateway_ip' }, { status: 400 })
    }

    const currentModel = body.current_model || null
    const localModels: any[] = Array.isArray(body.local_models) ? body.local_models : []
    const switchResult = body.switch_result || null
    const gatewayId = await resolveGatewayId(gatewayIp)
    const reportedAt = body.reported_at || getBeijingTimeForDB()

    // ---------- 1. upsert 网关模型运行状态 ----------
    await db.execute<ResultSetHeader>(
      `INSERT INTO yolo_model_status
        (gateway_id, gateway_ip, current_model, loaded, class_count, classes_json, img_size,
         conf_threshold, avg_inference_time_ms, total_inferences, switch_count, last_switch_at,
         last_error, switching, local_models_json, reported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         gateway_id = COALESCE(VALUES(gateway_id), gateway_id),
         current_model = VALUES(current_model),
         loaded = VALUES(loaded),
         class_count = VALUES(class_count),
         classes_json = VALUES(classes_json),
         img_size = VALUES(img_size),
         conf_threshold = VALUES(conf_threshold),
         avg_inference_time_ms = VALUES(avg_inference_time_ms),
         total_inferences = VALUES(total_inferences),
         switch_count = VALUES(switch_count),
         last_switch_at = VALUES(last_switch_at),
         last_error = VALUES(last_error),
         switching = VALUES(switching),
         local_models_json = VALUES(local_models_json),
         reported_at = VALUES(reported_at)`,
      [
        gatewayId,
        gatewayIp,
        currentModel,
        body.loaded ? 1 : 0,
        body.class_count || 0,
        JSON.stringify(body.class_names || []),
        body.img_size ?? null,
        body.conf_threshold ?? null,
        body.avg_inference_time_ms ?? null,
        body.total_inferences || 0,
        body.switch_count || 0,
        body.last_switch_at || null,
        body.last_error || null,
        body.switching ? 1 : 0,
        JSON.stringify(localModels),
        reportedAt,
      ]
    )

    // ---------- 2. 按设备本地清单自动登记模型 ----------
    let synced = 0
    for (const item of localModels) {
      const filename = item?.filename
      if (!filename) continue
      const source = OFFICIAL_MODEL_NAMES.includes(filename)
        ? 'official'
        : item.source === 'official'
          ? 'official'
          : 'trained'
      await db.execute<ResultSetHeader>(
        `INSERT INTO yolo_models
          (gateway_id, gateway_ip, name, filename, description, source, size_mb, model_modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           gateway_id = COALESCE(VALUES(gateway_id), gateway_id),
           size_mb = VALUES(size_mb),
           model_modified_at = VALUES(model_modified_at)`,
        [
          gatewayId,
          gatewayIp,
          filename,
          filename,
          source === 'official' ? 'YOLO 官方通用模型（COCO 80 类）' : '设备本地模型',
          source,
          item.size_mb ?? 0,
          item.modified_at || null,
        ]
      )
      synced++
    }

    // ---------- 3. 刷新模型清单状态（当前加载的标为 active） ----------
    await db.execute<ResultSetHeader>(
      `UPDATE yolo_models
       SET status = 'idle', last_message = ''
       WHERE gateway_ip = ? AND filename <> ? AND status IN ('active', 'switching', 'failed')`,
      [gatewayIp, currentModel || '']
    )
    if (currentModel) {
      await db.execute<ResultSetHeader>(
        `UPDATE yolo_models
         SET status = 'active', class_count = ?, classes_json = ?,
             last_message = ?, size_mb = COALESCE(NULLIF(size_mb, 0), ?)
         WHERE gateway_ip = ? AND filename = ?`,
        [
          body.class_count || 0,
          JSON.stringify(body.class_names || []),
          body.last_error || `硬件端已加载，累计推理 ${body.total_inferences || 0} 次`,
          localModels.find((m) => m.filename === currentModel)?.size_mb ?? 0,
          gatewayIp,
          currentModel,
        ]
      )
    }

    // ---------- 4. 回填切换请求回执 ----------
    const requestId = switchResult?.request_id ?? body.request_id ?? null
    if (requestId) {
      const ok = Boolean(switchResult?.success)
      const message = (switchResult?.message || (ok ? '切换成功' : '切换失败')).slice(0, 500)
      const ackedAt = getBeijingTimeForDB()

      const logRows = await db.query<RowDataPacket[]>(
        'SELECT id, filename, status FROM yolo_model_switch_logs WHERE id = ? LIMIT 1',
        [requestId]
      )
      if (logRows.length > 0 && logRows[0].status !== 'success') {
        await db.execute<ResultSetHeader>(
          `UPDATE yolo_model_switch_logs
           SET status = ?, message = ?, acked_at = ?
           WHERE id = ?`,
          [ok ? 'success' : 'failed', message, ackedAt, requestId]
        )
        await db.execute<ResultSetHeader>(
          `UPDATE yolo_models SET last_message = ? WHERE gateway_ip = ? AND filename = ?`,
          [message, gatewayIp, logRows[0].filename]
        )

        if (ok && currentModel) {
          // 切换成功：期望模型与实际加载模型对齐
          await db.execute<ResultSetHeader>(
            'UPDATE yolo_models SET is_active = 0 WHERE gateway_ip = ?',
            [gatewayIp]
          )
          await db.execute<ResultSetHeader>(
            'UPDATE yolo_models SET is_active = 1 WHERE gateway_ip = ? AND filename = ?',
            [gatewayIp, currentModel]
          )
        } else if (!ok) {
          await db.execute<ResultSetHeader>(
            `UPDATE yolo_models SET status = 'failed' WHERE gateway_ip = ? AND filename = ?`,
            [gatewayIp, logRows[0].filename]
          )
        }
      }
    }

    console.log(
      `[YoloModelStatus] ${gatewayIp} 上报: 当前模型 ${currentModel || '无'}, ` +
        `类别 ${body.class_count || 0}, 本地模型 ${synced} 个` +
        (requestId ? `, 切换回执 #${requestId}=${switchResult?.success ? '成功' : '失败'}` : '')
    )

    return NextResponse.json({
      success: true,
      message: '模型状态已记录',
      gateway_ip: gatewayIp,
      current_model: currentModel,
      synced_models: synced,
      request_id: requestId,
    })
  } catch (error) {
    console.error('[YoloModelStatus] 状态上报处理失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '模型状态上报失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const gatewayIp = request.nextUrl.searchParams.get('gateway_ip') || ''
    const rows = await db.query<RowDataPacket[]>(
      `SELECT gateway_ip, current_model, loaded, class_count, classes_json, img_size,
              conf_threshold, avg_inference_time_ms, total_inferences, switch_count,
              last_switch_at, last_error, switching, local_models_json, reported_at, updated_at
       FROM yolo_model_status
       WHERE (? = '' OR gateway_ip = ?)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [gatewayIp, gatewayIp]
    )

    const row = rows.length > 0 ? rows[0] : null
    let localModels: any[] = []
    let classes: string[] = []
    if (row?.local_models_json) {
      try {
        localModels = JSON.parse(row.local_models_json as string) || []
      } catch {
        localModels = []
      }
    }
    if (row?.classes_json) {
      try {
        classes = JSON.parse(row.classes_json as string) || []
      } catch {
        classes = []
      }
    }

    return NextResponse.json({
      success: true,
      data: row ? { ...row, local_models: localModels, classes } : null,
    })
  } catch (error) {
    console.error('[YoloModelStatus] 查询状态失败:', error)
    return NextResponse.json({ success: false, error: '查询状态失败' }, { status: 500 })
  }
}
