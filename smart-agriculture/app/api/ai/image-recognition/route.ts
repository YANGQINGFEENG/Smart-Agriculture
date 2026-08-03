import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { db, RowDataPacket, ResultSetHeader } from '@/lib/db'
import { AI_INFERENCE_TIMEOUT, AI_UPLOAD_DIR } from '@/lib/ai-config'

/**
 * AI 图片识别 API
 * POST /api/ai/image-recognition — 上传图片进行 YOLO 推理
 * GET /api/ai/image-recognition — 获取历史识别记录
 *
 * 推理服务: INFERENCE_HOST (默认 http://localhost:5000)
 * 上传目录: AI_UPLOAD_DIR (默认 public/uploads/ai)
 *
 * 支持两种模式：
 * 1. 本地上传推理（默认）：服务器调用推理服务进行检测
 * 2. 硬件端回传：硬件端（树莓派）完成 YOLO 推理后直接回传结果
 */

/** 识别历史记录接口 */
interface RecognitionRow extends RowDataPacket {
  id: number
  image_url: string
  result: string
  confidence: number
  detection_data: string | null
  source: string | null
  node_id: string | null
  timestamp: Date
}

/** 推理服务返回的检测结果 */
interface Detection {
  class: string
  confidence: number
  box?: { x: number; y: number; width: number; height: number }
}

/**
 * 调用推理服务进行目标检测
 */
async function callInferenceService(imageBuffer: Buffer, filename: string): Promise<Detection[]> {
  const { INFERENCE_HOST: host } = await import('@/lib/ai-config')

  const formData = new FormData()
  const blob = new Blob([imageBuffer])
  formData.append('file', blob, filename)

  const response = await fetch(`${host}/detect`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(AI_INFERENCE_TIMEOUT),
  })

  if (!response.ok) {
    throw new Error(`推理服务调用失败: ${response.status}`)
  }

  const result = await response.json()
  return result.detections || []
}

/**
 * 保存识别结果到数据库
 */
async function saveRecognitionResult(
  imageUrl: string,
  result: string,
  confidence: number,
  detectionData: string | null = null,
  source: string | null = null,
  nodeId: string | null = null
): Promise<number> {
  const row = await db.query<{ id: number }[]>(
    `INSERT INTO image_recognition_history (image_url, result, confidence, detection_data, source, node_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [imageUrl, result, confidence, detectionData, source, nodeId]
  )
  return row[0]?.id || 0
}

/**
 * POST /api/ai/image-recognition
 * 上传图片进行 AI 识别
 *
 * 请求体 (multipart/form-data):
 * - image: JPEG/PNG 图片文件
 * - source: 来源标记（如 hardware_raspberry / server_upload）
 * - node_id: 节点 ID（如 CAM-1-001）
 * - skip_inference: 是否跳过服务器端推理（硬件已完成推理时传 true）
 * - detection_data: 硬件端已完成的检测结果 JSON（skip_inference=true 时必填）
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const source = formData.get('source') as string | null
    const nodeId = formData.get('node_id') as string | null
    const skipInference = formData.get('skip_inference') === 'true'
    const detectionDataStr = formData.get('detection_data') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: '缺少图片文件' },
        { status: 400 }
      )
    }

    const uploadDir = path.join(process.cwd(), AI_UPLOAD_DIR)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^\w.\-]/g, '_')
    const imagePath = path.join(uploadDir, `${timestamp}_${safeName}`)
    const imageBuffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(imagePath, imageBuffer)

    const relativePath = `/uploads/ai/${timestamp}_${safeName}`

    // 解析硬件端回传的检测结果
    let detections: Detection[] = []
    let detectionData: string | null = null

    if (skipInference && detectionDataStr) {
      // 硬件端已完成推理，直接使用回传结果
      try {
        const parsed = JSON.parse(detectionDataStr)
        detections = parsed.detections || parsed || []
        detectionData = detectionDataStr
        console.log(`[ImageRecognition] 使用硬件端检测结果: ${detections.length} 个目标`)
      } catch {
        console.warn('[ImageRecognition] 硬件端检测数据解析失败，跳过推理')
      }
    } else {
      // 调用推理服务
      try {
        detections = await callInferenceService(imageBuffer, `${timestamp}_${safeName}`)
        detectionData = JSON.stringify(detections)
        console.log(`[ImageRecognition] 推理完成: ${detections.length} 个目标`)
      } catch (err) {
        console.error('[ImageRecognition] 推理服务调用失败:', err)
        // 推理失败但仍保存图片，标记推理失败
        detectionData = JSON.stringify({ error: 'inference_failed' })
      }
    }

    // 保存最佳识别结果到数据库
    if (detections.length > 0) {
      const best = detections.reduce((best, cur) =>
        cur.confidence > (best?.confidence || 0) ? cur : best
      )
      await saveRecognitionResult(
        relativePath,
        best.class,
        best.confidence,
        detectionData,
        source,
        nodeId
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        detections,
        detection_count: detections.length,
        best_match: detections.length > 0
          ? { class: detections[0].class, confidence: detections[0].confidence }
          : null,
        image_url: relativePath,
        timestamp: new Date().toISOString(),
        source: source || 'server',
      },
    })
  } catch (error) {
    console.error('[ImageRecognition] 图片识别错误:', error)
    return NextResponse.json(
      { success: false, error: '图片识别失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/image-recognition
 * 获取历史识别记录
 *
 * 查询参数:
 * - limit: 返回条数（默认 10）
 * - source: 按来源过滤
 * - node_id: 按节点 ID 过滤
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)
    const source = searchParams.get('source')
    const nodeId = searchParams.get('node_id')

    let query = 'SELECT id, image_url, result, confidence, detection_data, source, node_id, timestamp FROM image_recognition_history'
    const params: any[] = []
    const conditions: string[] = []

    if (source) {
      conditions.push('source = ?')
      params.push(source)
    }
    if (nodeId) {
      conditions.push('node_id = ?')
      params.push(nodeId)
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    const rows = await db.query<RecognitionRow[]>(query, params)

    const history = rows.map((row) => {
      let parsedData: any = null
      if (row.detection_data) {
        try {
          parsedData = typeof row.detection_data === 'string' ? JSON.parse(row.detection_data) : row.detection_data
        } catch { /* ignore */ }
      }
      return {
        id: row.id,
        image_url: row.image_url,
        result: row.result,
        confidence: row.confidence,
        detection_data: parsedData,
        source: row.source,
        node_id: row.node_id,
        timestamp: row.timestamp,
      }
    })

    return NextResponse.json({
      success: true,
      data: { history, total: history.length },
    })
  } catch (error) {
    console.error('[ImageRecognition] 获取历史记录错误:', error)
    return NextResponse.json(
      { success: false, error: '获取历史记录失败' },
      { status: 500 }
    )
  }
}
