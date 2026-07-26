"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Power,
  PowerOff,
  Droplets,
  Wind,
  Flame,
  Lightbulb,
  CircleDot,
  Settings,
  RotateCw,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Fan,
  Gauge,
  Zap,
} from "lucide-react"
import { ControlType, getDeviceTypeConfig } from "@/lib/device-types"

/**
 * 执行器数据接口
 * 支持从数据库获取控制类型和控制范围配置
 */
export interface Actuator {
  id: string
  name: string
  type: string
  type_name: string
  description: string
  location: string
  area?: string
  status: 'online' | 'offline'
  state: 'on' | 'off'
  mode: 'auto' | 'manual'
  control_value?: number
  control_type?: string           // 执行器控制类型（boolean/integer/angle/float/string）
  control_min?: number            // 控制最小值
  control_max?: number            // 控制最大值
  control_step?: number           // 控制步进值
  control_default?: number        // 控制默认值
  last_update: string | null
  locked?: number
}

/**
 * 指令状态枚举
 */
export type CommandStatus = 'idle' | 'sending' | 'pending' | 'executed' | 'failed' | 'timeout'

/**
 * 执行器图标映射
 */
const actuatorIcons: Record<string, typeof Power> = {
  water_pump: Droplets,
  fan: Wind,
  heater: Flame,
  valve: CircleDot,
  light: Lightbulb,
  ventilator: Fan,
  fogger: CircleDot,
  motor: Settings,
  servo: RotateCw,
  led: Lightbulb,
}

/**
 * 根据执行器获取控制类型配置
 * 优先使用数据库中的控制类型和控制范围配置，如果没有则使用设备类型字典中的配置
 * 支持硬件上报的控制类型自动加载对应控制卡片
 */
function getControlConfig(actuator: Actuator) {
  // 优先使用数据库中的控制类型和控制范围配置（硬件上报的配置）
  if (actuator.control_type) {
    return {
      type: actuator.control_type as ControlType,
      range: {
        min: actuator.control_min ?? 0,
        max: actuator.control_max ?? 100,
        step: actuator.control_step ?? 1,
        default: actuator.control_default ?? 0,
      },
    }
  }
  
  // 使用设备类型字典中的配置
  const config = getDeviceTypeConfig(actuator.type)
  if (!config || !config.controlType) {
    return {
      type: ControlType.BOOLEAN,
      range: { min: 0, max: 100, step: 1, default: 0 },
    }
  }
  return {
    type: config.controlType,
    range: config.controlRange || { min: 0, max: 100, step: 1, default: 0 },
  }
}

/**
 * 获取状态徽章样式
 */
function getStatusBadge(status: string) {
  if (status === 'online') {
    return <Badge className="bg-primary/20 text-primary text-xs px-2 py-0.5">在线</Badge>
  }
  return <Badge className="bg-destructive/20 text-destructive text-xs px-2 py-0.5">离线</Badge>
}

/**
 * 获取开关状态徽章
 */
function getStateBadge(state: string) {
  if (state === 'on') {
    return <Badge className="bg-chart-3/20 text-chart-3 text-xs px-2 py-0.5">运行中</Badge>
  }
  return <Badge className="bg-muted text-muted-foreground text-xs px-2 py-0.5">停止</Badge>
}

/**
 * 格式化最后更新时间
 */
function formatLastUpdate(timestamp: string | null) {
  if (!timestamp) return '从未更新'

  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60)

  if (diff < 1) return '刚刚'
  if (diff < 60) return `${diff}分钟前`
  if (diff < 1440) return `${Math.floor(diff / 60)}小时前`
  return date.toLocaleString('zh-CN')
}

/**
 * 布尔值控制卡片（LED开关、继电器、水泵等）
 */
function BooleanControlCard({ actuator, onToggle, commandStatus, timeout }: {
  actuator: Actuator
  onToggle: (newState: 'on' | 'off') => void
  commandStatus: CommandStatus
  timeout: number
}) {
  const Icon = actuatorIcons[actuator.type] || Power
  const isUpdating = commandStatus === 'sending' || commandStatus === 'pending'
  const isLocked = actuator.locked === 1
  const isOnline = actuator.status === 'online'

  return (
    <Card key={actuator.id} className="bg-card/80 border-border hover:border-primary/30 transition-all duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${
              actuator.state === 'on' ? 'bg-chart-3/20' : 'bg-muted/50'
            }`}>
              <Icon className={`w-5 h-5 transition-colors ${
                actuator.state === 'on' ? 'text-chart-3' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{actuator.name}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {actuator.type_name} · {actuator.location}
                {actuator.area && ` · ${actuator.area}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(actuator.status)}
            {actuator.locked === 1 && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs px-2 py-0.5">
                <Clock className="w-3 h-3 mr-1" />
                控制中
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 开关控制 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">状态</span>
            {getStateBadge(actuator.state)}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Switch
                checked={actuator.state === 'on'}
                onCheckedChange={(checked) => onToggle(checked ? 'on' : 'off')}
                disabled={!isOnline || isUpdating || isLocked}
                className="data-[state=checked]:bg-chart-3"
              />
              {!isOnline && (
                <div className="absolute inset-0 bg-black/20 rounded-lg pointer-events-none" />
              )}
            </div>
            <Button
              size="sm"
              variant={actuator.state === 'on' ? 'destructive' : 'default'}
              onClick={() => onToggle(actuator.state === 'on' ? 'off' : 'on')}
              disabled={!isOnline || isUpdating || isLocked}
              className="h-9 px-4 transition-all"
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
        </div>

        {/* 指令状态提示 */}
        {commandStatus !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
            commandStatus === 'executed' ? 'bg-green-50 border border-green-100' :
            commandStatus === 'failed' || commandStatus === 'timeout' ? 'bg-red-50 border border-red-100' :
            commandStatus === 'pending' ? 'bg-yellow-50 border border-yellow-100' : 'bg-blue-50 border border-blue-100'
          }`}>
            {commandStatus === 'sending' && (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-primary">正在发送指令...</span>
              </>
            )}
            {commandStatus === 'pending' && (
              <>
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-yellow-700">等待硬件回执 ({timeout}秒)</span>
              </>
            )}
            {commandStatus === 'executed' && (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700">指令执行成功</span>
              </>
            )}
            {commandStatus === 'failed' && (
              <>
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">指令执行失败</span>
              </>
            )}
            {commandStatus === 'timeout' && (
              <>
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-700">控制超时，请重试</span>
              </>
            )}
          </div>
        )}

        {/* 底部信息 */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              控制模式
            </span>
            <span className={actuator.mode === 'auto' ? 'text-green-600 font-medium' : 'text-blue-600 font-medium'}>
              {actuator.mode === 'auto' ? '自动' : '手动'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>最后更新</span>
            <span>{formatLastUpdate(actuator.last_update)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 数值控制卡片（电机速度、亮度调节、舵机角度等）
 */
function NumericControlCard({ actuator, onValueChange, commandStatus, timeout }: {
  actuator: Actuator
  onValueChange: (value: number) => void
  commandStatus: CommandStatus
  timeout: number
}) {
  const Icon = actuatorIcons[actuator.type] || Settings
  const controlConfig = getControlConfig(actuator)
  const [inputValue, setInputValue] = useState(String(actuator.control_value || controlConfig.range.default))
  const isUpdating = commandStatus === 'sending' || commandStatus === 'pending'
  const isLocked = actuator.locked === 1
  const isOnline = actuator.status === 'online'

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0]
    setInputValue(String(newValue))
    onValueChange(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    if (!isNaN(newValue) && newValue >= controlConfig.range.min && newValue <= controlConfig.range.max) {
      setInputValue(String(newValue))
    }
  }

  const handleInputBlur = () => {
    const newValue = parseFloat(inputValue)
    if (!isNaN(newValue)) {
      const clampedValue = Math.max(controlConfig.range.min, Math.min(controlConfig.range.max, newValue))
      if (clampedValue !== (actuator.control_value || 0)) {
        onValueChange(clampedValue)
      }
    }
  }

  // 当控制值变化时更新输入框
  useEffect(() => {
    if (actuator.control_value !== undefined) {
      setInputValue(String(actuator.control_value))
    }
  }, [actuator.control_value])

  const unitLabel = controlConfig.type === ControlType.ANGLE ? '度' : '%'
  const unitSymbol = controlConfig.type === ControlType.ANGLE ? '°' : '%'

  return (
    <Card key={actuator.id} className="bg-card/80 border-border hover:border-primary/30 transition-all duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${
              actuator.state === 'on' ? 'bg-chart-3/20' : 'bg-muted/50'
            }`}>
              <Icon className={`w-5 h-5 transition-colors ${
                actuator.state === 'on' ? 'text-chart-3' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{actuator.name}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {actuator.type_name} · {actuator.location}
                {actuator.area && ` · ${actuator.area}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(actuator.status)}
            {actuator.state === 'on' && (
              <Badge className="bg-chart-3/20 text-chart-3 text-xs px-2 py-0.5">运行中</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 当前值显示 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">当前值</span>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-primary">
                {actuator.control_value || 0}
              </span>
              <span className="text-sm text-muted-foreground">
                {unitSymbol}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant={actuator.state === 'on' ? 'destructive' : 'default'}
            onClick={() => onValueChange(actuator.state === 'on' ? 0 : controlConfig.range.default)}
            disabled={!isOnline || isUpdating || isLocked}
            className="h-9 px-4 transition-all"
          >
            {isUpdating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : actuator.state === 'on' ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                停止
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                启动
              </>
            )}
          </Button>
        </div>

        {/* 滑块控制 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              {controlConfig.type === ControlType.ANGLE ? '角度调节' : '速度/强度调节'}
            </span>
            <span>
              {controlConfig.range.min} - {controlConfig.range.max} {unitSymbol}
            </span>
          </div>
          <Slider
            value={[actuator.control_value || controlConfig.range.default]}
            onValueChange={handleSliderChange}
            min={controlConfig.range.min}
            max={controlConfig.range.max}
            step={controlConfig.range.step}
            disabled={!isOnline || isUpdating || isLocked}
            className="w-full"
          />
        </div>

        {/* 输入框控制 */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground w-16">输入值</Label>
          <Input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            min={controlConfig.range.min}
            max={controlConfig.range.max}
            step={controlConfig.range.step}
            disabled={!isOnline || isUpdating || isLocked}
            className="flex-1 h-9"
          />
          <span className="text-sm text-muted-foreground w-8">{unitLabel}</span>
        </div>

        {/* 快捷按钮 */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onValueChange(controlConfig.range.min)}
            disabled={!isOnline || isUpdating || isLocked}
            className="h-8 px-3"
          >
            最小
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onValueChange(controlConfig.range.default)}
            disabled={!isOnline || isUpdating || isLocked}
            className="h-8 px-3"
          >
            默认
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onValueChange(controlConfig.range.max)}
            disabled={!isOnline || isUpdating || isLocked}
            className="h-8 px-3"
          >
            最大
          </Button>
        </div>

        {/* 指令状态提示 */}
        {commandStatus !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
            commandStatus === 'executed' ? 'bg-green-50 border border-green-100' :
            commandStatus === 'failed' || commandStatus === 'timeout' ? 'bg-red-50 border border-red-100' :
            commandStatus === 'pending' ? 'bg-yellow-50 border border-yellow-100' : 'bg-blue-50 border border-blue-100'
          }`}>
            {commandStatus === 'sending' && (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-primary">正在发送指令...</span>
              </>
            )}
            {commandStatus === 'pending' && (
              <>
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-yellow-700">等待硬件回执 ({timeout}秒)</span>
              </>
            )}
            {commandStatus === 'executed' && (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-700">指令执行成功</span>
              </>
            )}
            {commandStatus === 'failed' && (
              <>
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">指令执行失败</span>
              </>
            )}
            {commandStatus === 'timeout' && (
              <>
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-orange-700">控制超时，请重试</span>
              </>
            )}
          </div>
        )}

        {/* 底部信息 */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              控制模式
            </span>
            <span className={actuator.mode === 'auto' ? 'text-green-600 font-medium' : 'text-blue-600 font-medium'}>
              {actuator.mode === 'auto' ? '自动' : '手动'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>最后更新</span>
            <span>{formatLastUpdate(actuator.last_update)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 执行器控制卡片组件
 * 根据执行器类型自动选择对应的控制方式
 */
export function ActuatorCard({ actuator, onControl, commandStatus, timeout }: {
  actuator: Actuator
  onControl: (command: 'on' | 'off' | 'value', value?: number) => void
  commandStatus: CommandStatus
  timeout: number
}) {
  const controlConfig = getControlConfig(actuator)

  // 布尔值控制（LED开关、继电器、水泵等）
  if (controlConfig.type === ControlType.BOOLEAN) {
    return (
      <BooleanControlCard
        actuator={actuator}
        onToggle={(newState) => onControl(newState)}
        commandStatus={commandStatus}
        timeout={timeout}
      />
    )
  }

  // 数值控制（电机速度、舵机角度、亮度等）
  if (
    controlConfig.type === ControlType.INTEGER ||
    controlConfig.type === ControlType.ANGLE ||
    controlConfig.type === ControlType.FLOAT
  ) {
    return (
      <NumericControlCard
        actuator={actuator}
        onValueChange={(value) => onControl('value', value)}
        commandStatus={commandStatus}
        timeout={timeout}
      />
    )
  }

  // 默认使用布尔值控制
  return (
    <BooleanControlCard
      actuator={actuator}
      onToggle={(newState) => onControl(newState)}
      commandStatus={commandStatus}
      timeout={timeout}
    />
  )
}