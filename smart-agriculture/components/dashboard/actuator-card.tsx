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
  Crosshair,
  Palette,
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
  relay: Zap,
  laser: Crosshair,
  rgb_led: Palette,
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
 * RGB颜色值映射规则（0-100）
 * 0 → 关闭（熄灭所有颜色）
 * 1 → 红色 (1.0, 0.0, 0.0)
 * 2 → 绿色 (0.0, 1.0, 0.0)
 * 3 → 蓝色 (0.0, 0.0, 1.0)
 * 4 → 黄色 (1.0, 1.0, 0.0)
 * 5 → 青色 (0.0, 1.0, 1.0)
 * 6 → 品红色 (1.0, 0.0, 1.0)
 * 7 → 白色 (1.0, 1.0, 1.0)
 * 8 → 橙色 (1.0, 0.5, 0.0)
 * 9 → 紫色 (0.5, 0.0, 1.0)
 * 10-100 → 白色亮度（百分比亮度）
 */
const rgbColorMap: Record<number, { name: string; r: number; g: number; b: number }> = {
  0: { name: '关闭', r: 0, g: 0, b: 0 },
  1: { name: '红色', r: 255, g: 0, b: 0 },
  2: { name: '绿色', r: 0, g: 255, b: 0 },
  3: { name: '蓝色', r: 0, g: 0, b: 255 },
  4: { name: '黄色', r: 255, g: 255, b: 0 },
  5: { name: '青色', r: 0, g: 255, b: 255 },
  6: { name: '品红', r: 255, g: 0, b: 255 },
  7: { name: '白色', r: 255, g: 255, b: 255 },
  8: { name: '橙色', r: 255, g: 128, b: 0 },
  9: { name: '紫色', r: 128, g: 0, b: 255 },
}

/**
 * 将数值(0-100)转换为RGB颜色对象
 */
const valueToRgb = (value: number): { name: string; r: number; g: number; b: number; hex: string } => {
  // 颜色值 0-9
  if (rgbColorMap[value]) {
    const color = rgbColorMap[value]
    return { ...color, hex: `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`.toUpperCase() }
  }
  // 亮度值 10-100（白色亮度百分比）
  const brightness = Math.min(100, Math.max(0, value))
  const level = Math.round((brightness / 100) * 255)
  return {
    name: `${brightness}%`,
    r: level,
    g: level,
    b: level,
    hex: `#${level.toString(16).padStart(2, '0')}${level.toString(16).padStart(2, '0')}${level.toString(16).padStart(2, '0')}`.toUpperCase(),
  }
}

/**
 * RGB颜色控制卡片（RGB-LED等）
 * 控制值范围：0-100
 */
function RGBControlCard({ actuator, onValueChange, commandStatus, timeout }: {
  actuator: Actuator
  onValueChange: (value: number) => void
  commandStatus: CommandStatus
  timeout: number
}) {
  const Icon = actuatorIcons[actuator.type] || Palette
  const isUpdating = commandStatus === 'sending' || commandStatus === 'pending'
  const isLocked = actuator.locked === 1
  const isOnline = actuator.status === 'online'
  
  // 获取当前颜色信息
  const currentValue = actuator.control_value || 0
  const currentColor = valueToRgb(currentValue)
  
  // 颜色选择列表（值1-9）
  const colorOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => ({
    value,
    ...valueToRgb(value),
  }))

  const handleColorClick = (value: number) => {
    onValueChange(value)
  }

  const handleBrightnessChange = (value: number) => {
    onValueChange(value)
  }

  const handleToggle = () => {
    if (currentValue === 0) {
      onValueChange(100) // 开启为100%亮度白色
    } else {
      onValueChange(0) // 关闭
    }
  }

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
        {/* 当前颜色预览 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">当前状态</span>
            <div 
              className="w-12 h-12 rounded-xl border-2 border-border shadow-inner transition-colors"
              style={{ backgroundColor: currentColor.hex }}
            />
            <div>
              <span className="text-lg font-bold text-primary">
                {currentColor.name}
              </span>
              <div className="text-xs text-muted-foreground">
                值: {currentValue}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant={actuator.state === 'on' ? 'destructive' : 'default'}
            onClick={handleToggle}
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

        {/* 颜色选择 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Palette className="w-3 h-3" />
            选择颜色
          </div>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorClick(color.value)}
                disabled={!isOnline || isUpdating || isLocked}
                className={`w-10 h-10 rounded-xl transition-all hover:scale-110 ${
                  currentValue === color.value ? 'ring-2 ring-primary ring-offset-2' : ''
                } ${!isOnline || isUpdating || isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${
                  color.value === 7 ? 'border border-border' : '' // 白色加边框
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {currentValue === color.value && (
                  <CheckCircle className="w-5 h-5 text-white drop-shadow-md" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 亮度调节 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              白色亮度
            </span>
            <span className="font-medium text-primary">
              {currentValue >= 10 ? `${currentValue}%` : '—'}
            </span>
          </div>
          <Slider
            value={[Math.max(10, currentValue)]}
            onValueChange={([value]) => handleBrightnessChange(value)}
            min={10}
            max={100}
            step={5}
            disabled={!isOnline || isUpdating || isLocked}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* RGB分量显示 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            R: {currentColor.r}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            G: {currentColor.g}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            B: {currentColor.b}
          </span>
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

  // RGB-LED特殊处理
  if (actuator.type === 'rgb_led') {
    return (
      <RGBControlCard
        actuator={actuator}
        onValueChange={(value) => onControl('value', value)}
        commandStatus={commandStatus}
        timeout={timeout}
      />
    )
  }

  // 布尔值控制（LED开关、继电器、水泵、激光器等）
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