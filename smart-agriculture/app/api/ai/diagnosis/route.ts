import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_agriculture'
}

interface SensorData extends RowDataPacket {
  sensor_id: string
  sensor_name: string
  type: string
  type_name: string
  value: number
  unit: string
  timestamp: Date
}

interface DetectionResult extends RowDataPacket {
  id: number
  image_url: string
  result: string
  confidence: number
  timestamp: Date
}

/**
 * 获取最新传感器数据
 */
async function getLatestSensorData(): Promise<SensorData[]> {
  try {
    const query = `
      SELECT 
        s.id as sensor_id,
        s.name as sensor_name,
        st.type,
        st.name as type_name,
        sd.value,
        st.unit,
        sd.timestamp
      FROM sensor_data sd
      INNER JOIN sensors s ON sd.sensor_id = s.id
      INNER JOIN sensor_types st ON s.type_id = st.id
      WHERE sd.timestamp = (
        SELECT MAX(timestamp) FROM sensor_data WHERE sensor_id = s.id
      )
      ORDER BY s.id
    `
    const rows = await db.query<SensorData[]>(query)
    return rows
  } catch (error) {
    console.error('获取传感器数据失败:', error)
    return []
  }
}

/**
 * 获取最新图片识别结果
 */
async function getLatestDetectionResults(): Promise<DetectionResult[]> {
  try {
    const connection = await mysql.createConnection(dbConfig)
    const [rows] = await connection.execute(
      'SELECT * FROM image_recognition_history ORDER BY timestamp DESC LIMIT 5'
    )
    await connection.end()
    return rows as DetectionResult[]
  } catch (error) {
    console.error('获取图片识别结果失败:', error)
    return []
  }
}

/**
 * AI实时诊断接口
 */
export async function POST(request: NextRequest) {
  try {
    const sensorData = await getLatestSensorData()
    const detectionResults = await getLatestDetectionResults()

    if (sensorData.length === 0 && detectionResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有可用的数据进行诊断'
      })
    }

    const sensorDataText = sensorData.map(s =>
      `${s.sensor_name}(${s.type_name}): ${s.value}${s.unit} (${new Date(s.timestamp).toLocaleString()})`
    ).join('\n')

    const detectionText = detectionResults.map(d =>
      `识别结果: ${d.result} (置信度: ${(d.confidence * 100).toFixed(1)}%) - ${new Date(d.timestamp).toLocaleString()}`
    ).join('\n')

    const systemPrompt = `你是一个智慧农业物联网平台的AI诊断助手。请根据以下传感器数据和图片识别结果进行综合分析，输出详细的诊断报告和建议。

分析步骤：
1. 逐一检查每个传感器数据，判断是否在正常范围内
2. 对每个传感器给出具体的分析和评价
3. 分析图片识别结果是否发现异常（如病虫害）
4. 综合所有数据进行趋势分析
5. 给出针对性的建议和决策方案

输出格式要求：
{
  "thinking": [
    "正在分析传感器数据...",
    "正在检查温度传感器数据...",
    "正在检查湿度传感器数据...",
    "正在分析图片识别结果...",
    "正在判断是否存在病虫害...",
    "正在查询数据库...",
    "正在匹配决策方案...",
    "正在制定决策方案..."
  ],
  "diagnosis": {
    "summary": "详细的诊断分析报告，包含对每个传感器数据的具体分析和判断",
    "sensorAnalysis": [
      {"sensorName": "传感器名称", "value": "数值", "unit": "单位", "status": "normal/abnormal", "analysis": "详细分析说明"}
    ],
    "issues": ["问题1", "问题2"],
    "suggestions": ["建议1", "建议2"],
    "actions": ["执行动作1", "执行动作2"]
  }
}

注意：
- thinking数组中的内容会以气泡动画形式展示给用户，请使用简洁的步骤描述
- diagnosis.summary必须详细，要分析每个传感器的数据，说明是否正常，给出具体理由
- diagnosis.sensorAnalysis是数组，包含每个传感器的详细分析
- status字段值为"normal"或"abnormal"
- 如果没有异常，也需要输出正常的诊断报告
- 摘要要像这样详细："A区温室1号温度是25.06°C，这个温度在温室正常范围内(20-30°C)，属于正常。B区温室1号是22.25°C，同样在正常范围内。A区温室2号是18.7°C，略低于标准范围，建议关注后续变化。"`

    const userPrompt = `传感器最新数据：
${sensorDataText}

图片识别最新结果：
${detectionText || '暂无图片识别数据'}

请进行综合诊断分析。`

    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const apiUrl = `${ollamaHost}/api/chat`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3:1.7b-q4_K_M',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error('AI诊断失败: ' + errorText)
    }

    const result = await response.json()
    let aiResponse = result.message?.content || '{"thinking": [], "diagnosis": {"summary": "诊断失败", "issues": [], "suggestions": [], "actions": []}}'

    console.log('===========================================')
    console.log('AI诊断接口 - OLLAMA API 响应内容:')
    console.log(`  model: '${result.model}'`)
    console.log(`  created_at: '${result.created_at}'`)
    console.log('  message: {')
    console.log(`    role: '${result.message?.role}'`)
    console.log(`    content: '${aiResponse.slice(0, 200)}${aiResponse.length > 200 ? '...' : ''}'`)
    if (result.message?.thinking) {
      console.log(`    thinking: '${result.message.thinking.slice(0, 300)}${result.message.thinking.length > 300 ? '...' : ''}'`)
    }
    console.log('  }')
    console.log(`  done: ${result.done}`)
    console.log(`  done_reason: '${result.done_reason}'`)
    console.log(`  total_duration: ${result.total_duration}`)
    console.log(`  load_duration: ${result.load_duration}`)
    console.log(`  prompt_eval_count: ${result.prompt_eval_count}`)
    console.log(`  eval_count: ${result.eval_count}`)
    console.log('===========================================')

    let diagnosisResult
    try {
      diagnosisResult = JSON.parse(aiResponse)
    } catch (parseError) {
      console.error('AI诊断接口 - JSON解析失败:', parseError)
      diagnosisResult = {
        thinking: [
          '正在分析传感器数据...',
          '正在分析图片识别结果...',
          '正在制定决策方案...'
        ],
        diagnosis: {
          summary: aiResponse,
          sensorAnalysis: [],
          issues: [],
          suggestions: [],
          actions: []
        }
      }
    }

    if (!diagnosisResult.diagnosis) {
      diagnosisResult.diagnosis = {
        summary: '',
        sensorAnalysis: [],
        issues: [],
        suggestions: [],
        actions: []
      }
    }

    const d = diagnosisResult.diagnosis
    if (!d.summary || d.summary.trim() === '') {
      let autoSummary = ''
      
      if (d.sensorAnalysis && d.sensorAnalysis.length > 0) {
        autoSummary += '传感器分析：'
        d.sensorAnalysis.forEach((sa: any, idx: number) => {
          if (idx > 0) autoSummary += '；'
          autoSummary += `${sa.sensorName} ${sa.value}${sa.unit}（${sa.status === 'normal' ? '正常' : '异常'}）`
        })
      }

      if (d.issues && d.issues.length > 0) {
        if (autoSummary) autoSummary += '。'
        autoSummary += `发现${d.issues.length}个问题：${d.issues.slice(0, 3).join('、')}${d.issues.length > 3 ? '等' : ''}`
      }

      if (d.suggestions && d.suggestions.length > 0) {
        if (autoSummary) autoSummary += '。'
        autoSummary += `建议措施：${d.suggestions.slice(0, 2).join('、')}${d.suggestions.length > 2 ? '等' : ''}`
      }

      if (!autoSummary) {
        autoSummary = 'AI诊断完成，当前系统运行正常'
      }

      d.summary = autoSummary
    }

    if (!d.sensorAnalysis) d.sensorAnalysis = []
    if (!d.issues) d.issues = []
    if (!d.suggestions) d.suggestions = []
    if (!d.actions) d.actions = []

    const normalCount = d.sensorAnalysis.filter((sa: any) => sa.status === 'normal').length
    const abnormalCount = d.sensorAnalysis.filter((sa: any) => sa.status === 'abnormal').length

    console.log('===========================================')
    console.log('AI诊断结果统计:')
    console.log(`  传感器总数: ${d.sensorAnalysis.length}`)
    console.log(`  正常传感器: ${normalCount}`)
    console.log(`  异常传感器: ${abnormalCount}`)
    console.log(`  发现问题: ${d.issues.length}`)
    console.log(`  建议措施: ${d.suggestions.length}`)
    console.log(`  执行策略: ${d.actions.length}`)
    console.log(`  摘要长度: ${d.summary.length} 字符`)
    console.log('===========================================')

    return NextResponse.json({
      success: true,
      data: {
        sensorData,
        detectionResults,
        diagnosis: diagnosisResult,
        rawResponse: {
          model: result.model,
          created_at: result.created_at,
          thinking: result.message?.thinking || '',
          total_duration: result.total_duration,
          eval_count: result.eval_count
        }
      }
    })
  } catch (error) {
    console.error('AI诊断接口错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'AI诊断失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}