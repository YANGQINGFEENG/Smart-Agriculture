import { NextRequest, NextResponse } from 'next/server'

interface ModelInfo {
  name: string
  id: string
  size: string
  modified_at: string
  digest: string
  details: {
    family: string
    parameter_size: string
    quantization_level: string
  }
}

interface ModelStatus {
  name: string
  size: string
  digest: string
  loaded_at: string
}

/**
 * 检查模型是否已加载到内存
 */
async function checkModelLoaded(ollamaHost: string, modelName: string): Promise<boolean> {
  try {
    const response = await fetch(`${ollamaHost}/api/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) {
      return false
    }

    const result = await response.json()
    return result.details !== undefined
  } catch {
    return false
  }
}

/**
 * 获取所有模型列表
 */
export async function GET(request: NextRequest) {
  try {
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const apiUrl = `${ollamaHost}/api/tags`

    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) })
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: '获取模型列表失败: ' + errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    const models: ModelInfo[] = result.models || []

    const loadedModels: string[] = []
    for (const model of models) {
      const isLoaded = await checkModelLoaded(ollamaHost, model.name)
      if (isLoaded) {
        loadedModels.push(model.name)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        models,
        total: models.length,
        loadedModels
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: {
        models: [],
        total: 0,
        loadedModels: []
      },
      message: 'Ollama服务未启动，请先启动Ollama'
    })
  }
}

/**
 * 加载模型到内存
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model_name } = body

    if (!model_name) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: model_name' },
        { status: 400 }
      )
    }

    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const apiUrl = `${ollamaHost}/api/pull`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: model_name,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: '加载模型失败: ' + errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      data: {
        model: model_name,
        result: result.status || '加载成功',
        digest: result.digest
      },
      message: `模型 ${model_name} 加载成功`
    })
  } catch (error) {
    console.error('加载模型失败:', error)
    return NextResponse.json(
      { success: false, error: 'Ollama服务未启动或连接失败' },
      { status: 500 }
    )
  }
}