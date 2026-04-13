"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  RefreshCw,
  Power,
  PowerOff,
  Settings,
  Droplets,
  Wind,
  Flame,
  Lightbulb,
  CircleDot,
  AlertCircle,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

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
 * 执行器控制页面
 * 显示所有执行器状态，支持开关控制和模式切换
 */
export default function ActuatorsPage() {
  const [actuators, setActuators] = useState<Actuator[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [updating, setUpdating] = useState<string | null>(null)

  /**
   * 获取执行器列表
   */
  const fetchActuators = async () => {
    try {
      const response = await fetch('/api/actuators')
      const result = await response.json()
      
      if (result.success && result.data) {
        setActuators(result.data)
      }
    } catch (error) {
      console.error('获取执行器列表失败:', error)
    } finally {
      setLoading(false)
      setLastUpdate(new Date())
    }
  }

  useEffect(() => {
    fetchActuators()
    
    const interval = setInterval(fetchActuators, 10000)
    
    return () => clearInterval(interval)
  }, [])

  /**
   * 切换执行器开关状态（发送控制指令）
   */
  const toggleState = async (actuatorId: string, currentState: 'on' | 'off') => {
    const newState = currentState === 'on' ? 'off' : 'on'
    
    setUpdating(actuatorId)
    
    try {
      const response = await fetch(`/api/actuators/${actuatorId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: newState,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log('控制指令已发送:', result.data)
        await fetchActuators()
        alert(`已发送${newState === 'on' ? '开启' : '关闭'}指令，等待硬件执行...`)
      } else {
        alert('操作失败: ' + result.error)
      }
    } catch (error) {
      console.error('发送控制指令失败:', error)
      alert('操作失败')
    } finally {
      setUpdating(null)
    }
  }

  /**
   * 切换执行器模式
   */
  const toggleMode = async (actuatorId: string, currentMode: 'auto' | 'manual') => {
    const newMode = currentMode === 'auto' ? 'manual' : 'auto'
    
    setUpdating(actuatorId)
    
    try {
      const response = await fetch(`/api/actuators/${actuatorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: newMode,
          trigger_source: 'user',
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchActuators()
      } else {
        alert('操作失败: ' + result.error)
      }
    } catch (error) {
      console.error('切换执行器模式失败:', error)
      alert('操作失败')
    } finally {
      setUpdating(null)
    }
  }

  /**
   * 获取状态徽章样式
   */
  const getStatusBadge = (status: string) => {
    if (status === 'online') {
      return <Badge className="bg-primary/20 text-primary">在线</Badge>
    }
    return <Badge className="bg-destructive/20 text-destructive">离线</Badge>
  }

  /**
   * 获取开关状态徽章
   */
  const getStateBadge = (state: string) => {
    if (state === 'on') {
      return <Badge className="bg-chart-3/20 text-chart-3">开启</Badge>
    }
    return <Badge className="bg-muted text-muted-foreground">关闭</Badge>
  }

  /**
   * 获取模式徽章
   */
  const getModeBadge = (mode: string) => {
    if (mode === 'auto') {
      return <Badge variant="outline" className="border-primary text-primary">自动</Badge>
    }
    return <Badge variant="outline" className="border-chart-4 text-chart-4">手动</Badge>
  }

  /**
   * 格式化最后更新时间
   */
  const formatLastUpdate = (timestamp: string | null) => {
    if (!timestamp) return '从未更新'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60)
    
    if (diff < 1) return '刚刚'
    if (diff < 60) return `${diff}分钟前`
    if (diff < 1440) return `${Math.floor(diff / 60)}小时前`
    return date.toLocaleString('zh-CN')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">执行器控制</h1>
              <p className="text-sm text-muted-foreground">
                管理和控制农业设备执行器
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={fetchActuators} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : actuators.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">暂无执行器</p>
            <p className="text-sm">系统中还没有配置执行器设备</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {actuators.map((actuator) => {
              const Icon = actuatorIcons[actuator.type] || Power
              const isUpdating = updating === actuator.id
              
              return (
                <Card key={actuator.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          actuator.state === 'on' 
                            ? 'bg-chart-3/20' 
                            : 'bg-muted'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            actuator.state === 'on' 
                              ? 'text-chart-3' 
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{actuator.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {actuator.type_name} · {actuator.location}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(actuator.status)}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">开关状态</span>
                        {getStateBadge(actuator.state)}
                      </div>
                      <Button
                        size="sm"
                        variant={actuator.state === 'on' ? 'destructive' : 'default'}
                        onClick={() => toggleState(actuator.id, actuator.state)}
                        disabled={actuator.status === 'offline' || isUpdating}
                      >
                        {isUpdating ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : actuator.state === 'on' ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-2" />
                            关闭
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-2" />
                            开启
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">控制模式</span>
                        {getModeBadge(actuator.mode)}
                      </div>
                      <Select
                        value={actuator.mode}
                        onValueChange={(value) => toggleMode(actuator.id, actuator.mode)}
                        disabled={actuator.status === 'offline' || isUpdating}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">自动</SelectItem>
                          <SelectItem value="manual">手动</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>最后更新</span>
                        <span>{formatLastUpdate(actuator.last_update)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">执行器说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Droplets className="w-4 h-4 text-chart-1 mt-0.5" />
                <div>
                  <p className="font-medium">水泵</p>
                  <p className="text-muted-foreground">用于灌溉和排水控制</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Wind className="w-4 h-4 text-chart-2 mt-0.5" />
                <div>
                  <p className="font-medium">风扇</p>
                  <p className="text-muted-foreground">用于通风和温度调节</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Flame className="w-4 h-4 text-chart-4 mt-0.5" />
                <div>
                  <p className="font-medium">加热器</p>
                  <p className="text-muted-foreground">用于温度控制</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CircleDot className="w-4 h-4 text-chart-3 mt-0.5" />
                <div>
                  <p className="font-medium">电磁阀</p>
                  <p className="text-muted-foreground">用于水流控制</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-chart-5 mt-0.5" />
                <div>
                  <p className="font-medium">补光灯</p>
                  <p className="text-muted-foreground">用于光照调节</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
