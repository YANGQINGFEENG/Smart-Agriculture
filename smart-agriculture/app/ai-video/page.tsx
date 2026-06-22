"use client"

import { useState, useRef, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Upload,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
} from "lucide-react"

interface DetectionResult {
  class: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
}

export default function AIVideoPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [results, setResults] = useState<DetectionResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResults([])
      setError(null)
    }
  }

  const handleDetect = async () => {
    if (!selectedFile) return

    setDetecting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('http://localhost:5000/detect', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.detections || [])
      } else {
        setError(data.error || '检测失败')
      }
    } catch (err) {
      setError('无法连接到推理服务，请确保服务已启动')
    } finally {
      setDetecting(false)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResults([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 绘制检测框
  useEffect(() => {
    if (!previewUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // 绘制检测框
      results.forEach((r, i) => {
        const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6']
        ctx.strokeStyle = colors[i % colors.length]
        ctx.lineWidth = 3
        ctx.strokeRect(r.box.x, r.box.y, r.box.width, r.box.height)

        // 标签
        ctx.fillStyle = colors[i % colors.length]
        ctx.fillRect(r.box.x, r.box.y - 25, 150, 25)
        ctx.fillStyle = 'white'
        ctx.font = '14px sans-serif'
        ctx.fillText(`${r.class} ${(r.confidence * 100).toFixed(1)}%`, r.box.x + 5, r.box.y - 7)
      })
    }
    img.src = previewUrl
  }, [previewUrl, results])

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="ai-video" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="ai-video" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Camera className="h-6 w-6" />
                AI视频检测
              </h1>
              <p className="text-muted-foreground">上传图片进行病虫害识别</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 上传区域 */}
              <Card>
                <CardHeader>
                  <CardTitle>上传图片</CardTitle>
                  <CardDescription>支持 JPG、PNG 格式</CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {!previewUrl ? (
                    <div
                      className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">点击或拖拽上传图片</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <canvas
                        ref={canvasRef}
                        className="w-full rounded-lg border"
                        style={{ maxHeight: '400px', objectFit: 'contain' }}
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleDetect} disabled={detecting} className="flex-1">
                          {detecting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4 mr-2" />
                          )}
                          开始检测
                        </Button>
                        <Button variant="outline" onClick={handleClear}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          清除
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 检测结果 */}
              <Card>
                <CardHeader>
                  <CardTitle>检测结果</CardTitle>
                  <CardDescription>
                    {results.length > 0 ? `识别到 ${results.length} 个目标` : '等待检测'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span>{error}</span>
                    </div>
                  ) : results.length > 0 ? (
                    <div className="space-y-3">
                      {results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="font-medium">{r.class}</p>
                              <p className="text-xs text-muted-foreground">
                                位置: ({r.box.x}, {r.box.y}) 大小: {r.box.width}x{r.box.height}
                              </p>
                            </div>
                          </div>
                          <Badge variant={r.confidence > 0.7 ? "default" : "secondary"}>
                            {(r.confidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>上传图片后点击"开始检测"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
