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
  MoreVertical,
  Undo2,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
 * 策略数据接口
 */
interface Strategy {
  id: string
  name: string
  actuator_id: string
  enabled: boolean
  trigger_condition: {
    type: string
    operator: string
    value: number
    unit: string
  }
  time_range?: {
    start: string
    end: string
  }
  action: 'on' | 'off'
  stop_condition?: {
    type: string
    value: number
    unit: string
  }
  safety_config: {
    max_duration: number
    cooldown_time: number
  }
  created_at: string
  updated_at?: string
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
  const [deletedActuators, setDeletedActuators] = useState<Actuator[]>([])
  const [loading, setLoading] = useState(true)
  // 初始值设置为null，避免服务器端渲染时间
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // 只在客户端设置初始时间
  useEffect(() => {
    setLastUpdate(new Date())
  }, [])
  const [updating, setUpdating] = useState<string | null>(null)
  const [formattedTimes, setFormattedTimes] = useState<Record<string, string>>({})
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  
  // 策略相关状态
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [showStrategyModal, setShowStrategyModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedActuatorId, setSelectedActuatorId] = useState<string | null>(null)
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null)
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null)
  const [strategyLogs, setStrategyLogs] = useState<any[]>([])

  // 在客户端加载已删除设备列表
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deletedActuators')
      if (saved) {
        setDeletedActuators(JSON.parse(saved))
      }
    }
  }, [])

  // 监听已删除设备列表变化，保存到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('deletedActuators', JSON.stringify(deletedActuators))
    }
  }, [deletedActuators])

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
        // 过滤掉已经被删除的设备
        const filteredActuators = result.data.filter((actuator: Actuator) => 
          !deletedActuators.some(deleted => deleted.id === actuator.id)
        )
        setActuators(filteredActuators)
        setLastUpdate(new Date())
        
        // 获取策略列表
        fetchStrategies()
      }
    } catch (error) {
      console.error('获取执行器列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [deletedActuators])

  /**
   * 获取策略列表
   */
  const fetchStrategies = useCallback(async () => {
    try {
      const response = await fetch('/api/strategies', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      const result = await response.json()
      
      if (result.success && result.data) {
        setStrategies(result.data)
      }
    } catch (error) {
      console.error('获取策略列表失败:', error)
    }
  }, [])

  /**
   * 获取策略执行日志
   */
  const fetchStrategyLogs = useCallback(async (strategyId: string | null, actuatorId: string | null) => {
    try {
      let url = '/api/strategies/execution-logs'
      const params = new URLSearchParams()
      if (strategyId) {
        params.append('strategy_id', strategyId)
      }
      if (actuatorId) {
        params.append('actuator_id', actuatorId)
      }
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      const result = await response.json()
      
      if (result.success && result.data) {
        setStrategyLogs(result.data.logs)
      }
    } catch (error) {
      console.error('获取策略执行日志失败:', error)
    }
  }, [])

  useEffect(() => {
    fetchActuators()
    
    const interval = setInterval(fetchActuators, 2000)
    
    return () => clearInterval(interval)
  }, [fetchActuators])

  useEffect(() => {
    const updateFormattedTimes = () => {
      const newTimes: Record<string, string> = {}
      actuators.forEach(actuator => {
        newTimes[actuator.id] = formatLastUpdate(actuator.last_update)
      })
      setFormattedTimes(newTimes)
    }
    
    updateFormattedTimes()
    const interval = setInterval(updateFormattedTimes, 1000)
    
    return () => clearInterval(interval)
  }, [actuators])

  /**
   * 切换执行器开关状态（服务器状态锁定机制）
   * 
   * 核心原则：服务器状态由用户操作锁定，不受硬件上报状态影响
   * 
   * 流程说明：
   * 1. 用户点击按钮 → 向服务器发送控制指令 + 更新服务器状态
   * 2. 服务器状态立即锁定为用户期望的状态
   * 3. 前端立即更新UI显示，不等待硬件确认
   * 4. 硬件端通过以下方式同步：
   *    - 方式A：定期查询待执行指令（每5秒）
   *    - 方式B：上传状态时触发强制同步
   * 5. 无论硬件当前是什么状态，最终都必须与服务器锁定状态一致
   */
  const toggleState = async (actuatorId: string, currentState: 'on' | 'off') => {
    const newState = currentState === 'on' ? 'off' : 'on'
    
    setUpdating(actuatorId)
    
    // 立即更新前端UI（乐观更新），锁定用户期望的状态
    setActuators(prev => 
      prev.map(a => 
        a.id === actuatorId 
          ? { ...a, state: newState, last_update: new Date().toISOString() }
          : a
      )
    )
    
    // 设置超时机制：如果硬件端在10秒内没有确认执行，自动取消锁定
    const timeoutId = setTimeout(async () => {
      try {
        // 发送解锁请求
        const response = await fetch(`/api/actuators/${actuatorId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locked: 0,
            trigger_source: 'timeout',
          }),
        })
        
        const result = await response.json()
        if (result.success) {
          console.log(`[ActuatorControl] 超时自动解锁 - ID: ${actuatorId}`)
          // 重新获取执行器状态
          fetchActuators()
        }
      } catch (error) {
        console.error('[ActuatorControl] 超时解锁失败:', error)
      }
    }, 10000) // 10秒超时
    
    try {
      // 步骤1：更新服务器执行器状态（锁定为用户期望的状态）
      console.log(`[ActuatorControl] 用户操作 - ID: ${actuatorId}, 锁定状态: ${newState}`)
      
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
        console.log(`[ActuatorControl] 服务器状态已锁定 - ID: ${actuatorId}, 状态: ${newState}`)
        console.log(`[ActuatorControl] 等待硬件同步服务器锁定状态...`)
      } else {
        // 服务器操作失败，回滚前端UI
        console.error(`[ActuatorControl] 服务器操作失败:`, result.error)
        setActuators(prev => 
          prev.map(a => 
            a.id === actuatorId 
              ? { ...a, state: currentState }
              : a
          )
        )
        alert('操作失败: ' + result.error)
      }
    } catch (error) {
      // 网络错误，回滚前端UI
      console.error('[ActuatorControl] 网络错误:', error)
      setActuators(prev => 
        prev.map(a => 
          a.id === actuatorId 
            ? { ...a, state: currentState }
            : a
        )
      )
      alert('操作失败，请检查网络连接')
    } finally {
      // 清除超时
      clearTimeout(timeoutId)
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  /**
   * 查看设备详情
   */
  const viewDeviceDetails = (actuatorId: string) => {
    alert(`查看设备 ${actuatorId} 的详细信息`)
    setActiveMenu(null)
  }

  /**
   * 部署设备策略
   */
  const deployDevicePolicy = (actuatorId: string) => {
    setSelectedActuatorId(actuatorId)
    setEditingStrategy(null)
    setShowStrategyModal(true)
    setActiveMenu(null)
  }

  /**
   * 添加策略
   */
  const addStrategy = async (strategy: Omit<Strategy, 'id' | 'created_at'>) => {
    try {
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(strategy),
      })
      const result = await response.json()
      
      if (result.success) {
        await fetchStrategies()
        setShowStrategyModal(false)
        alert('策略添加成功')
      } else {
        alert(`策略添加失败: ${result.message}`)
      }
    } catch (error) {
      console.error('添加策略失败:', error)
      alert('策略添加失败，请稍后重试')
    }
  }

  /**
   * 更新策略
   */
  const updateStrategy = async (strategyId: string, updatedStrategy: Omit<Strategy, 'id' | 'created_at'>) => {
    try {
      const response = await fetch(`/api/strategies/${strategyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedStrategy),
      })
      const result = await response.json()
      
      if (result.success) {
        await fetchStrategies()
        setShowStrategyModal(false)
        setEditingStrategy(null)
        alert('策略更新成功')
      } else {
        alert(`策略更新失败: ${result.message}`)
      }
    } catch (error) {
      console.error('更新策略失败:', error)
      alert('策略更新失败，请稍后重试')
    }
  }

  /**
   * 删除策略
   */
  const deleteStrategy = async (strategyId: string) => {
    if (!confirm('确定要删除此策略吗？')) {
      return
    }
    
    try {
      const response = await fetch(`/api/strategies/${strategyId}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      
      if (result.success) {
        await fetchStrategies()
        alert('策略删除成功')
      } else {
        alert(`策略删除失败: ${result.message}`)
      }
    } catch (error) {
      console.error('删除策略失败:', error)
      alert('策略删除失败，请稍后重试')
    }
  }

  /**
   * 切换策略启用状态
   */
  const toggleStrategyEnabled = async (strategyId: string) => {
    try {
      const strategy = strategies.find(s => s.id === strategyId)
      if (!strategy) return
      
      const response = await fetch(`/api/strategies/${strategyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !strategy.enabled }),
      })
      const result = await response.json()
      
      if (result.success) {
        await fetchStrategies()
      } else {
        alert(`切换策略状态失败: ${result.message}`)
      }
    } catch (error) {
      console.error('切换策略状态失败:', error)
      alert('切换策略状态失败，请稍后重试')
    }
  }

  /**
   * 还原设备
   */
  const restoreDevice = async (actuator: Actuator) => {
    if (!confirm(`确定要还原设备 "${actuator.name}" 吗？`)) {
      return
    }
    
    try {
      // 由于我们的删除功能只是从界面上移除，实际数据还在数据库中
      // 所以还原操作只需要从已删除列表中移除，并添加回执行器列表
      setActuators(prev => [...prev, actuator])
      setDeletedActuators(prev => prev.filter(a => a.id !== actuator.id))
      alert('设备还原成功')
    } catch (error) {
      console.error('还原设备失败:', error)
      alert('还原失败')
    }
  }

  /**
   * 删除设备
   */
  const deleteDevice = async (actuatorId: string, actuatorName: string) => {
    if (!confirm(`确定要删除设备 "${actuatorName}" 吗？`)) {
      return
    }
    
    setUpdating(actuatorId)
    
    try {
      // 找到要删除的设备
      const deletedActuator = actuators.find(a => a.id === actuatorId)
      if (deletedActuator) {
        // 将删除的设备添加到已删除列表
        setDeletedActuators(prev => [...prev, deletedActuator])
        // 从界面上移除设备卡片
        setActuators(prev => prev.filter(a => a.id !== actuatorId))
        setActiveMenu(null)
        alert('设备已从界面移除，可通过"还原设备"功能恢复')
      }
    } catch (error) {
      console.error('删除设备失败:', error)
      alert('删除失败')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <>
      <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              执行器状态
            </CardTitle>
            <CardDescription>
              实时监控和控制农业设备（每2秒自动刷新）
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>{lastUpdate ? lastUpdate.toLocaleTimeString('zh-CN') : ''}</span>
            </div>
            {deletedActuators.length > 0 && (
              <Button 
                onClick={() => {
                  // 打开还原设备模态框
                  setShowRestoreModal(true)
                }} 
                size="sm" 
                variant="secondary"
              >
                <Undo2 className="w-4 h-4 mr-2" />
                还原设备
              </Button>
            )}
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
              <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-accent/10 border border-accent/30">
                <span className="text-3xl font-bold text-accent-foreground">{onCount}</span>
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
                const isLocked = actuator.locked === 1
                
                return (
                  <Card
                    key={actuator.id}
                    className={`
                      bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200
                      ${isUpdating ? 'opacity-75' : ''}
                    `}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-3">
                        <DropdownMenu open={activeMenu === actuator.id} onOpenChange={(open) => setActiveMenu(open ? actuator.id : null)}>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => viewDeviceDetails(actuator.id)}>
                              设备详情
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deployDevicePolicy(actuator.id)}>
                              部署该设备策略
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteDevice(actuator.id, actuator.name)} className="text-destructive">
                              删除该设备
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {actuator.name}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`
                            p-2.5 rounded-lg transition-all duration-300
                            ${isOn 
                              ? 'bg-accent/30 shadow-lg shadow-accent/30' 
                              : 'bg-muted'
                            }
                          `}>
                            <Icon className={`
                              w-5 h-5 transition-all duration-300
                              ${isOn 
                                ? 'text-accent-foreground animate-pulse' 
                                : 'text-muted-foreground'
                              }
                            `} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              {isOnline ? (
                                <Badge className="bg-primary/20 text-primary text-xs border border-primary/30">
                                  在线
                                </Badge>
                              ) : (
                                <Badge className="bg-destructive/20 text-destructive text-xs border border-destructive/30">
                                  离线
                                </Badge>
                              )}
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
                            
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{actuator.location}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                              <RefreshCw className="w-3 h-3" />
                              <span suppressHydrationWarning>{formattedTimes[actuator.id] || '计算中...'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => toggleState(actuator.id, actuator.state)}
                          disabled={!isOnline || isUpdating || isLocked}
                          className={`
                            relative w-14 h-14 rounded-xl transition-all duration-300
                            flex items-center justify-center
                            ${isOn 
                              ? 'bg-accent hover:bg-accent/90 shadow-lg shadow-accent/50' 
                              : 'bg-muted hover:bg-muted/80'
                            }
                            ${!isOnline || isUpdating || isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${isUpdating ? 'animate-pulse' : ''}
                            ${isLocked ? 'ring-2 ring-primary/30' : ''}
                          `}
                        >
                          {isUpdating ? (
                            <RefreshCw className="w-5 h-5 text-white animate-spin" />
                          ) : isLocked ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary">
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                          ) : isOn ? (
                            <Power className="w-6 h-6 text-white" />
                          ) : (
                            <PowerOff className="w-6 h-6 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      
                      {isOn && (
                        <div className="absolute top-3 right-3">
                          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                        </div>
                      )}

                      {/* 策略列表 */}
                      {strategies.filter(s => s.actuator_id === actuator.id).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-3 h-3 text-primary" />
                            <span className="text-xs font-medium text-muted-foreground">策略列表</span>
                          </div>
                          <div className="space-y-1">
                            {strategies
                              .filter(s => s.actuator_id === actuator.id)
                              .map(strategy => (
                                <div 
                                  key={strategy.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={`w-2 h-2 rounded-full ${strategy.enabled ? 'bg-primary' : 'bg-muted-foreground'}`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs truncate font-medium">{strategy.name}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {strategy.enabled ? '已启用' : '已禁用'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingStrategy(strategy)
                                        setSelectedActuatorId(actuator.id)
                                        setShowStrategyModal(true)
                                      }}
                                      className="p-1 rounded hover:bg-background transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => toggleStrategyEnabled(strategy.id)}
                                      className="p-1 rounded hover:bg-background transition-colors"
                                    >
                                      <div className={`w-3 h-3 rounded-full ${strategy.enabled ? 'bg-primary' : 'bg-muted-foreground'}`} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedStrategyId(strategy.id)
                                        fetchStrategyLogs(strategy.id, null)
                                        setShowLogModal(true)
                                      }}
                                      className="p-1 rounded hover:bg-background transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteStrategy(strategy.id)}
                                      className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                          
                          {/* 查看日志按钮 */}
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => {
                                setSelectedStrategyId(null)
                                fetchStrategyLogs(null, actuator.id)
                                setShowLogModal(true)
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              查看所有策略执行日志
                            </button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
    
    {/* 还原设备模态框 */}
    {showRestoreModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-4">还原设备</h3>
          <p className="text-muted-foreground mb-4">请选择要还原的设备：</p>
          <div className="space-y-2 mb-6">
            {deletedActuators.map((actuator) => (
              <button
                key={actuator.id}
                className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors flex justify-between items-center"
                onClick={() => {
                  restoreDevice(actuator)
                  setShowRestoreModal(false)
                }}
              >
                <span>{actuator.name}</span>
                <span className="text-sm text-muted-foreground">{actuator.id}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowRestoreModal(false)}
            >
              取消
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* 策略配置模态框 */}
    {showStrategyModal && (
      <StrategyModal
        actuator={actuators.find(a => a.id === selectedActuatorId)}
        editingStrategy={editingStrategy}
        onSave={(strategy) => {
          if (editingStrategy) {
            updateStrategy(editingStrategy.id, strategy)
          } else {
            addStrategy(strategy)
          }
        }}
        onCancel={() => {
          setShowStrategyModal(false)
          setEditingStrategy(null)
          setSelectedActuatorId(null)
        }}
      />
    )}

    {/* 策略执行日志模态框 */}
    {showLogModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">策略执行日志</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLogModal(false)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {strategyLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无执行日志
              </div>
            ) : (
              <div className="space-y-2">
                {strategyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className="text-sm font-medium">
                          {log.status === 'success' ? '执行成功' : log.status === 'failed' ? '执行失败' : '执行中'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.execution_time).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">策略ID:</span> {log.strategy_id}
                      </div>
                      <div>
                        <span className="text-muted-foreground">设备ID:</span> {log.actuator_id}
                      </div>
                      <div>
                        <span className="text-muted-foreground">动作:</span> {log.action === 'on' ? '开启' : '关闭'}
                      </div>
                    </div>
                    {log.error_message && (
                      <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                        错误信息: {log.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}

/**
 * 策略配置模态框组件
 */
function StrategyModal({ 
  actuator, 
  editingStrategy, 
  onSave, 
  onCancel 
}: { 
  actuator?: Actuator
  editingStrategy: Strategy | null
  onSave: (strategy: Omit<Strategy, 'id' | 'created_at'>) => void
  onCancel: () => void 
}) {
  const [sensorTypes, setSensorTypes] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: editingStrategy?.name || '',
    actuator_id: editingStrategy?.actuator_id || actuator?.id || '',
    enabled: editingStrategy?.enabled ?? true,
    trigger_condition: editingStrategy?.trigger_condition || {
      type: 'humidity' as const,
      operator: '<' as const,
      value: 30,
      unit: '%'
    },
    time_range: editingStrategy?.time_range || {
      start: '06:00',
      end: '10:00'
    },
    action: editingStrategy?.action || 'on' as const,
    stop_condition: editingStrategy?.stop_condition || {
      type: 'humidity' as const,
      value: 60,
      unit: '%'
    },
    safety_config: editingStrategy?.safety_config || {
      max_duration: 30,
      cooldown_time: 10
    }
  })

  /**
   * 获取传感器类型列表
   */
  useEffect(() => {
    const fetchSensorTypes = async () => {
      try {
        const response = await fetch('/api/sensors')
        const result = await response.json()
        
        if (result.success && result.data) {
          // 提取唯一的传感器类型，确保每个类型只有一个选项
          const uniqueTypes = result.data.reduce((acc: any[], sensor: any) => {
            const existing = acc.find(item => item.type === sensor.type)
            if (!existing) {
              acc.push({
                type: sensor.type,
                name: sensor.name,
                unit: sensor.unit
              })
            }
            return acc
          }, [])
          setSensorTypes(uniqueTypes)
          
          // 如果是新策略，设置默认传感器类型和单位
          if (!editingStrategy) {
            if (uniqueTypes.length > 0) {
              const defaultSensor = uniqueTypes[0]
              setFormData(prev => ({
                ...prev,
                trigger_condition: {
                  ...prev.trigger_condition,
                  type: defaultSensor.type,
                  unit: defaultSensor.unit
                },
                stop_condition: {
                  ...prev.stop_condition,
                  type: 'duration',
                  unit: '分钟'
                }
              }))
            }
          }
        }
      } catch (error) {
        console.error('获取传感器类型列表失败:', error)
      }
    }
    
    fetchSensorTypes()
  }, [editingStrategy])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {editingStrategy ? '编辑策略' : '添加策略'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">策略名称</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">启用</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="如：土壤湿度自动灌溉"
              required
            />
            <p className="text-xs text-muted-foreground">请输入一个描述性的策略名称，以便于识别。</p>
          </div>

          {/* 触发条件 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">触发条件</label>
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">传感器类型</label>
                  <select
                    value={formData.trigger_condition.type}
                    onChange={(e) => {
                      const selectedType = sensorTypes.find(st => st.type === e.target.value)
                      setFormData({ 
                        ...formData, 
                        trigger_condition: { 
                          ...formData.trigger_condition, 
                          type: e.target.value as any,
                          unit: selectedType?.unit || '%'
                        }
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                {sensorTypes.length === 0 ? (
                  <option value="">加载中...</option>
                ) : (
                  sensorTypes.map(sensorType => (
                    <option key={sensorType.type} value={sensorType.type}>
                      {sensorType.name}
                    </option>
                  ))
                )}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">操作符</label>
                  <select
                    value={formData.trigger_condition.operator}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      trigger_condition: { 
                        ...formData.trigger_condition, 
                        operator: e.target.value as any 
                      }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                <option value="<">&lt;</option>
                <option value="<=">&le;</option>
                <option value="=">=</option>
                <option value=">=">&ge;</option>
                <option value=">">&gt;</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">阈值</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.trigger_condition.value}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        trigger_condition: { 
                          ...formData.trigger_condition, 
                          value: parseFloat(e.target.value) 
                        }
                      })}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                    <span className="flex items-center px-3 py-2 rounded-lg border border-border bg-background">
                      {formData.trigger_condition.unit}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 时间段 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">有效时间段</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={formData.time_range.start}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  time_range: { 
                    ...formData.time_range, 
                    start: e.target.value 
                  }
                })}
                className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="time"
                value={formData.time_range.end}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  time_range: { 
                    ...formData.time_range, 
                    end: e.target.value 
                  }
                })}
                className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* 执行动作 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">执行动作</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, action: 'on' })}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  formData.action === 'on' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                开启设备
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, action: 'off' })}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  formData.action === 'off' 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                关闭设备
              </button>
            </div>
          </div>

          {/* 停止条件 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">停止条件</label>
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">条件类型</label>
                  <select
                    value={formData.stop_condition.type}
                    onChange={(e) => {
                      const selectedType = sensorTypes.find(st => st.type === e.target.value)
                      setFormData({ 
                        ...formData, 
                        stop_condition: { 
                          ...formData.stop_condition, 
                          type: e.target.value as any,
                          unit: e.target.value === 'duration' ? '分钟' : (selectedType?.unit || '%')
                        }
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="duration">运行时长</option>
                    {sensorTypes.length > 0 && sensorTypes.map(sensorType => (
                      <option key={sensorType.type} value={sensorType.type}>
                        {sensorType.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">阈值</label>
                  <input
                    type="number"
                    value={formData.stop_condition.value}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      stop_condition: { 
                        ...formData.stop_condition, 
                        value: parseFloat(e.target.value) 
                      }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">单位</label>
                  <select
                    value={formData.stop_condition.unit}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      stop_condition: { 
                        ...formData.stop_condition, 
                        unit: e.target.value 
                      }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {formData.stop_condition.type === 'duration' ? (
                      <option value="分钟">分钟</option>
                    ) : (
                      <>
                        {sensorTypes.length > 0 && sensorTypes
                          .filter(st => st.type === formData.stop_condition.type)
                          .map(sensorType => (
                            <option key={sensorType.type} value={sensorType.unit}>
                              {sensorType.unit}
                            </option>
                          ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 安全策略 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">安全策略</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">单次最长运行时间（分钟）</label>
                <input
                  type="number"
                  value={formData.safety_config.max_duration}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    safety_config: { 
                      ...formData.safety_config, 
                      max_duration: parseFloat(e.target.value) 
                    }
                  })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">关泵后冷却时间（分钟）</label>
                <input
                  type="number"
                  value={formData.safety_config.cooldown_time}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    safety_config: { 
                      ...formData.safety_config, 
                      cooldown_time: parseFloat(e.target.value) 
                    }
                  })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              取消
            </Button>
            <Button type="submit">
              {editingStrategy ? '更新策略' : '添加策略'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
