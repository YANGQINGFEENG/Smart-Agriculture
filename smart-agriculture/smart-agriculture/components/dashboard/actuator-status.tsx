"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Power,
  PowerOff,
  Droplets,
  Wind,
  Flame,
  Lightbulb,
  CircleDot,
  RefreshCw,
  AlertCircle,
  Zap,
} from "lucide-react"

/**
 * 执行器数据接口
 */
interface Actuator {
  id: string
  name: string
  type: string
  type_name: string
  description: string
  location: string
  status: 'online' | 'offline'
  state: 'on' | 'off'
  mode: 'auto' | 'manual'
  last_update: string | null
}

/**
 * 执行器图标映射
 */
const actuatorIcons: Record<string, typeof Power> = {
  water_pump: Droplets,
  fan: Wind,
  heater: Flame,
  valve: CircleDot,
  light: Lightbulb,
}

/**
 * 执行器状态展示组件
 * 在主页显示执行器状态和快速控制
 */
export function ActuatorStatus() {
  const [actuators, setActuators] = useState<Actuator[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [updating, setUpdating] = useState<string | null>(null)

  /**
   * 获取执行器列表
   */
  const fetchActuators = useCallback(async () => {
    try {
      const response = await fetch('/api/actuators', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      const result = await response.json()
      
      if (result.success && result.data) {
        const now = Date.now()
        
        const validActuators = result.data.filter((a: Actuator) => {
          if (!a.last_update) return false
          
          const updateTime = new Date(a.last_update).getTime()
          const hoursDiff = (now - updateTime) / (1000 * 60 * 60)
          
          return hoursDiff < 1
        })
        
        setActuators(validActuators)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('获取执行器列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActuators()
    
    const interval = setInterval(fetchActuators, 2000)
    
    return () => clearInterval(interval)
  }, [fetchActuators])

  /**
   * 切换执行器开关状态
   */
  const toggleState = async (actuatorId: string, currentState: 'on' | 'off') => {
    const newState = currentState === 'on' ? 'off' : 'on'
    
    setUpdating(actuatorId)
    
    try {
      const commandResponse = await fetch(`/api/actuators/${actuatorId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: newState,
        }),
      })
      
      const commandResult = await commandResponse.json()
      
      if (!commandResult.success) {
        alert('发送控制指令失败: ' + commandResult.error)
        setUpdating(null)
        return
      }
      
      const response = await fetch(`/api/actuators/${actuatorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: newState,
          trigger_source: 'user',
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setActuators(prev => 
          prev.map(a => 
            a.id === actuatorId 
              ? { ...a, state: newState, last_update: new Date().toISOString() }
              : a
          )
        )
        
        setTimeout(() => fetchActuators(), 500)
      } else {
        alert('操作失败: ' + result.error)
      }
    } catch (error) {
      console.error('切换执行器状态失败:', error)
      alert('操作失败')
    } finally {
      setUpdating(null)
    }
  }

  /**
   * 格式化最后更新时间
   */
  const formatLastUpdate = (timestamp: string | null) => {
    if (!timestamp) return '从未更新'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return `${diff}秒前`
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return date.toLocaleString('zh-CN')
  }

  /**
   * 统计在线设备数量
   */
  const onlineCount = actuators.filter(a => a.status === 'online').length
  const onCount = actuators.filter(a => a.state === 'on').length

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              执行器状态
            </CardTitle>
            <CardDescription>
              实时监控和控制农业设备（每2秒自动刷新，显示1小时内有数据的设备）
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>{lastUpdate.toLocaleTimeString('zh-CN')}</span>
            </div>
            <Button 
              onClick={() => {
                setLoading(true)
                fetchActuators()
              }} 
              disabled={loading} 
              size="sm" 
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : actuators.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">暂无执行器数据</p>
            <p className="text-xs mt-2">等待硬件设备上传数据...</p>
            <p className="text-xs mt-1 text-muted-foreground">（只显示1小时内有更新的设备）</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50 border border-border">
                <span className="text-3xl font-bold text-foreground">{actuators.length}</span>
                <span className="text-xs text-muted-foreground mt-1">总设备数</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-primary/10 border border-primary/30">
                <span className="text-3xl font-bold text-primary">{onlineCount}</span>
                <span className="text-xs text-muted-foreground mt-1">在线设备</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <span className="text-3xl font-bold text-green-500">{onCount}</span>
                <span className="text-xs text-muted-foreground mt-1">运行中</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50 border border-border">
                <span className="text-3xl font-bold text-foreground">{actuators.length - onlineCount}</span>
                <span className="text-xs text-muted-foreground mt-1">离线设备</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actuators.map((actuator) => {
                const Icon = actuatorIcons[actuator.type] || Power
                const isUpdating = updating === actuator.id
                const isOn = actuator.state === 'on'
                const isOnline = actuator.status === 'online'
                
                return (
                  <div
                    key={actuator.id}
                    className={`
                      relative p-5 rounded-xl border-2 transition-all duration-300
                      ${isOn 
                        ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20' 
                        : 'bg-muted/30 border-border hover:border-primary/50'
                      }
                      ${isUpdating ? 'opacity-75' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`
                          p-3 rounded-xl transition-all duration-300
                          ${isOn 
                            ? 'bg-green-500/30 shadow-lg shadow-green-500/30' 
                            : 'bg-muted'
                          }
                        `}>
                          <Icon className={`
                            w-6 h-6 transition-all duration-300
                            ${isOn 
                              ? 'text-green-500 animate-pulse' 
                              : 'text-muted-foreground'
                            }
                          `} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-base font-semibold text-foreground truncate">
                              {actuator.name}
                            </p>
                            {isOnline ? (
                              <Badge className="bg-green-500/20 text-green-600 text-xs border border-green-500/30">
                                在线
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-600 text-xs border border-red-500/30">
                                离线
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">
                              {actuator.location}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={`
                                text-xs
                                ${actuator.mode === 'auto' 
                                  ? 'border-blue-500 text-blue-500' 
                                  : 'border-orange-500 text-orange-500'
                                }
                              `}
                            >
                              {actuator.mode === 'auto' ? '自动' : '手动'}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="w-3 h-3" />
                            <span>{formatLastUpdate(actuator.last_update)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleState(actuator.id, actuator.state)}
                        disabled={!isOnline || isUpdating}
                        className={`
                          relative w-16 h-16 rounded-2xl transition-all duration-300
                          flex items-center justify-center
                          ${isOn 
                            ? 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/50' 
                            : 'bg-muted hover:bg-muted/80'
                          }
                          ${!isOnline || isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          ${isUpdating ? 'animate-pulse' : ''}
                        `}
                      >
                        {isUpdating ? (
                          <RefreshCw className="w-6 h-6 text-white animate-spin" />
                        ) : isOn ? (
                          <Power className="w-7 h-7 text-white" />
                        ) : (
                          <PowerOff className="w-7 h-7 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    
                    {isOn && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
