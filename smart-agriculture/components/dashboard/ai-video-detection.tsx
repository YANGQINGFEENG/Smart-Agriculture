"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Camera,
  Upload,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  FileImage,
  X,
} from "lucide-react"

/**
 * AI 视频病虫害检测组件
 * 支持视频上传、实时检测、历史记录查看
 */
export function AIVideoDetection() {
  const [isUploading, setIsUploading] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionResult, setDetectionResult] = useState<string | null>(null)
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null)
  const [detectionResults, setDetectionResults] = useState<Array<{
    class: string
    confidence: number
    box: { x: number; y: number; width: number; height: number }
  }>>([])
  const [history, setHistory] = useState<Array<{
    id: string
    timestamp: string
    imageUrl: string
    result: string
    confidence: number
    results?: Array<{
      class: string
      confidence: number
      box: { x: number; y: number; width: number; height: number }
    }>
  }>>([])
  const [isCameraActive, setIsCameraActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/ai/image-recognition')
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data?.history) {
            // 转换数据库记录为前端格式
            const formattedHistory = result.data.history.map((item: any) => ({
              id: item.id.toString(),
              timestamp: new Date(item.timestamp).toLocaleString("zh-CN"),
              imageUrl: item.image_url,
              result: item.result,
              confidence: item.confidence
            }))
            setHistory(formattedHistory)
          }
        }
      } catch (error) {
        console.error('加载历史记录失败:', error)
      }
    }

    loadHistory()
  }, [])

  /**
   * 处理文件上传
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      // 创建FormData对象
      const formData = new FormData()
      formData.append('image', file)
      
      // 调用图片识别API
      const response = await fetch('/api/ai/image-recognition', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('API调用失败')
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        // 处理检测结果
        const detectionResults = result.data.detectionResult
        if (detectionResults && detectionResults.length > 0) {
          // 保存所有检测结果
          setDetectionResults(detectionResults)
          
          // 取置信度最高的结果
          const bestResult = detectionResults.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
          )
          
          setDetectionResult(bestResult.class)
          setDetectionConfidence(bestResult.confidence)

          // 添加到历史记录
          const newHistoryItem = {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString("zh-CN"),
            imageUrl: URL.createObjectURL(file),
            result: bestResult.class,
            confidence: bestResult.confidence,
            results: detectionResults
          }
          
          setHistory(prev => [newHistoryItem, ...prev])
        }
      }
    } catch (error) {
      console.error('文件上传失败:', error)
    } finally {
      setIsUploading(false)
    }
  }

  /**
   * 处理检测
   */
  const handleDetection = async () => {
    // 检测功能已集成到文件上传中
    // 此方法可用于重新检测或其他检测场景
    console.log('重新检测功能')
  }

  /**
   * 触发文件选择
   */
  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  /**
   * 清除检测结果
   */
  const clearResult = () => {
    setDetectionResult(null)
    setDetectionConfidence(null)
    setDetectionResults([])
  }

  /**
   * 绘制检测结果
   */
  const drawDetectionResults = () => {
    const canvas = document.getElementById('detection-canvas') as HTMLCanvasElement
    const image = document.getElementById('detection-image') as HTMLImageElement
    
    if (!canvas || !image || detectionResults.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布大小与图片一致
    canvas.width = image.clientWidth
    canvas.height = image.clientHeight

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制每个检测结果
    detectionResults.forEach(result => {
      const { class: className, confidence, box } = result
      
      // 计算实际坐标（基于图片尺寸）
      const x = (box.x / 800) * canvas.width
      const y = (box.y / 450) * canvas.height
      const width = (box.width / 800) * canvas.width
      const height = (box.height / 450) * canvas.height

      // 绘制边界框
      ctx.strokeStyle = className === '健康叶片' ? '#10b981' : '#ef4444'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // 绘制标签背景
      ctx.fillStyle = className === '健康叶片' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
      ctx.fillRect(x, y - 20, width, 20)

      // 绘制标签文字
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${className} (${Math.round(confidence * 100)}%)`, x + width / 2, y - 5)
    })
  }

  // 当检测结果更新时，绘制结果
  useEffect(() => {
    drawDetectionResults()
  }, [detectionResults])

  // 监听摄像头状态变化，确保视频正确播放
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      console.log('摄像头已激活，尝试播放视频')
      
      const video = videoRef.current
      
      // 确保视频正在播放
      if (video.paused) {
        video.play().then(() => {
          console.log('视频开始播放')
        }).catch(err => {
          console.error('视频播放失败:', err)
        })
      }
      
      // 添加视频事件监听
      video.onplay = () => {
        console.log('视频正在播放')
      }
      
      video.onerror = (error) => {
        console.error('视频加载错误:', error)
      }
    }
  }, [isCameraActive])

  // 组件卸载时清理摄像头资源
  useEffect(() => {
    return () => {
      console.log('组件卸载，清理摄像头资源')
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setIsCameraActive(false)
      }
    }
  }, [])

  /**
   * 启动摄像头
   */
  const startCamera = async () => {
    try {
      console.log('正在请求摄像头权限...')
      
      // 先设置isCameraActive为true，让UI渲染video元素
      setIsCameraActive(true)
      console.log('isCameraActive已设置为true，等待UI渲染')
      
      // 短暂等待确保UI已渲染
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 尝试获取摄像头流
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      console.log('摄像头权限已获得，stream:', stream)
      
      if (videoRef.current) {
        console.log('videoRef.current存在，设置srcObject')
        videoRef.current.srcObject = stream
        
        // 等待视频元数据加载完成
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log('视频元数据加载完成')
              videoRef.current?.play()
              resolve()
            }
          }
        })
        
        streamRef.current = stream
        console.log('摄像头已启动，stream已绑定')
      }
    } catch (error: any) {
      console.error('无法访问摄像头:', error)
      console.error('错误类型:', error.name)
      console.error('错误消息:', error.message)
      
      // 出错时重置状态
      setIsCameraActive(false)
      
      if (error.name === 'NotReadableError') {
        alert('摄像头已被其他应用占用，请关闭其他使用摄像头的应用后重试')
      } else if (error.name === 'NotAllowedError') {
        alert('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头')
      } else if (error.name === 'NotFoundError') {
        alert('未找到摄像头设备')
      }
    }
  }

  /**
   * 停止摄像头
   */
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setIsCameraActive(false)
    }
  }

  /**
   * 删除历史记录
   */
  const handleDeleteHistory = async (id: string) => {
    try {
      // 调用API删除数据库记录
      const response = await fetch(`/api/ai/image-recognition/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // 从前端状态中移除记录
        setHistory(prev => prev.filter(item => item.id !== id))
      }
    } catch (error) {
      console.error('删除历史记录失败:', error)
    }
  }

  /**
   * 实时检测
   */
  const handleRealTimeDetection = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setIsDetecting(true)

    try {
      // 绘制视频帧到画布
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

      // 将画布转换为Blob
      canvas.toBlob(async (blob) => {
        if (!blob) return

        // 创建FormData对象
        const formData = new FormData()
        formData.append('image', blob, 'capture.jpg')

        // 调用图片识别API
        const response = await fetch('/api/ai/image-recognition', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('API调用失败')
        }

        const result = await response.json()

        if (result.success && result.data) {
          // 处理检测结果
          const detectionResults = result.data.detectionResult
          if (detectionResults && detectionResults.length > 0) {
            // 保存所有检测结果
            setDetectionResults(detectionResults)
            
            // 取置信度最高的结果
            const bestResult = detectionResults.reduce((best, current) => 
              current.confidence > best.confidence ? current : best
            )

            setDetectionResult(bestResult.class)
            setDetectionConfidence(bestResult.confidence)

            // 添加到历史记录
            const newHistoryItem = {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleString("zh-CN"),
              imageUrl: canvas.toDataURL('image/jpeg'),
              result: bestResult.class,
              confidence: bestResult.confidence,
              results: detectionResults
            }

            setHistory(prev => [newHistoryItem, ...prev])
          }
        }
      }, 'image/jpeg')
    } catch (error) {
      console.error('实时检测失败:', error)
    } finally {
      setIsDetecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">检测区域</CardTitle>
            <CardDescription>
              上传图片或视频进行病虫害检测
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative border-2 border-dashed border-border rounded-lg p-4">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative mb-4">
                {!isCameraActive && !detectionResult ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      点击上传图片或使用摄像头
                    </p>
                    <div className="flex flex-col gap-2 w-48">
                      <Button
                        onClick={triggerFileInput}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            选择文件
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={startCamera}
                        variant="outline"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        打开摄像头
                      </Button>
                    </div>
                  </>
                ) : isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <canvas
                      ref={canvasRef}
                      className="hidden"
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      <Button
                        onClick={handleRealTimeDetection}
                        disabled={isDetecting}
                      >
                        {isDetecting ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            检测中...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            实时检测
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={stopCamera}
                        variant="outline"
                      >
                        <X className="w-4 h-4 mr-2" />
                        关闭摄像头
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <img 
                      src={fileInputRef.current?.files?.[0] ? URL.createObjectURL(fileInputRef.current.files[0]) : `https://picsum.photos/seed/agriculture/800/450`} 
                      alt="检测图片" 
                      className="max-w-full max-h-full object-contain"
                      id="detection-image"
                    />
                    <canvas 
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      id="detection-canvas"
                    />
                  </>
                )}
              </div>
              
              {detectionResult && (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">检测结果:</span>
                    <Badge className={
                      detectionResult === "健康叶片"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }>
                      {detectionResult}
                    </Badge>
                  </div>
                  {detectionConfidence && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">置信度:</span>
                      <span className="text-sm">{Math.round(detectionConfidence * 100)}%</span>
                    </div>
                  )}
                  <div className="pt-4 flex gap-2">
                    <Button
                      onClick={clearResult}
                      variant="outline"
                      size="sm"
                    >
                      重新检测
                    </Button>
                    <Button
                      onClick={handleDetection}
                      disabled={isDetecting}
                      size="sm"
                    >
                      {isDetecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          检测中...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          再次检测
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">检测说明</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>支持 JPG、PNG 等常见图片格式</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>支持 MP4 等视频格式，最长 30 秒</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>建议上传清晰的作物叶片图片</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>检测结果仅供参考，建议结合实际情况判断</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">历史记录</CardTitle>
            <CardDescription>
              查看最近的检测记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileImage className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">暂无检测记录</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="space-y-2 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center">
                      <img 
                        src={item.imageUrl.startsWith('data:') || item.imageUrl.startsWith('blob:') ? item.imageUrl : (item.imageUrl ? `/api/ai/image-recognition/images/${item.imageUrl.split(/[\/]/).pop()}` : `https://picsum.photos/seed/${item.id}/800/450`)} 
                        alt="检测图片" 
                        className="w-full h-full object-cover rounded-md"
                      />
                      <button 
                        onClick={() => handleDeleteHistory(item.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        title="删除记录"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className={
                        item.result === "健康叶片"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }>
                        {item.result}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{item.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}