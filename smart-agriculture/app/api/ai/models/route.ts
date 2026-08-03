import { NextRequest, NextResponse } from 'next/server'
import { OLLAMA_HOST } from '@/lib/ai-config'

/**
 * 模型管理 API
 * GET  /api/ai/models — 列出本地模型和加载状态
 * POST /api/ai/models — 操作模型（load/unload/pull/delete）
 *
 * Ollama API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details: {
    parent_model: string
    format: string
    family: string
    families: string[] | null
    parameter_size: string
    quantization_level: string
  }
}

interface LoadedModel {
  name: string
  model: string
  size: number
  digest: string
  expires_at: string
  size_vram: number
}

/**
 * 检查 Ollama 服务是否在线
 */
async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * GET /api/ai/models
 * 获取本地模型列表和运行中模型状态
 */
export async function GET(request: NextRequest) {
  try {
    const ollamaOnline = await checkOllamaHealth()

    if (!ollamaOnline) {
      return NextResponse.json({
        success: false,
        service: { running: false, message: 'Ollama 服务未启动' },
        models: [],
        loadedModels: [],
      }, { status: 200 })
    }

    // 获取本地模型列表
    const tagsRes = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const tagsData = await tagsRes.json()
    const models: OllamaModel[] = tagsData.models || []

    // 获取运行中的模型（从 /api/ps 获取）
    let loadedModels: LoadedModel[] = []
    try {
      const psRes = await fetch(`${OLLAMA_HOST}/api/ps`, { signal: AbortSignal.timeout(3000) })
      if (psRes.ok) {
        const psData = await psRes.json()
        loadedModels = psData.models || []
      }
    } catch { /* ignore */ }

    // 为每个模型检查加载状态
    const modelStatusMap = new Map(loadedModels.map((m) => [m.name, m]))

    const enrichedModels = models.map((m) => {
      const loaded = modelStatusMap.get(m.name)
      return {
        name: m.name,
        model: m.model,
        size: m.size,
        size_formatted: formatSize(m.size),
        modified_at: m.modified_at,
        digest: m.digest,
        family: m.details?.family || 'unknown',
        parameter_size: m.details?.parameter_size || 'unknown',
        quantization_level: m.details?.quantization_level || 'unknown',
        loaded: !!loaded,
        expires_at: loaded?.expires_at || null,
        size_vram: loaded?.size_vram || 0,
        size_vram_formatted: loaded ? formatSize(loaded.size_vram) : '-',
      }
    })

    return NextResponse.json({
      success: true,
      service: { running: true, message: 'Ollama 服务运行中' },
      models: enrichedModels,
      total: enrichedModels.length,
      loadedModels: loadedModels.map((m) => ({
        name: m.name,
        size: m.size,
        size_formatted: formatSize(m.size),
        size_vram: m.size_vram,
        size_vram_formatted: formatSize(m.size_vram),
        expires_at: m.expires_at,
      })),
    })
  } catch (error) {
    console.error('[Models] 获取模型列表失败:', error)
    return NextResponse.json({
      success: false,
      service: { running: false, message: '获取模型列表失败' },
      models: [],
      loadedModels: [],
    }, { status: 500 })
  }
}

/**
 * POST /api/ai/models
 * 操作模型
 *
 * 请求体:
 * - action: 'load' | 'unload' | 'pull' | 'delete'
 * - model_name: 模型名称
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, model_name } = body

    if (!action || !model_name) {
      return NextResponse.json(
        { success: false, error: '缺少 action 或 model_name 参数' },
        { status: 400 }
      )
    }

    let apiPath = ''
    let apiMethod: 'POST' | 'DELETE' = 'POST'
    let requestBody: Record<string, any> = {}

    switch (action) {
      case 'load':
        // 加载模型到内存（使用 Ollama 的 show 接口会自动加载）
        // 或者用 generate 接口触发加载
        apiPath = '/api/show'
        requestBody = { name: model_name }
        break
      case 'unload':
        // 通过发送空的 generate 请求并设置 keep_alive=0 来卸载模型
        apiPath = '/api/generate'
        requestBody = { model: model_name, keep_alive: 0, stream: false }
        break
      case 'pull':
        // 下载模型
        apiPath = '/api/pull'
        requestBody = { name: model_name, stream: false }
        break
      case 'delete':
        // 删除模型
        apiPath = '/api/delete'
        apiMethod = 'DELETE'
        requestBody = { name: model_name }
        break
      default:
        return NextResponse.json(
          { success: false, error: `不支持的 action: ${action}，可选: load/unload/pull/delete` },
          { status: 400 }
        )
    }

    const ollamaUrl = `${OLLAMA_HOST}${apiPath}`
    const response = await fetch(ollamaUrl, {
      method: apiMethod,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: `模型操作失败: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    const actionMessages: Record<string, string> = {
      load: '模型已加载到内存',
      unload: '模型已从内存卸载',
      pull: '模型下载完成',
      delete: '模型已删除',
    }

    return NextResponse.json({
      success: true,
      action,
      model: model_name,
      message: actionMessages[action] || '操作成功',
      data: result,
    })
  } catch (error) {
    console.error('[Models] 模型操作失败:', error)
    return NextResponse.json(
      { success: false, error: '模型操作失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 格式化字节大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
