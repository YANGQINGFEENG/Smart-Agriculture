import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_agriculture'
}

/**
 * 调用推理服务进行目标检测
 */
async function callInferenceService(imageBuffer: Buffer, filename: string) {
  const inferenceHost = process.env.INFERENCE_HOST || 'http://localhost:5000'

  try {
    const formData = new FormData()
    const blob = new Blob([imageBuffer])
    formData.append('file', blob, filename)

    const response = await fetch(`${inferenceHost}/detect`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      throw new Error(`推理服务调用失败: ${response.status}`)
    }

    const result = await response.json()
    return result.detections || []
  } catch (error) {
    console.error('推理服务调用失败:', error)
    throw new Error('推理服务不可用，请确保 inference 服务已启动')
  }
}

/**
 * 图片识别API端点
 * 通过HTTP调用独立推理服务进行YOLO模型推理
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: '缺少图片文件' },
        { status: 400 }
      )
    }

    const imageBuffer = Buffer.from(await file.arrayBuffer())

    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const imagePath = path.join(uploadDir, `${Date.now()}_${file.name}`)
    fs.writeFileSync(imagePath, imageBuffer)

    console.log('调用推理服务...')
    const detectionResult = await callInferenceService(imageBuffer, file.name)
    console.log('推理完成，结果:', detectionResult)

    if (detectionResult && detectionResult.length > 0) {
      const bestResult = detectionResult.reduce((best: any, current: any) =>
        current.confidence > best.confidence ? current : best
      )

      const relativeImagePath = path.basename(imagePath)

      try {
        await saveToDatabase(bestResult.class, bestResult.confidence, relativeImagePath)
        console.log('识别结果已保存到数据库')
      } catch (dbError) {
        console.error('数据库保存失败:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        detectionResult,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('图片识别API错误:', error)
    return NextResponse.json(
      { success: false, error: '内部服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * 获取历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig)
    const [rows] = await connection.execute(
      'SELECT * FROM image_recognition_history ORDER BY timestamp DESC LIMIT 10'
    )
    await connection.end()

    return NextResponse.json({
      success: true,
      data: {
        history: rows
      }
    })
  } catch (error) {
    console.error('获取历史记录错误:', error)
    return NextResponse.json({
      success: true,
      data: {
        history: []
      }
    })
  }
}

/**
 * 保存识别结果到数据库
 */
async function saveToDatabase(result: string, confidence: number, imageUrl: string) {
  try {
    const connection = await mysql.createConnection(dbConfig)
    await connection.execute(
      'INSERT INTO image_recognition_history (image_url, result, confidence) VALUES (?, ?, ?)',
      [imageUrl, result, confidence]
    )
    await connection.end()
  } catch (error) {
    console.error('保存到数据库错误:', error)
  }
}
