"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  MessageSquare,
  Send,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  History,
  Settings,
} from "lucide-react"
import { Label } from "@/components/ui/label"

/**
 * 执行器接口
 */
interface Actuator {
  id: string
  name: string
  type: string
  location: string
  status: string
}

/**
 * 命令历史记录接口
 */
interface CommandHistory {
  id: string
  timestamp: string
  command: string
  actuator: string
  status: string
  response: string
}

/**
 * AI 文字控制组件
 * 支持自然语言命令下发、执行器控制
 */
export function AICommandControl() {
  const [command, setCommand] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [actuators, setActuators] = useState<Actuator[]>([])
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([])

  /**
   * 获取执行器列表
   */
  useEffect(() => {
    const fetchActuators = async () => {
      try {
        const response = await fetch('/api/actuators')
        const result = await response.json()
        
        if (result.success && result.data) {
          setActuators(result.data)
        }
      } catch (error) {
        console.error('获取执行器列表失败:', error)
      }
    }
    
    fetchActuators()
  }, [])

  /**
   * 处理命令发送
   */
  const handleSendCommand = async () => {
    if (!command.trim()) return

    setIsProcessing(true)

    try {
      // 调用 AI 聊天 API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: command.trim(),
          actuators: actuators
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API 调用失败')
      }

      // 解析 AI 响应
      let aiMessage = result.data.response
      let commandInfo = result.data.commandInfo
      let executionResult = result.data.executionResult

      // 判断是否为无效命令或问候语
      const isInvalidAction = commandInfo?.action === 'none' || !commandInfo?.actuatorId || commandInfo?.actuatorId === 'unknown'

      // 如果是问候语或无效命令，显示AI的友好回复
      if (isInvalidAction) {
        aiMessage = commandInfo?.reply || '抱歉，我无法识别您的命令。'
      } else if (aiMessage.includes('```json')) {
        aiMessage = '命令已解析，正在执行操作...'
      }

      // 设置 AI 响应
      setAiResponse(aiMessage)

      // 如果不是无效命令，模拟命令执行
      if (!isInvalidAction) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // 添加到历史记录
      const actuator = actuators.find(a => a.id === commandInfo?.actuatorId)
      const newHistoryItem: CommandHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-CN"),
        command: command.trim(),
        actuator: isInvalidAction ? "无设备操作" : (actuator?.name || commandInfo?.actuatorId || "未知设备"),
        status: isInvalidAction ? "未执行" : (executionResult?.success ? "成功" : "失败"),
        response: isInvalidAction ? (commandInfo?.reply || "未执行设备操作") : (executionResult?.message || "命令执行成功"),
      }
      
      setCommandHistory(prev => [newHistoryItem, ...prev])

      // 清空输入
      setCommand("")
    } catch (error) {
      console.error('命令执行失败:', error)
      
      // 添加失败记录
      const newHistoryItem: CommandHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-CN"),
        command: command.trim(),
        actuator: "未知设备",
        status: "失败",
        response: "命令执行失败",
      }
      
      setCommandHistory(prev => [newHistoryItem, ...prev])
    } finally {
      setIsProcessing(false)
      // 3秒后清除响应
      setTimeout(() => setAiResponse(null), 3000)
    }
  }

  /**
   * 获取执行器状态颜色
   */
  const getActuatorStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800"
      case "offline":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">命令输入</CardTitle>
            <CardDescription>
              输入自然语言命令，AI 会自动解析并执行
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="command">输入命令</Label>
                <Badge variant="outline" className="text-xs">
                  自然语言
                </Badge>
              </div>
              <Textarea
                id="command"
                placeholder="例如：打开灌溉系统，设置为每小时浇水10分钟"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                rows={4}
                disabled={isProcessing}
              />
            </div>

            <Button
              onClick={handleSendCommand}
              disabled={!command.trim() || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  发送命令
                </>
              )}
            </Button>

            {aiResponse && (
              <div className="p-4 bg-muted/50 border border-border rounded-lg flex items-start gap-3">
                <Bot className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm">{aiResponse}</p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium">命令示例</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommand("打开灌溉系统，设置为每小时浇水10分钟")}
                >
                  打开灌溉系统，设置为每小时浇水10分钟
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommand("关闭通风设备")}
                >
                  关闭通风设备
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommand("打开遮阳棚")}
                >
                  打开遮阳棚
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommand("设置温室温度为25度")}
                >
                  设置温室温度为25度
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">执行器状态</CardTitle>
            <CardDescription>
              查看执行器当前状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actuators.map((actuator) => (
                <div key={actuator.id} className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{actuator.name}</p>
                      <p className="text-xs text-muted-foreground">{actuator.location}</p>
                    </div>
                    <Badge className={getActuatorStatusColor(actuator.status)}>
                      {actuator.status === "online" ? "在线" : "离线"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                命令历史
              </h3>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {commandHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <p className="text-sm">暂无命令记录</p>
                  </div>
                ) : (
                  commandHistory.slice(0, 5).map((item) => (
                    <div key={item.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={
                          item.status === "成功"
                            ? "bg-green-100 text-green-800"
                            : item.status === "未执行"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }>
                          {item.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.timestamp}
                        </span>
                      </div>
                      <p className="text-sm mb-1">{item.command}</p>
                      <p className="text-xs text-muted-foreground">
                        执行器: {item.actuator}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}