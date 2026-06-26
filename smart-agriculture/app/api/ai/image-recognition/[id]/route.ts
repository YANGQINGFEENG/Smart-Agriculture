import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_agriculture'
}

/**
 * 删除图片识别历史记录
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const { id } = resolvedParams
    
    const connection = await mysql.createConnection(dbConfig)
    
    // 先获取要删除的记录，以获取图片路径
    const [rows] = await connection.execute(
      'SELECT image_url FROM image_recognition_history WHERE id = ?',
      [id]
    )
    
    if (Array.isArray(rows) && rows.length > 0) {
      const imageUrl = rows[0].image_url
      
      // 删除数据库记录
      await connection.execute(
        'DELETE FROM image_recognition_history WHERE id = ?',
        [id]
      )
      
      // 删除对应的图片文件
      if (imageUrl) {
        const imagePath = path.join(process.env.UPLOAD_DIR || '/app/uploads', imageUrl)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
          console.log('图片文件已删除:', imagePath)
        }
      }
    }
    
    await connection.end()
    
    return NextResponse.json({
      success: true,
      message: '历史记录和图片删除成功'
    })
  } catch (error) {
    console.error('删除历史记录错误:', error)
    return NextResponse.json(
      { success: false, error: '内部服务器错误' },
      { status: 500 }
    )
  }
}
