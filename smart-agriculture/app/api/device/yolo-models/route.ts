import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { createLogger } from '@/lib/logger';

const log = createLogger('YoloModels');

/**
 * YOLO 识别模型清单接口（网页端切换硬件识别模型）
 *
 * GET  /api/device/yolo-models?gateway_ip=10.248.88.186
 *      返回该网关的模型清单 + 运行状态（当前使用模型、类别、推理耗时等）
 *
 * POST /api/device/yolo-models
 *      1) multipart/form-data：上传自定义 .pt 模型（file + gateway_ip + name + description）
 *         文件存 public/uploads/yolo-models/，Pi 切换时按 file_url 下载
 *      2) application/json：登记已存在于 Pi 本地或官方通用模型
 *         { gateway_ip, filename, name, source, description }
 *
 * DELETE /api/device/yolo-models?id=3
 *      删除模型登记（不删除 Pi 本地文件）
 */

// 官方通用模型名单（v8 系列兼容设备端 ultralytics 8.1.x；yolo11 需 >=8.3）
const OFFICIAL_MODEL_NAMES = ['yolov8n.pt', 'yolov8s.pt', 'yolo11n.pt', 'yolo11s.pt']

function resolveGatewayId(gatewayIp: string): Promise<number | null> {
  return (async () => {
    if (!gatewayIp) return null
    const rows = await db.query<RowDataPacket[]>(
      'SELECT id FROM gateways WHERE ip_address = ? LIMIT 1',
      [gatewayIp]
    )
    return rows.length > 0 ? (rows[0].id as number) : null
  })()
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gatewayIp = searchParams.get('gateway_ip') || ''

    const models = await db.query<RowDataPacket[]>(
      `SELECT id, gateway_id, gateway_ip, name, filename, description, source, file_url,
              file_size, size_mb, class_count, classes_json, is_active, status,
              last_message, model_modified_at, created_at, updated_at
       FROM yolo_models
       WHERE (? = '' OR gateway_ip = ?)
       ORDER BY is_active DESC, source ASC, id ASC`,
      [gatewayIp, gatewayIp]
    )

    const statusRows = await db.query<RowDataPacket[]>(
      `SELECT gateway_ip, current_model, loaded, class_count, classes_json, img_size,
              conf_threshold, avg_inference_time_ms, total_inferences, switch_count,
              last_switch_at, last_error, switching, local_models_json, reported_at, updated_at
       FROM yolo_model_status
       WHERE (? = '' OR gateway_ip = ?)
       LIMIT 1`,
      [gatewayIp, gatewayIp]
    )

    const status = statusRows.length > 0 ? statusRows[0] : null

    // Pi 本地实际存在的模型（由 Pi 上报），用于标记清单中的"设备已就绪"
    let localFilenames: string[] = []
    if (status?.local_models_json) {
      try {
        const local = JSON.parse(status.local_models_json as string)
        if (Array.isArray(local)) {
          localFilenames = local.map((m: any) => m.filename).filter(Boolean)
        }
      } catch {
        localFilenames = []
      }
    }

    let statusClasses: string[] = []
    if (status?.classes_json) {
      try {
        const parsed = JSON.parse(status.classes_json as string)
        if (Array.isArray(parsed)) statusClasses = parsed
      } catch {
        statusClasses = []
      }
    }

    const enriched = models.map((m: any) => {
      let classes: string[] = []
      if (m.classes_json) {
        try {
          const parsed = JSON.parse(m.classes_json as string)
          if (Array.isArray(parsed)) classes = parsed
        } catch {
          classes = []
        }
      }
      return {
        ...m,
        is_active: Boolean(m.is_active),
        classes,
        on_device: localFilenames.includes(m.filename as string),
        is_current: Boolean(status && status.current_model === m.filename),
      }
    })

    // 网关列表（供页面选择目标网关）
    const gatewayRows = await db.query<RowDataPacket[]>(
      `SELECT id, name, ip_address, status, farm_id
       FROM gateways
       WHERE ip_address IS NOT NULL AND ip_address <> ''
       ORDER BY id ASC`
    )

    // 默认网关：最近上报过模型状态的网关（避免页面默认选中无关网关）
    const defaultRows = await db.query<RowDataPacket[]>(
      'SELECT gateway_ip FROM yolo_model_status ORDER BY updated_at DESC LIMIT 1'
    )
    const defaultGatewayIp =
      gatewayIp || (defaultRows.length > 0 ? (defaultRows[0].gateway_ip as string) : null)

    return NextResponse.json({
      success: true,
      data: {
        gateway_ip: gatewayIp,
        default_gateway_ip: defaultGatewayIp,
        gateways: gatewayRows,
        models: enriched,
        status: status
          ? {
              ...status,
              loaded: Boolean(status.loaded),
              switching: Boolean(status.switching),
              classes: statusClasses,
              local_models: localFilenames,
            }
          : null,
        official_model_names: OFFICIAL_MODEL_NAMES,
      },
    })
  } catch (error) {
    log.error('获取模型清单失败:', error)
    return NextResponse.json(
      { success: false, error: '获取模型清单失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // ---------- 模式 1：multipart 上传自定义模型文件 ----------
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const gatewayIp = (formData.get('gateway_ip') as string | null) || ''
      const name = (formData.get('name') as string | null) || ''
      const description = (formData.get('description') as string | null) || ''
      const source = (formData.get('source') as string | null) || 'custom'
      const file = formData.get('file') as File | null

      if (!gatewayIp || !file) {
        return NextResponse.json(
          { success: false, error: '缺少必要字段: gateway_ip, file' },
          { status: 400 }
        )
      }
      if (!file.name.toLowerCase().endsWith('.pt')) {
        return NextResponse.json(
          { success: false, error: '仅支持上传 ultralytics .pt 模型文件' },
          { status: 400 }
        )
      }

      const filename = file.name.replace(/[^\w.\-]/g, '_')
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'yolo-models')
      await mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, filename)
      const bytes = await file.arrayBuffer()
      await writeFile(filePath, Buffer.from(bytes))

      const fileUrl = `/uploads/yolo-models/${filename}`
      const gatewayId = await resolveGatewayId(gatewayIp)

      await db.execute<ResultSetHeader>(
        `INSERT INTO yolo_models
          (gateway_id, gateway_ip, name, filename, description, source, file_url, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description), source = VALUES(source),
           file_url = VALUES(file_url), file_size = VALUES(file_size), gateway_id = VALUES(gateway_id)`,
        [
          gatewayId,
          gatewayIp,
          name || filename,
          filename,
          description,
          source,
          fileUrl,
          file.size,
        ]
      )

      log.info(
        `模型上传成功: ${filename} (${(file.size / 1024 / 1024).toFixed(2)}MB) -> ${gatewayIp}`
      )

      return NextResponse.json({
        success: true,
        message: `模型 ${filename} 上传成功`,
        filename,
        file_url: fileUrl,
        size: file.size,
      })
    }

    // ---------- 模式 2：JSON 登记模型 ----------
    const body = await request.json()
    const { gateway_ip, filename, name, description, source, file_url } = body

    if (!gateway_ip || !filename) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段: gateway_ip, filename' },
        { status: 400 }
      )
    }

    const resolvedSource =
      source || (OFFICIAL_MODEL_NAMES.includes(filename) ? 'official' : 'trained')
    const gatewayId = await resolveGatewayId(gateway_ip)

    await db.execute<ResultSetHeader>(
      `INSERT INTO yolo_models
        (gateway_id, gateway_ip, name, filename, description, source, file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), description = VALUES(description),
         source = VALUES(source), gateway_id = VALUES(gateway_id),
         file_url = COALESCE(VALUES(file_url), file_url)`,
      [
        gatewayId,
        gateway_ip,
        name || filename,
        filename,
        description || '',
        resolvedSource,
        file_url || null,
      ]
    )

    log.info(`模型登记成功: ${filename} (${resolvedSource}) -> ${gateway_ip}`)

    return NextResponse.json({
      success: true,
      message: `模型 ${filename} 登记成功`,
      filename,
      source: resolvedSource,
      timestamp: getBeijingTimeForDB(),
    })
  } catch (error) {
    log.error('模型登记/上传失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '模型登记失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = parseInt(request.nextUrl.searchParams.get('id') || '0', 10)
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id 参数' }, { status: 400 })
    }

    const result = await db.execute<ResultSetHeader>(
      'DELETE FROM yolo_models WHERE id = ?',
      [id]
    )

    return NextResponse.json({
      success: result.affectedRows > 0,
      message: result.affectedRows > 0 ? '模型登记已删除' : '未找到该模型登记',
    })
  } catch (error) {
    log.error('删除模型登记失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
