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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [updating, setUpdating] = useState<string | null>(null)
  const [formattedTimes, setFormattedTimes] = useState<Record<string, string>>({})
  const [showRestoreModal, setShowRestoreModal] = useState(false)

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
      }
    } catch (error) {
      console.error('获取执行器列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [deletedActuators])

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
    alert(`为设备 ${actuatorId} 部署策略`)
    setActiveMenu(null)
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
              <span>{lastUpdate.toLocaleTimeString('zh-CN')}</span>
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
    </>
  )
}
