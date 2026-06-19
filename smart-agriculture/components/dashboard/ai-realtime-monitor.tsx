'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Lightbulb, Play, Pause, RefreshCw, Terminal, ChevronDown } from 'lucide-react'

interface SensorAnalysis {
  sensorName: string
  value: string
  unit: string
  status: 'normal' | 'abnormal'
  analysis: string
}

interface DiagnosisResult {
  summary: string
  sensorAnalysis: SensorAnalysis[]
  issues: string[]
  suggestions: string[]
  actions: string[]
}

interface SensorData {
  sensor_id: string
  sensor_name: string
  type: string
  type_name: string
  value: number
  unit: string
  timestamp: string
}

interface DetectionResult {
  id: number
  image_url: string
  result: string
  confidence: number
  timestamp: string
}

interface LogEntry {
  id: number
  timestamp: string
  type: 'info' | 'success' | 'warning' | 'error' | 'system'
  message: string
}

function CollapsibleCard({
  title,
  icon: Icon,
  iconColor = 'text-gray-600',
  children,
  defaultCollapsed = true
}: {
  title: string
  icon?: typeof CheckCircle
  iconColor?: string
  children: React.ReactNode
  defaultCollapsed?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed)

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 ease-out cursor-pointer"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="p-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </div>
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-4 pt-0">
          {children}
        </div>
      </div>
    </div>
  )
}

export function AIRealtimeMonitor() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([])
  const [currentThinking, setCurrentThinking] = useState<string>('')
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logIdRef = useRef(0)
  const thinkingIndexRef = useRef(0)

  const thinkingSteps = [
    '正在分析传感器数据...',
    '正在检查温度传感器数据...',
    '正在检查湿度传感器数据...',
    '正在分析图片识别结果...',
    '正在判断是否存在病虫害...',
    '正在查询数据库...',
    '正在匹配决策方案...',
    '正在制定决策方案...',
    '诊断完成'
  ]

  const addLog = (type: LogEntry['type'], message: string) => {
    const newLog: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date().toLocaleTimeString('zh-CN'),
      type,
      message
    }
    setLogs(prev => [...prev, newLog])
    console.log(`[${newLog.timestamp}] [${type.toUpperCase()}] ${message}`)
  }

  const startThinkingAnimation = () => {
    thinkingIndexRef.current = 0
    addLog('system', '开始AI诊断分析...')

    const showNextStep = () => {
      if (thinkingIndexRef.current < thinkingSteps.length) {
        const step = thinkingSteps[thinkingIndexRef.current]
        setCurrentThinking(step)
        addLog('info', step)
        thinkingIndexRef.current++
        setTimeout(showNextStep, 1500)
      } else {
        setCurrentThinking('')
      }
    }

    showNextStep()
  }

  const performDiagnosis = async () => {
    setIsAnalyzing(true)
    setCurrentThinking('')
    setLogs([])

    startThinkingAnimation()

    try {
      addLog('system', '正在调用AI诊断API...')
      const response = await fetch('/api/ai/diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        addLog('success', 'AI诊断API调用成功')
        setDiagnosisResult(result.data.diagnosis)
        setSensorData(result.data.sensorData || [])
        setDetectionResults(result.data.detectionResults || [])
        setLastUpdate(new Date().toLocaleString('zh-CN'))

        addLog('system', '===========================================')
        addLog('system', 'AI诊断接口 - OLLAMA API 响应内容:')
        addLog('info', `  model: ${result.data.rawResponse?.model || 'unknown'}`)
        addLog('info', `  created_at: ${result.data.rawResponse?.created_at || 'unknown'}`)

        if (result.data.rawResponse?.thinking) {
          addLog('system', '  thinking:')
          const thinkingLines = result.data.rawResponse.thinking.split('\n').filter(line => line.trim())
          thinkingLines.forEach((line: string) => {
            addLog('info', `    ${line.trim().slice(0, 100)}`)
          })
        }

        addLog('info', `  total_duration: ${result.data.rawResponse?.total_duration || 0} ns`)
        addLog('info', `  eval_count: ${result.data.rawResponse?.eval_count || 0} tokens`)
        addLog('system', '===========================================')

        addLog('system', '--- 诊断结果 ---')
        addLog('info', `摘要: ${result.data.diagnosis?.summary || '无'}`)

        if (result.data.diagnosis?.sensorAnalysis && result.data.diagnosis.sensorAnalysis.length > 0) {
          addLog('info', `传感器分析: ${result.data.diagnosis.sensorAnalysis.length} 个`)
          result.data.diagnosis.sensorAnalysis.forEach((sa: any, index: number) => {
            addLog(sa.status === 'normal' ? 'success' : 'warning',
              `${index + 1}. ${sa.sensorName}: ${sa.value}${sa.unit} (${sa.status === 'normal' ? '正常' : '异常'})`)
            addLog('info', `   分析: ${sa.analysis || '无分析说明'}`)
          })
        }

        if (result.data.diagnosis?.issues && result.data.diagnosis.issues.length > 0) {
          addLog('warning', `发现问题: ${result.data.diagnosis.issues.length} 个`)
          result.data.diagnosis.issues.forEach((issue: string, index: number) => {
            addLog('warning', `${index + 1}. ${issue}`)
          })
        } else {
          addLog('success', '未发现异常问题')
        }

        if (result.data.diagnosis?.suggestions && result.data.diagnosis.suggestions.length > 0) {
          addLog('info', `建议措施: ${result.data.diagnosis.suggestions.length} 条`)
          result.data.diagnosis.suggestions.forEach((suggestion: string, index: number) => {
            addLog('info', `${index + 1}. ${suggestion}`)
          })
        }

        if (result.data.diagnosis?.actions && result.data.diagnosis.actions.length > 0) {
          addLog('system', `执行策略: ${result.data.diagnosis.actions.length} 项`)
          result.data.diagnosis.actions.forEach((action: string, index: number) => {
            addLog('system', `${index + 1}. ${action}`)
          })
        }

        addLog('system', '--- 数据来源 ---')
        addLog('info', `传感器设备: ${result.data.sensorData?.length || 0} 个`)
        addLog('info', `图片识别记录: ${result.data.detectionResults?.length || 0} 条`)
      } else {
        addLog('error', `诊断失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      addLog('error', `诊断过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false)
        addLog('system', '诊断流程结束')
      }, 500)
    }
  }

  const toggleMonitoring = () => {
    if (isMonitoring) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsMonitoring(false)
      addLog('system', '监测已停止')
    } else {
      performDiagnosis()
      timerRef.current = setInterval(() => {
        if (isMonitoring && !isAnalyzing) {
          performDiagnosis()
        }
      }, 60000)
      setIsMonitoring(true)
      addLog('system', '自动监测已启动，每60秒执行一次诊断')
    }
  }

  useEffect(() => {
    performDiagnosis()
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-600'
      case 'warning': return 'text-amber-600'
      case 'error': return 'text-red-600'
      case 'system': return 'text-blue-600 font-semibold'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI实时监测</h1>
          <p className="text-gray-500 mt-1">基于传感器数据和图片识别的智能诊断系统</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={toggleMonitoring}
            className={isMonitoring ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'}
            disabled={isAnalyzing}
          >
            {isMonitoring ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isMonitoring ? '停止监测' : '开始监测'}
          </Button>
          <Button
            onClick={performDiagnosis}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            立即诊断
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        <Card className="flex flex-col min-h-0">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">AI</span>
              </div>
              AI思考过程
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 relative overflow-hidden bg-gradient-to-br from-blue-50/50 to-indigo-50/50 flex flex-col">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 left-1/4 w-1 h-1 bg-blue-400 rounded-full opacity-60 animate-pulse" />
              <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-indigo-400 rounded-full opacity-60 animate-pulse delay-300" />
              <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-purple-400 rounded-full opacity-60 animate-pulse delay-500" />
              <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-cyan-400 rounded-full opacity-60 animate-pulse delay-700" />
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-8">
              {!isAnalyzing && !currentThinking ? (
                <div className="text-center text-gray-400">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>点击"立即诊断"开始AI分析</p>
                  {isMonitoring && <p className="text-sm mt-2">系统将每60秒自动诊断一次</p>}
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute -inset-4 bg-blue-400/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative px-8 py-4 rounded-2xl bg-white/90 backdrop-blur-sm shadow-xl border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-lg font-medium text-blue-800">{currentThinking}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isAnalyzing && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>正在分析...</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-0">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              诊断结果与执行策略
            </CardTitle>
            {lastUpdate && (
              <p className="text-xs text-gray-400 mt-1">最后更新: {lastUpdate}</p>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {diagnosisResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                  <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    诊断摘要
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {diagnosisResult.summary || '暂无诊断摘要'}
                  </p>
                </div>

                {sensorData.length > 0 && (
                  <CollapsibleCard
                    title={`最新传感器数据 (${sensorData.length})`}
                    icon={CheckCircle}
                    iconColor="text-green-600"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {sensorData.map((sensor, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="text-xs text-gray-500 truncate max-w-[100px]">{sensor.sensor_name}</span>
                          <span className="text-sm font-medium text-gray-800">
                            {sensor.value}{sensor.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}

                {diagnosisResult.sensorAnalysis && diagnosisResult.sensorAnalysis.length > 0 && (
                  <CollapsibleCard
                    title={`AI传感器分析 (${diagnosisResult.sensorAnalysis.length})`}
                    icon={Lightbulb}
                    iconColor="text-blue-600"
                  >
                    <div className="space-y-3">
                      {diagnosisResult.sensorAnalysis.map((sensor, index) => (
                        <div key={index} className={`p-3 rounded-lg border ${sensor.status === 'normal' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-800">{sensor.sensorName}</span>
                            <span className={`text-sm font-semibold ${sensor.status === 'normal' ? 'text-green-600' : 'text-amber-600'}`}>
                              {sensor.value}{sensor.unit}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{sensor.analysis}</p>
                          <div className="flex items-center gap-1 mt-2">
                            {sensor.status === 'normal' ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="w-3 h-3" />
                                正常
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="w-3 h-3" />
                                异常
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}

                {detectionResults.length > 0 && (
                  <CollapsibleCard
                    title={`最新图片识别结果 (${detectionResults.length})`}
                    icon={Terminal}
                    iconColor="text-purple-600"
                  >
                    <div className="space-y-2">
                      {detectionResults.slice(0, 3).map((detection, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">识别结果:</span>
                            <span className="text-sm font-medium text-gray-800">{detection.result}</span>
                          </div>
                          <span className="text-xs text-blue-600">
                            置信度: {(detection.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}

                {diagnosisResult.issues && diagnosisResult.issues.length > 0 && (
                  <CollapsibleCard
                    title={`发现的问题 (${diagnosisResult.issues.length})`}
                    icon={AlertTriangle}
                    iconColor="text-red-600"
                    defaultCollapsed={false}
                  >
                    <ul className="space-y-2">
                      {diagnosisResult.issues.map((issue, index) => (
                        <li key={index} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <span className="text-gray-700 text-sm">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleCard>
                )}

                {diagnosisResult.suggestions && diagnosisResult.suggestions.length > 0 && (
                  <CollapsibleCard
                    title={`建议措施 (${diagnosisResult.suggestions.length})`}
                    icon={Lightbulb}
                    iconColor="text-amber-600"
                  >
                    <ul className="space-y-2">
                      {diagnosisResult.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                          <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <span className="text-gray-700 text-sm">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleCard>
                )}

                {diagnosisResult.actions && diagnosisResult.actions.length > 0 && (
                  <CollapsibleCard
                    title={`执行策略 (${diagnosisResult.actions.length})`}
                    icon={Play}
                    iconColor="text-green-600"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {diagnosisResult.actions.map((action, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="justify-start bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800"
                          onClick={() => {
                            addLog('system', `用户执行策略: ${action}`)
                            alert(`即将执行: ${action}`)
                          }}
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}

                {(!diagnosisResult.issues || diagnosisResult.issues.length === 0) &&
                  (!diagnosisResult.suggestions || diagnosisResult.suggestions.length === 0) && (
                    <div className="text-center py-8">
                      <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
                      <p className="text-green-600 font-medium">所有数据正常，暂无异常情况</p>
                      <p className="text-gray-400 text-sm mt-2">系统运行状态良好</p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>等待诊断结果...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900">
        <CardHeader className="border-b border-gray-700">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            诊断日志
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 max-h-40 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-500">等待诊断开始...</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-gray-500 flex-shrink-0">[{log.timestamp}]</span>
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-50/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-gray-600">数据来源</CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              传感器数据: {sensorData.length} 个设备
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              图片识别: {detectionResults.length} 条记录
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              监测状态: {isMonitoring ? '运行中' : '已停止'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}