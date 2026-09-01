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
  Zap,
  Check,
  X,
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
  const [aiError, setAiError] = useState<string | null>(null)
  const [actuators, setActuators] = useState<Actuator[]>([])
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([])
  /** 当前命令信息（含自动化方案） */
  const [commandInfo, setCommandInfo] = useState<any>(null)
  /** 执行结果（含组合动作多设备结果） */
  const [executionResult, setExecutionResult] = useState<any>(null)

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
    setAiError(null)
    setAiResponse(null)

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
        // API 返回失败，显示错误信息
        const errorMsg = result.error || 'AI 服务调用失败'
        setAiError(errorMsg)
        
        const newHistoryItem: CommandHistory = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleString("zh-CN"),
          command: command.trim(),
          actuator: "系统",
          status: "失败",
          response: errorMsg,
        }
        setCommandHistory(prev => [newHistoryItem, ...prev])
        return
      }

      // 解析 AI 响应
      let aiMessage = result.data.response
      let cmdInfo = result.data.commandInfo
      let execResult = result.data.executionResult

      // 保存到状态（供自动化方案卡片使用）
      setCommandInfo(cmdInfo)
      setExecutionResult(execResult)

      // 判断是否为无效命令或问候语
      const isInvalidAction = cmdInfo?.action === 'none' || (!cmdInfo?.actuatorId && cmdInfo?.action !== 'automation')
      const isAutomation = cmdInfo?.action === 'automation'

      // 如果是问候语或无效命令，显示AI的友好回复
      if (isInvalidAction) {
        aiMessage = cmdInfo?.reply || '抱歉，我无法识别您的命令。'
      } else if (isAutomation) {
        // 自动化方案推荐：显示方案卡片，不自动执行
        aiMessage = cmdInfo?.reply || '检测到匹配的自动化方案'
      } else if (aiMessage.includes('```json')) {
        aiMessage = '命令已解析，正在执行操作...'
      }

      // 设置 AI 响应
      setAiResponse(aiMessage)

      // 如果不是无效命令且不是自动化方案，模拟命令执行
      if (!isInvalidAction && !isAutomation) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // 添加到历史记录
      const actuator = actuators.find(a => a.id === cmdInfo?.actuatorId)
      const newHistoryItem: CommandHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-CN"),
        command: command.trim(),
        actuator: isInvalidAction ? "无设备操作" : (isAutomation ? "自动化方案推荐" : (actuator?.name || cmdInfo?.actuatorId || "未知设备")),
        status: isInvalidAction ? "未执行" : (isAutomation ? "待确认" : (execResult?.success ? "成功" : "失败")),
        response: isInvalidAction ? (cmdInfo?.reply || "未执行设备操作") : (execResult?.message || "命令执行成功"),
      }
      
      setCommandHistory(prev => [newHistoryItem, ...prev])

      // 清空输入
      setCommand("")
    } catch (error) {
      // 网络错误等前端异常
      const errorMsg = error instanceof Error ? error.message : '网络连接异常，请检查网络后重试'
      console.error('[AI Chat] 前端请求异常:', errorMsg)
      setAiError(errorMsg)
      
      const newHistoryItem: CommandHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-CN"),
        command: command.trim(),
        actuator: "系统",
        status: "失败",
        response: errorMsg,
      }
      
      setCommandHistory(prev => [newHistoryItem, ...prev])
    } finally {
      setIsProcessing(false)
      // 5秒后清除提示（自动化方案卡片不自动清除）
      setTimeout(() => {
        setAiResponse(null)
        setAiError(null)
      }, 5000)
    }
  }

  /**
   * 执行自动化方案（用户点击"执行方案"后）
   */
  const handleExecuteAutomation = async (automationId: number) => {
    setIsProcessing(true)
    setAiError(null)
    setAiResponse(null)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `执行自动化方案 ${automationId}`,
          action: 'execute_automation',
          automationId,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        setAiError(result.error || '方案执行失败')
        return
      }

      const cmdInfo = result.data.commandInfo
      const execResult = result.data.executionResult

      setCommandInfo(cmdInfo)
      setExecutionResult(execResult)
      setAiResponse(cmdInfo?.reply || '方案执行完成')

      // 添加到历史记录
      const newHistoryItem: CommandHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-CN"),
        command: `执行自动化方案 #${automationId}`,
        actuator: "自动化方案",
        status: execResult?.success ? "成功" : "失败",
        response: execResult?.message || "命令执行完成",
      }
      setCommandHistory(prev => [newHistoryItem, ...prev])
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '网络连接异常'
      setAiError(errorMsg)
    } finally {
      setIsProcessing(false)
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

            {aiError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">请求失败</p>
                  <p className="text-xs text-red-600 mt-1">{aiError}</p>
                </div>
              </div>
            )}

            {aiResponse && (
              <div className="p-4 bg-muted/50 border border-border rounded-lg flex items-start gap-3">
                <Bot className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm">{aiResponse}</p>
              </div>
            )}

            {/* 自动化方案推荐卡片 */}
            {commandInfo?.action === 'automation' && commandInfo?.automationScheme && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">
                    {commandInfo.automationScheme.name}
                  </span>
                  <Badge className="bg-blue-100 text-blue-700 text-xs">
                    推荐方案
                  </Badge>
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  {commandInfo.automationScheme.action_desc}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleExecuteAutomation(commandInfo.automationScheme.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                    )}
                    执行方案
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCommandInfo(null)
                      setExecutionResult(null)
                    }}
                  >
                    忽略
                  </Button>
                </div>
              </div>
            )}

            {/* 执行结果展示（组合动作多设备） */}
            {executionResult?.results && executionResult.results.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800 mb-2">
                  {executionResult.success ? '全部执行成功' : '部分执行失败'}
                </p>
                <div className="space-y-1">
                  {executionResult.results.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {r.success ? (
                        <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      )}
                      <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                        {r.message}
                      </span>
                    </div>
                  ))}
                </div>
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