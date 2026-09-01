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
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
 * 在线状态判断阈值（分钟）
 */
const ONLINE_THRESHOLD_MINUTES = 5

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
  // 当前等待回执的命令ID映射：actuatorId -> commandId
  const [pendingCommandIds, setPendingCommandIds] = useState<Record<string, number>>({})
  // 展开/折叠状态映射
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({})

  // WebSocket连接状态
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null)

  // 区域管理相关状态
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDeviceDeleteDialog, setShowDeviceDeleteDialog] = useState(false)
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [deletingArea, setDeletingArea] = useState<string | null>(null)
  const [deletingDevice, setDeletingDevice] = useState<{ type: 'sensor' | 'actuator'; id: string; name: string } | null>(null)
  const [createForm, setCreateForm] = useState({ name: '' })
  const [editForm, setEditForm] = useState({ name: '' })

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
   * 包含 feedback 数据，确保手势控制/追踪等状态实时同步
   * 
   * 重要：gyro/track/color/reset 等命令不改变 actuator.state，
   * 前端仅更新 feedback，避免错误覆盖 state 导致视频流消失等问题
   */
  const handleCommandStatusUpdate = (data: {
    actuator_id: string
    command_id: number
    command?: string                 // 命令类型，用于判断是否更新 state
    status: string
    control_value?: number
    state?: string | null
    feedback?: Record<string, any>  // 硬件上报的实时状态（手势控制/追踪等）
  }) => {
    const { actuator_id, command_id, command, status, control_value, state, feedback } = data

    // 不改变 state 的命令列表（摄像头子命令等）
    const noStateChangeCommands = ['track', 'color', 'reset', 'gyro']
    const shouldUpdateState = command ? !noStateChangeCommands.includes(command) : true

    // 检查命令ID是否匹配当前正在等待的命令
    const expectedCommandId = pendingCommandIds[actuator_id]
    if (expectedCommandId !== undefined && command_id !== expectedCommandId) {
      console.log(`[WS] 命令ID不匹配，跳过更新: 期望=${expectedCommandId}, 收到=${command_id}`)
      return
    }

    // 更新指令状态映射
    setCommandStatusMap(prev => ({
      ...prev,
      [actuator_id]: status as CommandStatus
    }))

    // 清理等待的命令ID
    if (status === 'executed' || status === 'failed' || status === 'timeout') {
      setPendingCommandIds(prev => {
        const next = { ...prev }
        delete next[actuator_id]
        return next
      })
    }

    // 如果指令执行成功，更新执行器数据（含 feedback 同步）
    if (status === 'executed') {
      setActuators(prev => prev.map(actuator => {
        if (actuator.id === actuator_id) {
          // gyro/track 等命令：只更新 feedback，不改变 state
          const newState = shouldUpdateState
            ? ((state as 'on' | 'off') || actuator.state)
            : actuator.state
          // 合并 feedback 数据，确保手势控制/追踪等状态立即同步到 UI
          const mergedFeedback = feedback
            ? { ...actuator.feedback, ...feedback }
            : actuator.feedback
          return {
            ...actuator,
            state: newState,
            control_value: control_value ?? actuator.control_value,
            last_update: new Date().toISOString(),
            feedback: mergedFeedback,
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

      // 延迟刷新完整数据，避免与当前 feedback 合并产生竞态
      // gyro/track 等命令仅需 feedback 同步，不需要全量刷新
      if (shouldUpdateState) {
        setTimeout(() => fetchActuators(), 2000)
      }

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

      // 清理等待回执的命令ID
      setPendingCommandIds(prev => {
        const next = { ...prev }
        delete next[actuatorId]
        return next
      })

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
  const sendControlCommand = async (actuatorId: string, command: any, value?: number) => {
    // 设置指令状态为发送中
    setCommandStatusMap(prev => ({
      ...prev,
      [actuatorId]: 'sending'
    }))

    try {
      const actuator = actuators.find(a => a.id === actuatorId)
      if (!actuator) return

      // 判断命令格式：
      // 1. 如果已经包含 control_type 字段，说明已经是完整的 API 请求体，直接使用
      // 2. 如果是 RGBCommand 格式（包含 command 字段但没有 control_type），需要转换
      // 3. 否则是标准命令格式（字符串 'on'/'off'/'value'）
      const isAlreadyFormatted = typeof command === 'object' && command !== null && 'control_type' in command
      const isRgbCommand = typeof command === 'object' && command !== null && 'command' in command && !('control_type' in command)

      // 调试日志：确认前端代码版本和命令类型
      console.log('[sendControlCommand] actuatorId:', actuatorId, 'command:', command, 'isAlreadyFormatted:', isAlreadyFormatted, 'isRgbCommand:', isRgbCommand)

      let body: any

      if (isAlreadyFormatted) {
        // 已经是完整的 API 请求体格式，直接使用
        body = command
      } else if (isRgbCommand) {
        // RGB 命令格式: { command: 'value'|'color'|'preset', value?, r?, g?, b?, preset? }
        const rgbCmd = command
        body = {
          control_type: 'rgb',
          command: rgbCmd.command,
        }

        // 根据命令类型添加参数
        if (rgbCmd.command === 'value' && rgbCmd.value !== undefined) {
          body.value = rgbCmd.value
        } else if (rgbCmd.command === 'color') {
          body.r = rgbCmd.r || 0
          body.g = rgbCmd.g || 0
          body.b = rgbCmd.b || 0
        } else if (rgbCmd.command === 'preset') {
          body.preset = rgbCmd.preset
        }
      } else {
        // 标准命令格式: ('on' | 'off' | 'value', value?)
        const strCommand = command as 'on' | 'off' | 'value'

        // 获取设备类型配置
        const deviceTypeConfig = getDeviceTypeConfig(actuator.type)
        const controlType = actuator.control_type || deviceTypeConfig?.controlType || ControlType.BOOLEAN

        // 对于布尔控制类型，确保command只能是on或off
        let finalCommand = strCommand
        if ((controlType === 'boolean' || controlType === ControlType.BOOLEAN) && strCommand === 'value') {
          finalCommand = value && value > 0 ? 'on' : 'off'
        }

        body = {
          control_type: typeof controlType === 'string' ? controlType : 'boolean',
          command: finalCommand,
        }

        if (value !== undefined && (controlType === 'integer' || controlType === 'angle' || controlType === 'float')) {
          body.value = typeof value === 'number' ? value : parseFloat(value)
        }

        if (deviceTypeConfig?.controlRange) {
          body.min = deviceTypeConfig.controlRange.min
          body.max = deviceTypeConfig.controlRange.max
        }
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
        const commandId = result.data.id

        // 设置指令状态为等待执行，并保存命令ID
        setCommandStatusMap(prev => ({
          ...prev,
          [actuatorId]: 'pending'
        }))
        setPendingCommandIds(prev => ({
          ...prev,
          [actuatorId]: commandId
        }))

        // 设置超时定时器
        setupTimeoutTimer(actuatorId)

        // 轮询检查指令执行状态（检查特定命令ID，避免状态混淆）
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/actuators/${actuatorId}/commands?frontend=true`)
            const statusResult = await statusResponse.json()

            if (statusResult.success && statusResult.data) {
              const cmdData = statusResult.data

              // 只检查我们刚才发送的命令，避免检测到其他命令的状态
              if (cmdData.id !== commandId) {
                // 不是我们的命令，跳过继续轮询
                return
              }

              const cmdStatus = cmdData.status
              if (cmdStatus === 'executed') {
                // 立即更新本地状态，不等待API响应
                setCommandStatusMap(prev => ({
                  ...prev,
                  [actuatorId]: 'executed'
                }))

                // 不改变 state 的命令列表（摄像头子命令等）
                // 这些命令只影响 feedback，不改变 actuator.state，轮询路径也不应触发全量刷新
                const noStateChangeCommands = ['track', 'color', 'reset', 'gyro']
                const shouldUpdateState = !noStateChangeCommands.includes(cmdData.command)

                // gyro/track 等命令：跳过 setActuators，避免创建新对象引用导致 MJPEG 重连
                if (shouldUpdateState) {
                  setActuators(prev => prev.map(a => {
                    if (a.id === actuatorId) {
                      const newState = cmdData.command === 'off' ? 'off' :
                        cmdData.command === 'on' ? 'on' : a.state
                      return {
                        ...a,
                        state: newState as 'on' | 'off',
                        control_value: cmdData.control_value ? parseFloat(cmdData.control_value) : a.control_value,
                        last_update: new Date().toISOString(),
                      }
                    }
                    return a
                  }))
                }

                toast({
                  title: '执行成功',
                  description: '设备已成功执行控制指令',
                  variant: 'default',
                  duration: 3000,
                })
                clearInterval(pollInterval)
                setPendingCommandIds(prev => {
                  const next = { ...prev }
                  delete next[actuatorId]
                  return next
                })
                // 异步刷新服务器数据：gyro/track 等命令仅需 feedback 同步，跳过全量刷新避免竞态
                if (shouldUpdateState) {
                  setTimeout(() => fetchActuators(), 2000)
                }
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
                setPendingCommandIds(prev => {
                  const next = { ...prev }
                  delete next[actuatorId]
                  return next
                })
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
                setPendingCommandIds(prev => {
                  const next = { ...prev }
                  delete next[actuatorId]
                  return next
                })
                setTimeout(() => clearCommandStatus(actuatorId), 3000)
              }
            }
          } catch (error) {
            clearInterval(pollInterval)
          }
        }, 300)  // 优化：300ms轮询间隔，快速响应状态更新

          // 立即执行第一次轮询，减少初始延时
          ;(async () => {
            try {
              const statusResponse = await fetch(`/api/actuators/${actuatorId}/commands?frontend=true`)
              const statusResult = await statusResponse.json()
              if (statusResult.success && statusResult.data) {
                const cmdData = statusResult.data

                // 命令ID验证：确保只处理当前发送的命令，避免获取到旧命令状态
                if (cmdData.id !== commandId) {
                  // 不是当前命令，跳过，等待定期轮询处理
                  return
                }

                const cmdStatus = cmdData.status
                if (cmdStatus === 'executed') {
                  // 立即更新本地状态
                  setCommandStatusMap(prev => ({
                    ...prev,
                    [actuatorId]: 'executed'
                  }))

                  // 不改变 state 的命令列表（摄像头子命令等）
                  const noStateChangeCommands = ['track', 'color', 'reset', 'gyro']
                  const shouldUpdateState = !noStateChangeCommands.includes(cmdData.command)

                  // 乐观更新执行器状态
                  const executedData = statusResult.data
                  if (shouldUpdateState) {
                    setActuators(prev => prev.map(a => {
                      if (a.id === actuatorId) {
                        const newState = executedData.command === 'off' ? 'off' :
                          executedData.command === 'on' ? 'on' : a.state
                        return {
                          ...a,
                          state: newState as 'on' | 'off',
                          control_value: executedData.control_value ? parseFloat(executedData.control_value) : a.control_value,
                          last_update: new Date().toISOString(),
                        }
                      }
                      return a
                    }))
                  }

                  toast({
                    title: '执行成功',
                    description: '设备已成功执行控制指令',
                    variant: 'default',
                    duration: 3000,
                  })
                  clearInterval(pollInterval)
                  // gyro/track 等命令：跳过全量刷新，避免不必要的重渲染导致 MJPEG 连接中断
                  if (shouldUpdateState) {
                    fetchActuators()
                  }
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
              // 忽略错误，继续轮询
            }
          })()

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
   * 判断设备是否在线
   * 结合设备状态和最后更新时间综合判断
   */
  const isDeviceOnline = (device: { status: string; last_update: string | null }): boolean => {
    if (device.status !== 'online') return false
    if (!device.last_update) return false

    const lastUpdateDate = new Date(device.last_update)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - lastUpdateDate.getTime()) / 1000 / 60)

    return diffMinutes <= ONLINE_THRESHOLD_MINUTES
  }

  /**
   * 获取区域统计信息
   */
  const getAreaStats = (area: string) => {
    const areaSensors = getSensorsByArea(area)
    const areaActuators = getActuatorsByArea(area)

    const sensorOnline = areaSensors.filter(s => isDeviceOnline(s)).length
    const actuatorOnline = areaActuators.filter(a => isDeviceOnline(a)).length

    return {
      sensorCount: areaSensors.length,
      actuatorCount: areaActuators.length,
      sensorOnline,
      actuatorOnline,
      isOnline: sensorOnline > 0 || actuatorOnline > 0,
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

  /**
   * 打开新建区域对话框
   */
  const openCreateDialog = () => {
    setCreateForm({ name: '' })
    setShowCreateDialog(true)
  }

  /**
   * 关闭新建区域对话框
   */
  const closeCreateDialog = () => {
    setShowCreateDialog(false)
    setCreateForm({ name: '' })
  }

  /**
   * 创建区域
   */
  const createArea = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: '输入无效',
        description: '区域名称不能为空',
        variant: 'destructive',
      })
      return
    }

    const areaName = createForm.name.trim()

    // 检查名称是否已存在
    if (getAllAreas().includes(areaName)) {
      toast({
        title: '名称已存在',
        description: '该区域名称已存在，请使用其他名称',
        variant: 'destructive',
      })
      return
    }

    closeCreateDialog()
    toast({
      title: '创建成功',
      description: `区域 "${areaName}" 已创建`,
    })
  }

  /**
   * 打开编辑区域对话框
   */
  const openEditDialog = (area: string) => {
    setEditingArea(area)
    setEditForm({ name: area })
    setShowEditDialog(true)
  }

  /**
   * 关闭编辑区域对话框
   */
  const closeEditDialog = () => {
    setShowEditDialog(false)
    setEditingArea(null)
    setEditForm({ name: '' })
  }

  /**
   * 保存区域编辑
   */
  const saveAreaEdit = async () => {
    if (!editingArea || !editForm.name.trim()) {
      toast({
        title: '输入无效',
        description: '区域名称不能为空',
        variant: 'destructive',
      })
      return
    }

    const newName = editForm.name.trim()

    // 如果名称没有变化，直接关闭
    if (newName === editingArea) {
      closeEditDialog()
      return
    }

    // 检查新名称是否已存在
    if (getAllAreas().includes(newName)) {
      toast({
        title: '名称已存在',
        description: '该区域名称已存在，请使用其他名称',
        variant: 'destructive',
      })
      return
    }

    try {
      // 更新传感器的区域
      const areaSensors = getSensorsByArea(editingArea)
      for (const sensor of areaSensors) {
        await fetch(`/api/sensors/${sensor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: newName }),
        })
      }

      // 更新执行器的区域
      const areaActuators = getActuatorsByArea(editingArea)
      for (const actuator of areaActuators) {
        await fetch(`/api/actuators/${actuator.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: newName }),
        })
      }

      // 刷新数据
      await Promise.all([fetchSensors(), fetchActuators()])

      toast({
        title: '编辑成功',
        description: `区域已重命名为 "${newName}"`,
      })
    } catch (error) {
      toast({
        title: '编辑失败',
        description: '更新区域信息时发生错误',
        variant: 'destructive',
      })
    }

    closeEditDialog()
  }

  /**
   * 打开删除区域对话框
   */
  const openDeleteDialog = (area: string) => {
    console.log('openDeleteDialog called with area:', area)
    setDeletingArea(area)
    setShowDeleteDialog(true)
  }

  /**
   * 关闭删除区域对话框
   */
  const closeDeleteDialog = () => {
    setShowDeleteDialog(false)
    setDeletingArea(null)
  }

  /**
   * 删除区域（将区域内设备移到"未分组"）
   */
  const deleteArea = async () => {
    console.log('deleteArea called, deletingArea:', deletingArea)
    if (!deletingArea) return

    try {
      // 将区域内设备移到"未分组"
      const areaSensors = getSensorsByArea(deletingArea)
      console.log('Sensors in area:', areaSensors.length)
      const sensorPromises = areaSensors.map(sensor =>
        fetch(`/api/sensors/${sensor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: null }),
        })
      )
      await Promise.all(sensorPromises)

      const areaActuators = getActuatorsByArea(deletingArea)
      console.log('Actuators in area:', areaActuators.length)
      const actuatorPromises = areaActuators.map(actuator =>
        fetch(`/api/actuators/${actuator.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: null }),
        })
      )
      await Promise.all(actuatorPromises)

      // 刷新数据
      await Promise.all([fetchSensors(), fetchActuators()])

      toast({
        title: '删除成功',
        description: '区域已删除，设备已移到未分组',
      })
    } catch (error) {
      console.error('删除区域失败:', error)
      toast({
        title: '删除失败',
        description: '删除区域时发生错误',
        variant: 'destructive',
      })
    }

    closeDeleteDialog()
  }

  /**
   * 打开设备删除确认对话框
   */
  const openDeviceDeleteDialog = (type: 'sensor' | 'actuator', id: string, name: string) => {
    setDeletingDevice({ type, id, name })
    setShowDeviceDeleteDialog(true)
  }

  /**
   * 关闭设备删除确认对话框
   */
  const closeDeviceDeleteDialog = () => {
    setShowDeviceDeleteDialog(false)
    setDeletingDevice(null)
  }

  /**
   * 确认删除设备
   */
  const confirmDeleteDevice = async () => {
    if (!deletingDevice) return

    const { type, id, name } = deletingDevice

    try {
      const response = await fetch(`/api/${type}s/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除失败')
      }

      // 刷新数据
      if (type === 'sensor') {
        await fetchSensors()
      } else {
        await fetchActuators()
      }

      toast({
        title: '删除成功',
        description: `${type === 'sensor' ? '传感器' : '执行器'} "${name}" 已删除`,
      })
    } catch (error) {
      console.error('删除设备失败:', error)
      toast({
        title: '删除失败',
        description: '删除设备时发生错误',
        variant: 'destructive',
      })
    }

    closeDeviceDeleteDialog()
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
              <Button
                onClick={openCreateDialog}
                size="sm"
                className="h-9"
              >
                <Plus className="w-4 h-4 mr-2" />
                新建区域
              </Button>
            </div>
          </div>

          {/* 全局在线状态统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* 在线设备总数 */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-700 font-medium">在线设备</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">
                      {actuators.filter(a => isDeviceOnline(a)).length}
                      <span className="text-sm font-normal text-green-600 ml-1">/ {actuators.length}</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 运行中执行器 */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">运行中</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">
                      {actuators.filter(a => a.state === 'on').length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Power className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 离线设备 */}
            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">离线设备</p>
                    <p className="text-2xl font-bold text-gray-600 mt-1">
                      {actuators.filter(a => !isDeviceOnline(a)).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 区域数量 */}
            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-700 font-medium">在线区域</p>
                    <p className="text-2xl font-bold text-purple-700 mt-1">
                      {getAllAreas().filter(area => {
                        const stats = getAreaStats(area);
                        return stats.isOnline;
                      }).length}
                      <span className="text-sm font-normal text-purple-600 ml-1">/ {getAllAreas().length}</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
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
                  <div key={area} className={`bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${stats.isOnline ? 'border-green-200/50' : 'border-gray-200/50'
                    }`}>
                    {/* 区域标题栏 - 可点击展开/折叠 */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.bg}/10 relative`}>
                          <MapPin className={`w-5 h-5 ${colors.text}`} />
                          {/* 在线状态指示器 */}
                          <div className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${stats.isOnline ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
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
                            {/* 区域在线状态标签 */}
                            <Badge variant={stats.isOnline ? 'default' : 'secondary'} className={`text-xs ${stats.isOnline ? 'bg-green-100 text-green-700 border-green-200' : ''
                              }`}>
                              {stats.isOnline ? '在线' : '离线'}
                            </Badge>
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
                        {/* 编辑和删除按钮 */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); openEditDialog(area) }}
                            title="编辑区域"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {area !== '未分组' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); openDeleteDialog(area) }}
                              title="删除区域"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <button
                          onClick={() => toggleAreaExpand(area)}
                          className="p-1 hover:bg-muted/50 rounded-md transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>

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
                                      const deviceOnline = isDeviceOnline(sensor)

                                      return (
                                        <div
                                          key={sensor.id}
                                          className={`p-3.5 rounded-lg border transition-all hover:shadow-sm ${deviceOnline
                                            ? 'bg-blue-50/30 border-blue-100 hover:border-blue-200'
                                            : 'bg-gray-50/30 border-gray-200 opacity-60'
                                            }`}
                                        >
                                          <div className="flex items-center justify-between mb-2.5">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${deviceOnline ? 'bg-blue-200/50 text-blue-700' : 'bg-gray-200/50 text-gray-500'
                                              }`}>
                                              <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Badge variant={deviceOnline ? 'default' : 'secondary'} className="text-xs px-2 py-0.5">
                                                {deviceOnline ? '在线' : '离线'}
                                              </Badge>
                                              {!deviceOnline && (
                                                <button
                                                  onClick={() => openDeviceDeleteDialog('sensor', sensor.id, sensor.name)}
                                                  className="p-1 hover:bg-red-100 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                                                  title="删除设备"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <p className="text-xs font-medium text-foreground truncate mb-1">
                                            {sensor.name}
                                          </p>
                                          <p className="text-xs text-muted-foreground mb-2">
                                            {config?.name || sensor.type_name || sensor.type}
                                          </p>
                                          <div className="flex items-end justify-between">
                                            <div>
                                              <span className={`text-xl font-bold ${deviceOnline ? 'text-blue-600' : 'text-gray-400'}`}>
                                                {formatSensorValue(sensor)}
                                              </span>
                                              <span className="text-sm text-muted-foreground ml-1">
                                                {sensor.unit || config?.unit || ''}
                                              </span>
                                            </div>
                                            {sensor.battery !== undefined && (
                                              <div className={`flex items-center gap-1 text-xs ${sensor.battery >= 50 ? 'text-green-600' :
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
                                  {areaActuators.map((actuator) => {
                                    const actuatorOnline = isDeviceOnline(actuator)
                                    return (
                                      <div key={actuator.id} className="bg-background/50 rounded-lg p-1">
                                        <div className="relative">
                                          <ActuatorCard
                                            actuator={actuator}
                                            onControl={(command, value) => sendControlCommand(actuator.id, command, value)}
                                            commandStatus={commandStatusMap[actuator.id] || 'idle'}
                                            timeout={COMMAND_TIMEOUT_SECONDS}
                                          />
                                          {!actuatorOnline && (
                                            <button
                                              onClick={() => openDeviceDeleteDialog('actuator', actuator.id, actuator.name)}
                                              className="absolute top-2 right-2 p-1.5 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors z-10"
                                              title="删除设备"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
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

      {/* 新建区域对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={closeCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建区域</DialogTitle>
            <DialogDescription>
              创建一个新的区域，用于分组管理设备
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">区域名称</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ name: e.target.value })}
                placeholder="请输入区域名称"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} type="button">取消</Button>
            <Button onClick={createArea} type="button">创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑区域对话框 */}
      <Dialog open={showEditDialog} onOpenChange={closeEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑区域</DialogTitle>
            <DialogDescription>
              修改区域名称，区域内所有设备将自动更新归属
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">区域名称</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ name: e.target.value })}
                placeholder="请输入区域名称"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} type="button">取消</Button>
            <Button onClick={saveAreaEdit} type="button">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除区域对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={closeDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除区域</DialogTitle>
            <DialogDescription>
              删除区域后，该区域内所有设备将被移至"未分组"。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              即将删除区域：<span className="font-medium text-foreground">{deletingArea}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} type="button">取消</Button>
            <Button variant="destructive" onClick={deleteArea} type="button">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除设备对话框 */}
      <Dialog open={showDeviceDeleteDialog} onOpenChange={closeDeviceDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除设备</DialogTitle>
            <DialogDescription>
              删除设备后，所有关联数据将被永久删除。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              即将删除：<span className="font-medium text-foreground">{deletingDevice?.name}</span>
              <span className="text-muted-foreground ml-2">({deletingDevice?.type === 'sensor' ? '传感器' : '执行器'})</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeviceDeleteDialog} type="button">取消</Button>
            <Button variant="destructive" onClick={confirmDeleteDevice} type="button">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}