import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { db, ResultSetHeader } from '@/lib/db'
import { getBeijingTimeForDB } from '@/lib/beijing-time'
import { createLogger } from '@/lib/logger';

const log = createLogger('UploadImage');

/**
 * 摄像头帧上传接口
 * POST /api/device/upload-image
 *
 * 接收树莓派定期上传的 JPEG 帧，存储到 public/uploads/camera/
 * 用于历史回放、AI 分析、报警截图等场景
 *
 * 请求格式: multipart/form-data
 * 字段:
 * - node_id: 摄像头节点ID（如 CAM-1-001）
 * - gateway_ip: 网关IP地址
 * - farm_id: 农场ID
 * - area: 区域名称（可选）
 * - timestamp: 时间戳 YYYY-MM-DD HH:MM:SS
 * - detection: 检测结果元数据 JSON 字符串（可选）
 * - image: JPEG 图像文件
 *
 * 详见《摄像头模块集成说明.md》第七章
 */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const nodeId = formData.get('node_id') as string | null
    const gatewayIp = formData.get('gateway_ip') as string | null
    const farmId = formData.get('farm_id') as string | null
    const area = (formData.get('area') as string | null) || ''
    const timestamp = formData.get('timestamp') as string | null
    const detectionStr = formData.get('detection') as string | null
    const image = formData.get('image') as File | null

    // 参数校验
    if (!nodeId || !gatewayIp || !timestamp || !image) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要字段: node_id, gateway_ip, timestamp, image',
          received: { node_id: !!nodeId, gateway_ip: !!gatewayIp, timestamp: !!timestamp, image: !!image },
        },
        { status: 400 }
      )
    }

    // 解析 detection 元数据
    let detection: any = null
    if (detectionStr) {
      try {
        detection = JSON.parse(detectionStr)
      } catch {
        detection = { raw: detectionStr }
      }
    }

    // 生成文件名: CAM-1-001_20260803_143000.jpg
    const safeTs = timestamp.replace(/[- :]/g, '')
    const fileName = `${nodeId}_${safeTs}.jpg`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'camera')
    const filePath = path.join(uploadDir, fileName)

    // 确保目录存在
    await mkdir(uploadDir, { recursive: true })

    // 写入文件
    const bytes = await image.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const relativePath = `/uploads/camera/${fileName}`
    log.info(`帧上传成功: ${nodeId}, 文件: ${fileName}, 大小: ${image.size} bytes`)

    // 更新摄像头执行器的 feedback，附带最新帧信息（便于前端展示最新截图）
    try {
      const beijingTs = getBeijingTimeForDB()
      if (nodeId.startsWith('CAM-')) {
        // 更新 feedback 中的 last_frame 字段（保留原有 feedback 数据）
        const result = await db.execute<ResultSetHeader>(
          `UPDATE actuators
           SET feedback = JSON_SET(
                 COALESCE(feedback, JSON_OBJECT()),
                 '$.last_frame_url', ?,
                 '$.last_frame_time', ?
               ),
               last_update = ?
           WHERE id = ?`,
          [relativePath, beijingTs, beijingTs, nodeId]
        )
        if (result.affectedRows > 0) {
          log.info(`已更新 ${nodeId} 的 last_frame_url`)
        }
      }
    } catch (dbErr) {
      // 数据库更新失败不影响文件上传主流程
      log.error('feedback 更新失败（不影响上传）:', dbErr)
    }

    return NextResponse.json({
      success: true,
      message: '图像上传成功',
      file_path: relativePath,
      node_id: nodeId,
      timestamp,
      detection,
    })
  } catch (error) {
    log.error('帧上传失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '图像上传失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/device/upload-image
 * 获取摄像头最近帧列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const nodeId = searchParams.get('node_id')

    const { readdir, stat } = await import('fs/promises')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'camera')

    try {
      const files = await readdir(uploadDir)
      const prefix = nodeId ? `${nodeId}_` : ''
      const matched = prefix
        ? files.filter((f) => f.startsWith(prefix) && f.endsWith('.jpg'))
        : files.filter((f) => f.endsWith('.jpg'))

      // 按修改时间倒序
      const withStats = await Promise.all(
        matched.slice(-50).map(async (f) => {
          const fp = path.join(uploadDir, f)
          const st = await stat(fp)
          return { name: f, path: `/uploads/camera/${f}`, size: st.size, mtime: st.mtimeMs }
        })
      )
      withStats.sort((a, b) => b.mtime - a.mtime)

      return NextResponse.json({ success: true, data: withStats.slice(0, 20) })
    } catch {
      return NextResponse.json({ success: true, data: [] })
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取帧列表失败' },
      { status: 500 }
    )
  }
}
