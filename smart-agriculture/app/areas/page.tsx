"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { useFarm } from "@/lib/farm-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  RefreshCw,
  Menu,
  MapPin,
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  Wind,
  Flame,
  Lightbulb,
  CircleDot,
  Settings,
  RotateCw,
  AlertCircle,
  Wifi,
  Server,
  Power,
  PowerOff,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Network,
  Shield,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ActuatorCard, Actuator, CommandStatus } from "@/components/dashboard/actuator-card"
import { getDeviceTypeConfig, ControlType } from "@/lib/device-types"
import { useToast } from "@/hooks/use-toast"

/**
 * 传感器数据接口
 */
interface Sensor {
  id: string
  name: string
  type: string
  type_name: string
  location: string
  area?: string
  status: 'online' | 'offline'
  value?: number
  unit?: string
  battery?: number
  last_update: string | null
  signal_strength?: number
  firmware_version?: string
}

/**
 * 控制指令超时时间（秒）
 */
const COMMAND_TIMEOUT_SECONDS = 30

/**
 * 传感器图标映射
 */
const sensorIcons: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  light: Sun,
  soil_moisture: Leaf,
  soil_temperature: Thermometer,
  ph: Droplets,
  ec: Settings,
  co2: Wind,
  pm25: Sun,
  water_level: Droplets,
  battery: Settings,
  pressure: Network,
  vibration: Activity,
  altitude: Settings,
}

/**
 * WebSocket连接状态枚举
 */
type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * 区域视图页面
 * 按区域分组显示传感器和执行器设备
 * 根据IP地址自动划分区域，同一IP下的设备默认属于同一区域
 * 支持WebSocket实时通信，实现命令状态实时更新和区域数据推送
 */
export default function AreasPage() {
  const { selectedFarmId, farms } = useFarm()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("areas")
  const [currentTime, setCurrentTime] = useState<string>("")
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [actuators, setActuators] = useState<Actuator[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  
  // 指令状态映射：actuatorId -> CommandStatus
  const [commandStatusMap, setCommandStatusMap] = useState<Record<string, CommandStatus>>({})
  // 指令超时定时器映射
  const [timeoutTimers, setTimeoutTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({})
  // 展开/折叠状态映射
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({})
  
  // WebSocket连接状态
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null)

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
   * WebSocket连接管理
   * 建立实时通信连接，接收命令状态更新和区域数据推送
   */
  useEffect(() => {
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    const reconnectDelay = 3000
    const connectionTimeout = 5000 // 5秒连接超时
    let ws: WebSocket | null = null
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    
    // 构建WebSocket连接URL（始终连接到端口8080）
    const buildWsUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const hostname = window.location.hostname
      // WebSocket服务器始终运行在端口8080
      return `${protocol}//${hostname}:8080`
    }
    
    const connect = () => {
      const wsUrl = buildWsUrl()
      
      // 清理之前的超时定时器
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
        timeoutTimer = null
      }
      
      ws = new WebSocket(wsUrl)
      setWsStatus('connecting')
      setWsConnection(ws)
      
      console.log('[WebSocket] 正在连接:', wsUrl)
      
      // 设置连接超时
      timeoutTimer = setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
          console.warn('[WebSocket] 连接超时，关闭连接')
          ws.close(1006, '连接超时') // 1006表示异常关闭
        }
      }, connectionTimeout)
      
      // 连接成功
      ws.onopen = () => {
        // 清除超时定时器
        if (timeoutTimer) {
          clearTimeout(timeoutTimer)
          timeoutTimer = null
        }
        
        setWsStatus('connected')
        reconnectAttempts = 0
        console.log('[WebSocket] 连接成功')
        
        // 订阅所有区域
        getAllAreas().forEach(area => {
          ws?.send(JSON.stringify({
            type: 'area_sync',
            data: { area }
          }))
        })
      }
      
      // 接收消息
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          switch (message.type) {
            case 'command_status':
              // 命令状态更新
              handleCommandStatusUpdate(message.data)
              break
            case 'area_update':
              // 区域数据更新
              handleAreaUpdate(message.data)
              break
            case 'heartbeat_ack':
              // 心跳确认，无需处理
              break
            case 'welcome':
              // 欢迎消息
              console.log('[WebSocket] 收到欢迎消息:', message)
              break
            case 'error':
              console.error('[WebSocket] 错误:', message.message)
              break
            default:
              console.log('[WebSocket] 未知消息类型:', message.type)
          }
        } catch (error) {
          console.error('[WebSocket] 消息解析失败:', error)
        }
      }
      
      // 连接关闭（统一处理所有断开情况，包括错误）
      ws.onclose = (event) => {
        // 清除超时定时器
        if (timeoutTimer) {
          clearTimeout(timeoutTimer)
          timeoutTimer = null
        }
        
        setWsStatus('disconnected')
        console.log('[WebSocket] 连接关闭，代码:', event.code, '原因:', event.reason)
        
        // 自动重连（排除手动关闭的情况）
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          console.log(`[WebSocket] 尝试重连 (${reconnectAttempts}/${maxReconnectAttempts})`)
          setTimeout(connect, reconnectDelay * reconnectAttempts)
        } else if (event.code === 1000) {
          console.log('[WebSocket] 连接正常关闭')
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error('[WebSocket] 已达到最大重连次数，停止尝试')
        }
      }
      
      // 连接错误（仅记录日志，重连逻辑在onclose中统一处理）
      ws.onerror = (event) => {
        // WebSocket连接过程中可能短暂触发error事件但连接仍能成功建立
        // 只有在连接未成功时才记录错误
        if (ws?.readyState !== WebSocket.OPEN) {
          setWsStatus('error')
          console.warn('[WebSocket] 连接过程中发生错误:', event)
        }
        // 不在这里触发重连，等待onclose事件统一处理
      }
    }
    
    // 启动连接
    connect()
    
    // 清理函数
    return () => {
      // 清除超时定时器
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
      // 关闭WebSocket连接
      if (ws) {
        ws.close(1000, '页面卸载')
      }
      setWsConnection(null)
    }
  }, [])

  /**
   * 处理命令状态更新
   * 当收到硬件回执或命令超时通知时更新页面状态
   */
  const handleCommandStatusUpdate = (data: {
    actuator_id: string
    command_id: number
    status: string
    control_value?: number
    state?: string | null
  }) => {
    const { actuator_id, status, control_value, state } = data
    
    // 更新指令状态映射
    setCommandStatusMap(prev => ({
      ...prev,
      [actuator_id]: status as CommandStatus
    }))
    
    // 如果指令执行成功，更新执行器数据
    if (status === 'executed') {
      setActuators(prev => prev.map(actuator => {
        if (actuator.id === actuator_id) {
          const newState = (state as 'on' | 'off') || actuator.state
          return {
            ...actuator,
            state: newState,
            control_value: control_value ?? actuator.control_value,
            last_update: new Date().toISOString(),
          }
        }
        return actuator
      }))
      
      toast({
        title: '执行成功',
        description: '设备已成功执行控制指令',
        variant: 'default',
        duration: 3000,
      })
      
      // 3秒后清除指令状态
      setTimeout(() => {
        clearCommandStatus(actuator_id)
      }, 3000)
    } else if (status === 'failed') {
      toast({
        title: '执行失败',
        description: '设备执行指令失败，请重试',
        variant: 'destructive',
        duration: 3000,
      })
      
      setTimeout(() => {
        clearCommandStatus(actuator_id)
      }, 3000)
    } else if (status === 'timeout') {
      toast({
        title: '控制超时',
        description: '设备未在规定时间内响应，请检查网络连接',
        variant: 'destructive',
        duration: 5000,
      })
      
      setTimeout(() => {
        clearCommandStatus(actuator_id)
      }, 3000)
    }
    
    // 清除超时定时器
    if (timeoutTimers[actuator_id]) {
      clearTimeout(timeoutTimers[actuator_id])
      setTimeoutTimers(prev => {
        const newTimers = { ...prev }
        delete newTimers[actuator_id]
        return newTimers
      })
    }
  }

  /**
   * 处理区域数据更新
   * 当区域内设备状态变化时，刷新区域数据
   */
  const handleAreaUpdate = (data: {
    area: string
    sensors: number
    actuators: number
    timestamp: number
  }) => {
    console.log('[WebSocket] 区域数据更新:', data)
    // 触发数据刷新
    Promise.all([fetchSensors(), fetchActuators()]).then(() => {
      setLastUpdate(new Date())
    })
  }

  /**
   * 获取传感器列表
   */
  const fetchSensors = async () => {
    try {
      const url = selectedFarmId ? `/api/sensors?farm_id=${selectedFarmId}` : '/api/sensors'
      const response = await fetch(url)
      const result = await response.json()
      
      if (result.success && result.data) {
        setSensors(result.data)
      }
    } catch (error) {
      console.error('获取传感器列表失败:', error)
    }
  }

  /**
   * 获取执行器列表
   */
  const fetchActuators = async () => {
    try {
      const url = selectedFarmId ? `/api/actuators?farm_id=${selectedFarmId}` : '/api/actuators'
      const response = await fetch(url)
      const result = await response.json()
      
      if (result.success && result.data) {
        const formattedActuators: Actuator[] = result.data.map((actuator: any) => ({
          ...actuator,
          control_value: actuator.control_value !== null ? parseFloat(actuator.control_value) : undefined,
        }))
        setActuators(formattedActuators)
      }
    } catch (error) {
      console.error('获取执行器列表失败:', error)
    }
  }

  /**
   * 初始加载和定时刷新
   */
  useEffect(() => {
    setLoading(true)
    
    const fetchData = async () => {
      await Promise.all([fetchSensors(), fetchActuators()])
      setLoading(false)
      setLastUpdate(new Date())
    }
    
    fetchData()
    
    const interval = setInterval(fetchData, 10000)
    
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
    if (timeoutTimers[actuatorId]) {
      clearTimeout(timeoutTimers[actuatorId])
    }
    
    const timer = setTimeout(() => {
      setCommandStatusMap(prev => ({
        ...prev,
        [actuatorId]: 'timeout'
      }))
      
      toast({
        title: '控制超时',
        description: '设备未在规定时间内响应，请检查网络连接或重试',
        variant: 'destructive',
        duration: 5000,
      })
      
      setTimeout(() => {
        clearCommandStatus(actuatorId)
      }, 3000)
    }, COMMAND_TIMEOUT_SECONDS * 1000)
    
    setTimeoutTimers(prev => ({
      ...prev,
      [actuatorId]: timer
    }))
  }, [timeoutTimers, clearCommandStatus, toast])

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
      
      // 获取设备类型配置
      const deviceTypeConfig = getDeviceTypeConfig(actuator.type)
      
      // 优先使用数据库中存储的控制类型（硬件上报的配置），如果没有则使用设备类型字典中的配置
      const controlType = actuator.control_type || deviceTypeConfig?.controlType || ControlType.BOOLEAN
      
      // 对于布尔控制类型，确保command只能是on或off
      let finalCommand = command
      if ((controlType === 'boolean' || controlType === ControlType.BOOLEAN) && command === 'value') {
        // 如果是布尔控制但收到了value命令，转换为on/off
        finalCommand = value && value > 0 ? 'on' : 'off'
      }
      
      const body: any = {
        // 确保发送的是字符串类型，而不是枚举对象
        control_type: typeof controlType === 'string' ? controlType : 'boolean',
        command: finalCommand,
      }
      
      if (value !== undefined && (controlType === 'integer' || controlType === 'angle' || controlType === 'float')) {
        // 确保value是数字类型
        body.value = typeof value === 'number' ? value : parseFloat(value)
      }
      
      if (deviceTypeConfig?.controlRange) {
        body.min = deviceTypeConfig.controlRange.min
        body.max = deviceTypeConfig.controlRange.max
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
            const statusResponse = await fetch(`/api/actuators/${actuatorId}/commands?frontend=true`)
            const statusResult = await statusResponse.json()
            
            if (statusResult.success && statusResult.data) {
              const cmdStatus = statusResult.data.status
              if (cmdStatus === 'executed') {
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'executed'
                }))
                toast({
                  title: '执行成功',
                  description: '设备已成功执行控制指令',
                  variant: 'default',
                  duration: 3000,
                })
                clearInterval(pollInterval)
                await fetchActuators()
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              } else if (cmdStatus === 'failed') {
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'failed'
                }))
                toast({
                  title: '执行失败',
                  description: '设备执行指令失败，请重试',
                  variant: 'destructive',
                  duration: 3000,
                })
                clearInterval(pollInterval)
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              } else if (cmdStatus === 'timeout') {
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'timeout'
                }))
                toast({
                  title: '控制超时',
                  description: '设备未在规定时间内响应',
                  variant: 'destructive',
                  duration: 3000,
                })
                clearInterval(pollInterval)
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              }
            }
          } catch (error) {
            clearInterval(pollInterval)
          }
        }, 1500)
        
        // 设置轮询超时
        setTimeout(() => {
          clearInterval(pollInterval)
        }, COMMAND_TIMEOUT_SECONDS * 1000 + 2000)
        
      } else {
        setCommandStatusMap(prev => ({
          ...prev,
          [actuatorId]: 'failed'
        }))
        toast({
          title: '发送失败',
          description: result.error || '发送控制指令失败',
          variant: 'destructive',
          duration: 3000,
        })
        setTimeout(() => clearCommandStatus(actuatorId), 3000)
      }
    } catch (error) {
      console.error('发送控制指令失败:', error)
      setCommandStatusMap(prev => ({
        ...prev,
        [actuatorId]: 'failed'
      }))
      toast({
        title: '发送失败',
        description: '网络异常，发送控制指令失败',
        variant: 'destructive',
        duration: 3000,
      })
      setTimeout(() => clearCommandStatus(actuatorId), 3000)
    }
  }

  /**
   * 获取所有区域
   */
  const getAllAreas = () => {
    const areas = new Set<string>()
    areas.add('未分组')
    
    sensors.forEach(s => {
      if (s.area) areas.add(s.area)
    })
    
    actuators.forEach(a => {
      if (a.area) areas.add(a.area)
    })
    
    return Array.from(areas)
  }

  /**
   * 获取区域的传感器
   */
  const getSensorsByArea = (area: string) => {
    return sensors.filter(s => (s.area || '未分组') === area)
  }

  /**
   * 获取区域的执行器
   */
  const getActuatorsByArea = (area: string) => {
    return actuators.filter(a => (a.area || '未分组') === area)
  }

  /**
   * 获取区域统计信息
   */
  const getAreaStats = (area: string) => {
    const areaSensors = getSensorsByArea(area)
    const areaActuators = getActuatorsByArea(area)
    
    return {
      sensorCount: areaSensors.length,
      actuatorCount: areaActuators.length,
      sensorOnline: areaSensors.filter(s => s.status === 'online').length,
      actuatorOnline: areaActuators.filter(a => a.status === 'online').length,
      actuatorRunning: areaActuators.filter(a => a.state === 'on').length,
    }
  }

  /**
   * 获取传感器数值显示
   */
  const formatSensorValue = (sensor: Sensor) => {
    if (sensor.value === undefined || sensor.value === null) {
      return '--'
    }
    
    if (sensor.type === 'temperature' || sensor.type === 'humidity') {
      return sensor.value.toFixed(1)
    }
    
    return Math.round(sensor.value).toString()
  }

  /**
   * 获取区域颜色
   */
  const getAreaColor = (index: number) => {
    const colors = [
      { bg: 'bg-primary', text: 'text-primary', border: 'border-primary/20' },
      { bg: 'bg-blue', text: 'text-blue', border: 'border-blue/20' },
      { bg: 'bg-green', text: 'text-green', border: 'border-green/20' },
      { bg: 'bg-yellow', text: 'text-yellow', border: 'border-yellow/20' },
      { bg: 'bg-orange', text: 'text-orange', border: 'border-orange/20' },
      { bg: 'bg-purple', text: 'text-purple', border: 'border-purple/20' },
      { bg: 'bg-pink', text: 'text-pink', border: 'border-pink/20' },
      { bg: 'bg-cyan', text: 'text-cyan', border: 'border-cyan/20' },
    ]
    return colors[index % colors.length]
  }

  /**
   * 从区域名称中提取IP地址
   */
  const extractIpFromArea = (area: string) => {
    if (area.startsWith('区域-')) {
      return area.replace('区域-', '')
    }
    return null
  }

  /**
   * 切换区域展开状态
   */
  const toggleAreaExpand = (area: string) => {
    setExpandedAreas(prev => ({
      ...prev,
      [area]: !prev[area]
    }))
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 侧边栏 */}
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
          {/* 页面标题 */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">区域视图</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {farms.find(f => f.id === selectedFarmId)?.name || '未选择基地'} 
                · 共 {getAllAreas().length} 个区域
                · {sensors.length} 个传感器
                · {actuators.length} 个执行器
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                <RefreshCw className="w-3 h-3" />
                <span>最后更新: {lastUpdate?.toLocaleTimeString('zh-CN') || '--:--:--'}</span>
              </div>
              <Button 
                onClick={() => { 
                  setLoading(true)
                  Promise.all([fetchSensors(), fetchActuators()]).then(() => { 
                    setLoading(false)
                    setLastUpdate(new Date())
                  }) 
                }} 
                disabled={loading} 
                size="sm"
                className="h-9"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新数据
              </Button>
            </div>
          </div>

          {/* 控制流程说明 */}
          <div className="bg-gradient-to-r from-primary/5 via-blue/5 to-green/5 rounded-xl border border-border/50 p-4 md:p-5">
            <div className="flex items-center justify-center gap-1 md:gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <span className="text-muted-foreground">发送控制指令</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue/600 flex items-center justify-center shadow-sm">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <span className="text-muted-foreground">等待硬件回执</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green/600 flex items-center justify-center shadow-sm">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <span className="text-muted-foreground">更新页面状态</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange/600 flex items-center justify-center shadow-sm">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-muted-foreground">超时提醒 ({COMMAND_TIMEOUT_SECONDS}秒)</span>
              </div>
            </div>
          </div>

          {/* 加载状态 */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px]">
              <RefreshCw className="w-10 h-10 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">正在加载设备数据...</p>
            </div>
          ) : sensors.length === 0 && actuators.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
              <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">暂无设备</p>
              <p className="text-sm mt-1">系统中还没有配置设备</p>
              <p className="text-xs mt-2 text-muted-foreground/70">请等待硬件设备发送数据后自动注册</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 按区域分组显示 */}
              {getAllAreas().map((area, areaIndex) => {
                const stats = getAreaStats(area)
                const areaSensors = getSensorsByArea(area)
                const areaActuators = getActuatorsByArea(area)
                const colors = getAreaColor(areaIndex)
                const ipAddress = extractIpFromArea(area)
                const isExpanded = expandedAreas[area] !== false
                
                if (areaSensors.length === 0 && areaActuators.length === 0) {
                  return null
                }
                
                return (
                  <div key={area} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* 区域标题栏 - 可点击展开/折叠 */}
                    <button
                      onClick={() => toggleAreaExpand(area)}
                      className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.bg}/10`}>
                          <MapPin className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-foreground">{area}</h2>
                            {ipAddress && (
                              <Badge variant="outline" className={`text-xs ${colors.border} ${colors.text}/70`}>
                                <Network className="w-3 h-3 mr-1" />
                                {ipAddress}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {stats.sensorOnline}/{stats.sensorCount} 传感器在线 · 
                            {stats.actuatorOnline}/{stats.actuatorCount} 执行器在线 · 
                            {stats.actuatorRunning} 执行器运行中
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2">
                          {stats.sensorCount > 0 && (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                              <Wifi className="w-3 h-3 mr-1" />
                              {stats.sensorCount}传感器
                            </Badge>
                          )}
                          {stats.actuatorCount > 0 && (
                            <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                              <Settings className="w-3 h-3 mr-1" />
                              {stats.actuatorCount}执行器
                            </Badge>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* 区域内容 */}
                    {isExpanded && (
                      <div className="p-4 md:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* 传感器区域 */}
                          {areaSensors.length > 0 && (
                            <div className={`${areaActuators.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                              <Card className="bg-card/80 border-border/50">
                                <CardHeader className="pb-3 border-b border-border/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Wifi className="w-4 h-4 text-blue-600" />
                                      <CardTitle className="text-base font-medium">传感器数据</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {stats.sensorOnline}/{stats.sensorCount} 在线
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {areaSensors.map((sensor) => {
                                      const Icon = sensorIcons[sensor.type] || Thermometer
                                      const config = getDeviceTypeConfig(sensor.type)
                                      const isOnline = sensor.status === 'online'
                                      
                                      return (
                                        <div
                                          key={sensor.id}
                                          className={`p-3.5 rounded-lg border transition-all hover:shadow-sm ${
                                            isOnline 
                                              ? 'bg-blue-50/30 border-blue-100 hover:border-blue-200' 
                                              : 'bg-gray-50/30 border-gray-200 opacity-60'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between mb-2.5">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                              isOnline ? 'bg-blue-200/50 text-blue-700' : 'bg-gray-200/50 text-gray-500'
                                            }`}>
                                              <Icon className="h-4 w-4" />
                                            </div>
                                            <Badge variant={isOnline ? 'default' : 'secondary'} className="text-xs px-2 py-0.5">
                                              {isOnline ? '在线' : '离线'}
                                            </Badge>
                                          </div>
                                          <p className="text-xs font-medium text-foreground truncate mb-1">
                                            {sensor.name}
                                          </p>
                                          <p className="text-xs text-muted-foreground mb-2">
                                            {config?.name || sensor.type_name || sensor.type}
                                          </p>
                                          <div className="flex items-end justify-between">
                                            <div>
                                              <span className={`text-xl font-bold ${isOnline ? 'text-blue-600' : 'text-gray-400'}`}>
                                                {formatSensorValue(sensor)}
                                              </span>
                                              <span className="text-sm text-muted-foreground ml-1">
                                                {sensor.unit || config?.unit || ''}
                                              </span>
                                            </div>
                                            {sensor.battery !== undefined && (
                                              <div className={`flex items-center gap-1 text-xs ${
                                                sensor.battery >= 50 ? 'text-green-600' : 
                                                sensor.battery >= 20 ? 'text-yellow-600' : 'text-red-600'
                                              }`}>
                                                <Server className="w-3 h-3" />
                                                {sensor.battery}%
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}

                          {/* 执行器区域 */}
                          {areaActuators.length > 0 && (
                            <div className={`${areaSensors.length > 0 ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
                              <Card className="bg-card/80 border-border/50">
                                <CardHeader className="pb-3 border-b border-border/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Settings className="w-4 h-4 text-yellow-600" />
                                      <CardTitle className="text-base font-medium">执行器控制</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {stats.actuatorRunning} 运行中
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {areaActuators.map((actuator) => (
                                    <div key={actuator.id} className="bg-background/50 rounded-lg p-1">
                                      <ActuatorCard
                                        actuator={actuator}
                                        onControl={(command, value) => sendControlCommand(actuator.id, command, value)}
                                        commandStatus={commandStatusMap[actuator.id] || 'idle'}
                                        timeout={COMMAND_TIMEOUT_SECONDS}
                                      />
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 使用说明 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue/5 border border-blue/10">
              <div className="w-10 h-10 rounded-xl bg-blue/20 flex items-center justify-center flex-shrink-0">
                <Wifi className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">传感器数据</p>
                <p className="text-xs text-muted-foreground mt-1">
                  实时显示各区域传感器监测数据，支持温度、湿度、光照等多种类型
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow/5 border border-yellow/10">
              <div className="w-10 h-10 rounded-xl bg-yellow/20 flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">执行器控制</p>
                <p className="text-xs text-muted-foreground mt-1">
                  支持布尔值开关、数值调节、角度控制等多种控制方式，收到硬件回执后更新状态
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green/5 border border-green/10">
              <div className="w-10 h-10 rounded-xl bg-green/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">区域划分</p>
                <p className="text-xs text-muted-foreground mt-1">
                  基于IP地址自动划分区域，同一IP下的设备默认归为同一区域，支持手动展开/折叠
                </p>
              </div>
            </div>
          </div>

          {/* 安全提示 */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
            <Shield className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">安全提示</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                控制指令发送后需等待硬件回执确认才会更新页面状态。如未收到回执，系统将在{COMMAND_TIMEOUT_SECONDS}秒后提示超时。请确保网络连接正常。
              </p>
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