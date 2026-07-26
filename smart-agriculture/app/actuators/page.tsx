"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { useFarm } from "@/lib/farm-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Power,
  Droplets,
  Wind,
  Flame,
  Lightbulb,
  CircleDot,
  AlertCircle,
  Menu,
  MapPin,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ActuatorCard, Actuator, CommandStatus } from "@/components/dashboard/actuator-card"
import { getDeviceTypeConfig, ControlType } from "@/lib/device-types"

/**
 * 控制指令超时时间（秒）
 */
const COMMAND_TIMEOUT_SECONDS = 30

/**
 * 执行器页面
 * 显示所有执行器状态，支持多种控制类型和超时提醒
 */
export default function ActuatorsPage() {
  const { selectedFarmId, farms } = useFarm()
  const [activeTab, setActiveTab] = useState("actuators")
  const [currentTime, setCurrentTime] = useState<string>("")
  const [actuators, setActuators] = useState<Actuator[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  
  // 指令状态映射：actuatorId -> CommandStatus
  const [commandStatusMap, setCommandStatusMap] = useState<Record<string, CommandStatus>>({})
  // 指令超时定时器映射：actuatorId -> timerId
  const [timeoutTimers, setTimeoutTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({})

  /**
   * 更新当前时间
   */
  useEffect(() => {
    setCurrentTime(new Date().toLocaleString("zh-CN"))
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("zh-CN"))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  /**
   * 获取执行器列表
   */
  const fetchActuators = async () => {
    try {
      const url = selectedFarmId ? `/api/actuators?farm_id=${selectedFarmId}` : '/api/actuators'
      const response = await fetch(url)
      const result = await response.json()
      
      if (result.success && result.data) {
        // 转换数据格式，添加control_value字段
        const formattedActuators: Actuator[] = result.data.map((actuator: any) => ({
          ...actuator,
          control_value: actuator.control_value !== null ? parseFloat(actuator.control_value) : undefined,
        }))
        setActuators(formattedActuators)
        
        // 检查是否有pending的指令已执行完成
        for (const actuator of formattedActuators) {
          const status = commandStatusMap[actuator.id]
          if (status === 'pending') {
            // 如果执行器状态已经变化，说明指令已执行
            // 这里可以进一步优化：检查是否有最新的command执行记录
          }
        }
      }
    } catch (error) {
      console.error('获取执行器列表失败:', error)
    } finally {
      setLoading(false)
      setLastUpdate(new Date())
    }
  }

  /**
   * 初始加载和定时刷新
   */
  useEffect(() => {
    fetchActuators()
    
    const interval = setInterval(fetchActuators, 10000)
    
    return () => clearInterval(interval)
  }, [selectedFarmId])

  /**
   * 清除指令状态
   */
  const clearCommandStatus = useCallback((actuatorId: string) => {
    setCommandStatusMap(prev => {
      const newMap = { ...prev }
      delete newMap[actuatorId]
      return newMap
    })
    if (timeoutTimers[actuatorId]) {
      clearTimeout(timeoutTimers[actuatorId])
      setTimeoutTimers(prev => {
        const newTimers = { ...prev }
        delete newTimers[actuatorId]
        return newTimers
      })
    }
  }, [timeoutTimers])

  /**
   * 设置指令超时定时器
   */
  const setupTimeoutTimer = useCallback((actuatorId: string) => {
    // 清除之前的定时器
    if (timeoutTimers[actuatorId]) {
      clearTimeout(timeoutTimers[actuatorId])
    }
    
    const timer = setTimeout(() => {
      setCommandStatusMap(prev => ({
        ...prev,
        [actuatorId]: 'timeout'
      }))
      
      // 3秒后自动清除状态
      setTimeout(() => {
        clearCommandStatus(actuatorId)
      }, 3000)
    }, COMMAND_TIMEOUT_SECONDS * 1000)
    
    setTimeoutTimers(prev => ({
      ...prev,
      [actuatorId]: timer
    }))
  }, [timeoutTimers, clearCommandStatus])

  /**
   * 发送控制指令
   */
  const sendControlCommand = async (actuatorId: string, command: 'on' | 'off' | 'value', value?: number) => {
    // 设置指令状态为发送中
    setCommandStatusMap(prev => ({
      ...prev,
      [actuatorId]: 'sending'
    }))
    
    try {
      const actuator = actuators.find(a => a.id === actuatorId)
      if (!actuator) return
      
      const config = getDeviceTypeConfig(actuator.type)
      const controlType = config?.controlType || ControlType.BOOLEAN
      
      const body: any = {
        control_type: controlType,
        command: command === 'value' ? 'value' : command,
      }
      
      if (value !== undefined) {
        body.value = value
      }
      
      // 如果有控制范围配置，添加到请求中
      if (config?.controlRange) {
        body.min = config.controlRange.min
        body.max = config.controlRange.max
      }
      
      const response = await fetch(`/api/actuators/${actuatorId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      
      const result = await response.json()
      
      if (result.success) {
        // 设置指令状态为等待执行
        setCommandStatusMap(prev => ({
          ...prev,
          [actuatorId]: 'pending'
        }))
        
        // 设置超时定时器
        setupTimeoutTimer(actuatorId)
        
        // 轮询检查指令执行状态
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/actuators/${actuatorId}/commands`)
            const statusResult = await statusResponse.json()
            
            if (statusResult.success && statusResult.data) {
              const cmdStatus = statusResult.data.status
              if (cmdStatus === 'executed') {
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'executed'
                }))
                clearInterval(pollInterval)
                await fetchActuators()
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              } else if (cmdStatus === 'failed') {
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'failed'
                }))
                clearInterval(pollInterval)
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              } else if (cmdStatus === 'timeout') {
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'timeout'
                }))
                clearInterval(pollInterval)
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              }
            }
          } catch (error) {
            console.error('轮询指令状态失败:', error)
            clearInterval(pollInterval)
          }
        }, 2000)
        
        // 设置轮询超时
        setTimeout(() => {
          clearInterval(pollInterval)
        }, COMMAND_TIMEOUT_SECONDS * 1000 + 2000)
        
      } else {
        setCommandStatusMap(prev => ({
          ...prev,
          [actuatorId]: 'failed'
        }))
        setTimeout(() => clearCommandStatus(actuatorId), 3000)
      }
    } catch (error) {
      console.error('发送控制指令失败:', error)
      setCommandStatusMap(prev => ({
        ...prev,
        [actuatorId]: 'failed'
      }))
      setTimeout(() => clearCommandStatus(actuatorId), 3000)
    }
  }

  /**
   * 切换执行器模式
   */
  const toggleMode = async (actuatorId: string, currentMode: 'auto' | 'manual') => {
    const newMode = currentMode === 'auto' ? 'manual' : 'auto'
    
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
    }
  }

  /**
   * 按区域分组执行器
   */
  const getActuatorsGroupedByArea = () => {
    const groups: Record<string, Actuator[]> = {}
    
    // 添加"未分组"区域
    groups['未分组'] = []
    
    actuators.forEach(actuator => {
      const area = actuator.area || '未分组'
      if (!groups[area]) {
        groups[area] = []
      }
      groups[area].push(actuator)
    })
    
    return groups
  }

  /**
   * 获取区域统计信息
   */
  const getAreaStats = (areaActuators: Actuator[]) => {
    const onlineCount = areaActuators.filter(a => a.status === 'online').length
    const runningCount = areaActuators.filter(a => a.state === 'on').length
    return { onlineCount, runningCount, total: areaActuators.length }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 侧边栏 - 在大屏幕上显示，小屏幕上隐藏 */}
      <div className="hidden lg:flex">
        <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen">
        {/* 移动端导航按钮 */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg bg-card border border-border shadow-lg">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
            </SheetContent>
          </Sheet>
        </div>
        
        <Header activeTab={activeTab} />
        
        <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">执行器控制</h1>
              <p className="text-sm text-muted-foreground">
                {farms.find(f => f.id === selectedFarmId)?.name || '未选择基地'} · 共 {actuators.length} 个执行器
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3" />
                <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
              </div>
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
            <div className="space-y-6">
              {/* 按区域分组显示 */}
              {Object.entries(getActuatorsGroupedByArea()).map(([area, areaActuators]) => {
                const stats = getAreaStats(areaActuators)
                
                return (
                  <div key={area}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">{area}</h2>
                        <p className="text-xs text-muted-foreground">
                          {stats.onlineCount}/{stats.total} 在线 · {stats.runningCount} 运行中
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {areaActuators.map((actuator) => (
                        <ActuatorCard
                          key={actuator.id}
                          actuator={actuator}
                          onControl={(command, value) => sendControlCommand(actuator.id, command, value)}
                          commandStatus={commandStatusMap[actuator.id] || 'idle'}
                          timeout={COMMAND_TIMEOUT_SECONDS}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Power className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">控制流程说明</p>
                <p className="text-xs text-muted-foreground">
                  发送控制指令 → 等待硬件回执 → 更新页面状态 → 超时提醒
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-4 rounded-lg bg-yellow/5 border border-yellow/10">
              <div className="w-8 h-8 rounded-lg bg-yellow/20 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">超时提醒</p>
                <p className="text-xs text-muted-foreground">
                  如果 {COMMAND_TIMEOUT_SECONDS} 秒内未收到硬件回执，系统将提示控制超时
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-4 rounded-lg bg-green/5 border border-green/10">
              <div className="w-8 h-8 rounded-lg bg-green/20 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">自动刷新</p>
                <p className="text-xs text-muted-foreground">
                  页面每10秒自动刷新一次，保持数据最新
                </p>
              </div>
            </div>
          </div>

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
            <div className="flex items-start gap-2">
              <Power className="w-4 h-4 text-chart-6 mt-0.5" />
              <div>
                <p className="font-medium">电机/舵机</p>
                <p className="text-muted-foreground">支持速度和角度控制</p>
              </div>
            </div>
          </div>
        </main>
        
        <footer className="h-12 border-t border-border bg-card/50 flex items-center justify-center px-4">
          <p className="text-xs text-muted-foreground text-center">
            天工慧眼 - 智慧农业物联网监控平台 v1.0.0 | 数据更新时间: {currentTime || "--"}
          </p>
        </footer>
      </div>
    </div>
  )
}
