"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Layers,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play,
  Server,
  HardDrive,
  Cpu,
  Zap
} from "lucide-react"

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
  serviceRunning: boolean
  loadedModels: string[]
}

/**
 * 模型管理组件
 * 用于管理Ollama模型的加载和状态
 */
export function ModelManagement() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<ModelStatus>({
    serviceRunning: false,
    loadedModels: []
  })
  const [loadingModel, setLoadingModel] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  /**
   * 检查Ollama服务状态
   */
  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/api/ai/models')
      const result = await response.json()
      if (result.success) {
        setStatus({
          serviceRunning: true,
          loadedModels: result.data.loadedModels || []
        })
        setModels(result.data.models || [])
      } else {
        setStatus(prev => ({ ...prev, serviceRunning: false }))
      }
    } catch (error) {
      setStatus(prev => ({ ...prev, serviceRunning: false }))
    }
  }

  /**
   * 刷新模型列表
   */
  const refreshModels = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/ai/models')
      const result = await response.json()
      if (result.success) {
        setModels(result.data.models || [])
        setStatus({
          serviceRunning: true,
          loadedModels: result.data.loadedModels || []
        })
      } else {
        setStatus(prev => ({ ...prev, serviceRunning: false }))
      }
    } catch (error) {
      setStatus(prev => ({ ...prev, serviceRunning: false }))
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 加载模型
   */
  const loadModel = async (modelName: string) => {
    setLoadingModel(modelName)
    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: modelName })
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: result.message || `${modelName} 加载成功` })
        await refreshModels()
      } else {
        setMessage({ type: 'error', text: result.error || '加载失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '加载失败，请检查Ollama服务是否启动' })
    } finally {
      setLoadingModel(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  /**
   * 启动Ollama服务
   */
  const startOllamaService = async () => {
    try {
      const response = await fetch('/api/ai/models')
      const result = await response.json()
      if (result.success) {
        setStatus(prev => ({ ...prev, serviceRunning: true }))
        setModels(result.data.models || [])
        setMessage({ type: 'success', text: 'Ollama服务已启动' })
      } else {
        setMessage({ type: 'error', text: '无法启动Ollama服务，请手动启动' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ollama服务未安装或未启动，请检查' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  useEffect(() => {
    checkServiceStatus()
    const interval = setInterval(checkServiceStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" />
          模型管理
        </CardTitle>
        <CardDescription>
          管理Ollama模型的加载和状态
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`p-3 rounded-lg border ${
            message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          } flex items-center gap-2`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className={`w-4 h-4 ${status.serviceRunning ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-sm font-medium ${status.serviceRunning ? 'text-green-600' : 'text-red-600'}`}>
              {status.serviceRunning ? 'Ollama服务运行中' : 'Ollama服务未启动'}
            </span>
            {status.serviceRunning && (
              <Badge className="bg-green-100 text-green-800">
                已连接
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={status.serviceRunning ? refreshModels : startOllamaService}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {status.serviceRunning ? '刷新' : '启动服务'}
          </Button>
        </div>

        {!status.serviceRunning ? (
          <div className="p-6 border border-dashed rounded-lg bg-muted/30 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Ollama服务未启动，无法管理模型
            </p>
            <Button onClick={startOllamaService}>
              <Play className="w-4 h-4 mr-2" />
              尝试启动Ollama服务
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              提示：请确保Ollama已安装并启动。可以通过命令行执行 `ollama serve` 启动服务
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {models.length === 0 ? (
              <div className="p-6 border border-dashed rounded-lg bg-muted/30 text-center">
                <HardDrive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  暂无可用模型
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  使用 `ollama pull 模型名` 命令下载模型
                </p>
              </div>
            ) : (
              models.map((model) => (
                <div
                  key={model.name || model.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.details.family} | {model.details.parameter_size} | {model.details.quantization_level}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${
                      status.loadedModels.includes(model.name)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {status.loadedModels.includes(model.name) ? (
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          已加载
                        </span>
                      ) : (
                        '未加载'
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {model.size}
                      </span>
                      <span>修改时间: {new Date(model.modified_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadModel(model.name)}
                      disabled={loadingModel === model.name || status.loadedModels.includes(model.name)}
                    >
                      {loadingModel === model.name ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      {loadingModel === model.name ? '加载中...' : status.loadedModels.includes(model.name) ? '已加载' : '加载模型'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="p-4 bg-muted/30 rounded-lg">
          <h4 className="text-xs font-medium mb-2">使用说明</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 点击"加载模型"将模型加载到内存中，加速推理响应</li>
            <li>• 模型首次加载可能需要一些时间，请耐心等待</li>
            <li>• 已加载的模型会显示"已加载"状态</li>
            <li>• 推荐使用 qwen3:1.7b-q4_K_M 模型进行AI命令解析</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}