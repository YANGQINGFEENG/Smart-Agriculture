import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { AI_UPLOAD_DIR } from '@/lib/ai-config'
import { createLogger } from '@/lib/logger';

const log = createLogger('ImageRecognitionImages');

/**
 * 提供 AI 识别图片访问
 * GET /api/ai/image-recognition/images/[filename]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params

    const imagePath = path.join(process.cwd(), AI_UPLOAD_DIR, filename)

    if (!fs.existsSync(imagePath)) {
      return NextResponse.json(
        { success: false, error: '图片不存在' },
        { status: 404 }
      )
    }

    const imageBuffer = fs.readFileSync(imagePath)
    const ext = path.extname(filename).toLowerCase()
    const contentType =
      ext === '.png' ? 'image/png' :
      ext === '.gif' ? 'image/gif' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    log.error('图片访问错误:', error)
    return NextResponse.json(
      { success: false, error: '内部服务器错误' },
      { status: 500 }
    )
  }
}
