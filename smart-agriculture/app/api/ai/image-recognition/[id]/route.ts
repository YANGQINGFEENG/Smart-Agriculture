import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { db, RowDataPacket } from '@/lib/db'
import { AI_UPLOAD_DIR } from '@/lib/ai-config'
import { createLogger } from '@/lib/logger';

const log = createLogger('ImageRecognitionId');

/**
 * 删除图片识别历史记录
 * DELETE /api/ai/image-recognition/[id]
 */
interface RecognitionRow extends RowDataPacket {
  id: number
  image_url: string
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const rows = await db.query<RecognitionRow[]>(
      'SELECT id, image_url FROM image_recognition_history WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 })
    }

    // 删除数据库记录
    await db.execute('DELETE FROM image_recognition_history WHERE id = ?', [id])

    // 删除对应的图片文件
    const imageUrl = rows[0].image_url
    if (imageUrl) {
      const fileName = path.basename(imageUrl)
      const imagePath = path.join(process.cwd(), AI_UPLOAD_DIR, fileName)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
        log.info(`已删除图片: ${fileName}`)
      }
    }

    return NextResponse.json({ success: true, message: '历史记录和图片删除成功' })
  } catch (error) {
    log.error('删除历史记录错误:', error)
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    )
  }
}
