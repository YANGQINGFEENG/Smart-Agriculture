import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 提供图片访问的API端点
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const resolvedParams = await params
    const { filename } = resolvedParams
    
    // 构建图片路径
    const imagePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', filename)
    
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      return NextResponse.json(
        { success: false, error: '图片不存在' },
        { status: 404 }
      )
    }
    
    // 读取图片文件
    const imageBuffer = fs.readFileSync(imagePath)
    
    // 确定图片类型
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'image/jpeg'
    
    if (ext === '.png') {
      contentType = 'image/png'
    } else if (ext === '.gif') {
      contentType = 'image/gif'
    } else if (ext === '.webp') {
      contentType = 'image/webp'
    }
    
    // 返回图片
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('图片访问错误:', error)
    return NextResponse.json(
      { success: false, error: '内部服务器错误' },
      { status: 500 }
    )
  }
}
