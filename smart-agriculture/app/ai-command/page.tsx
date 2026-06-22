"use client"

import { useState, useRef, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
} from "lucide-react"

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AICommandPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response || data.error || '抱歉，无法处理您的请求',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '无法连接到AI服务，请确保服务已启动',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  const quickCommands = [
    "查看当前传感器数据",
    "分析今日环境变化",
    "推荐灌溉方案",
    "检查设备状态",
  ]

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="ai-command" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="ai-command" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <MessageSquare className="h-6 w-6" />
                  AI文字控制
                </h1>
                <p className="text-muted-foreground">通过自然语言与农业AI助手对话</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-2" />
                清空对话
              </Button>
            </div>

            {/* 快捷命令 */}
            <div className="flex flex-wrap gap-2">
              {quickCommands.map((cmd, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => setInput(cmd)}
                >
                  {cmd}
                </Badge>
              ))}
            </div>

            {/* 对话区域 */}
            <Card className="h-[calc(100vh-280px)]">
              <CardContent className="h-full flex flex-col p-4">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Bot className="h-16 w-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">农业AI助手</p>
                      <p className="text-sm">问我任何农业相关问题</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {msg.timestamp.toLocaleTimeString('zh-CN')}
                          </p>
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* 输入区域 */}
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="输入您的问题..."
                    disabled={loading}
                  />
                  <Button onClick={handleSend} disabled={!input.trim() || loading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
