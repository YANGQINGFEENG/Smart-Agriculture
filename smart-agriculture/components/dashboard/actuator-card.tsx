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
  Volume2,
  Star,
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
  state: 'on' | 'off' | 'error'
  mode: 'auto' | 'manual'
  control_value?: number
  control_type?: string           // 执行器控制类型（boolean/integer/angle/float/string）
  control_min?: number            // 控制最小值
  control_max?: number            // 控制最大值
  control_step?: number           // 控制步进值
  control_default?: number        // 控制默认值
  last_update: string | null
  locked?: number
  feedback?: Record<string, any>  // 设备回馈数据（方向、速度、蜂鸣模式等）
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
  buzzer: Volume2,
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
 * 设备回馈信息显示组件
 * 根据设备类型显示特定的回馈信息
 */
function FeedbackDisplay({ actuator }: { actuator: Actuator }) {
  if (!actuator.feedback) return null
  
  const feedback = actuator.feedback
  const type = actuator.type
  
  // 风扇回馈信息
  if (type === 'fan') {
    return (
      <div className="flex flex-wrap gap-2 mt-2 p-2 rounded-lg bg-muted/30">
        {feedback.direction !== undefined && (
          <Badge variant="outline" className="text-xs">
            方向: {feedback.direction === 'forward' ? '正转' : feedback.direction === 'backward' ? '反转' : '停止'}
          </Badge>
        )}
        {feedback.speed !== undefined && (
          <Badge variant="outline" className="text-xs">
            速度: {(feedback.speed * 100).toFixed(0)}%
          </Badge>
        )}
        {feedback.initialized !== undefined && (
          <Badge variant="outline" className={`text-xs ${feedback.initialized ? 'text-green-600' : 'text-red-600'}`}>
            {feedback.initialized ? '已初始化' : '未初始化'}
          </Badge>
        )}
      </div>
    )
  }
  
  // 蜂鸣器回馈信息
  if (type === 'buzzer') {
    return (
      <div className="flex flex-wrap gap-2 mt-2 p-2 rounded-lg bg-muted/30">
        {feedback.pattern && (
          <Badge variant="outline" className="text-xs">
            模式: {feedback.pattern === 'alarm' ? '连续长响' : feedback.pattern === 'success' ? '短响3次' : feedback.pattern === 'warning' ? '长短交替' : '单次短响'}
          </Badge>
        )}
        {feedback.command_count !== undefined && (
          <Badge variant="outline" className="text-xs">
            命令: {feedback.command_count}次
          </Badge>
        )}
        {feedback.pin !== undefined && (
          <Badge variant="outline" className="text-xs">
            引脚: {feedback.pin}
          </Badge>
        )}
      </div>
    )
  }
  
  // 通用回馈信息显示
  return (
    <div className="flex flex-wrap gap-2 mt-2 p-2 rounded-lg bg-muted/30">
      {Object.entries(feedback).map(([key, value]) => (
        <Badge key={key} variant="outline" className="text-xs">
          {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </Badge>
      ))}
    </div>
  )
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
          
          {/* 设备回馈信息 */}
          <FeedbackDisplay actuator={actuator} />
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
          
          {/* 设备回馈信息 */}
          <FeedbackDisplay actuator={actuator} />
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
 * 支持三种命令格式：
 * 1. value命令 - 0-100 (0关闭, 1-9预设颜色, 10-100白色亮度)
 * 2. color命令 - 自定义RGB (r,g,b)
 * 3. preset命令 - 预设颜色名称 (red/green/blue等)
 */
export interface RGBCommand {
  command: 'value' | 'color' | 'preset'
  value?: number           // value命令: 0-100
  r?: number               // color命令: 红色 0-255
  g?: number               // color命令: 绿色 0-255
  b?: number               // color命令: 蓝色 0-255
  preset?: string          // preset命令: 颜色名称
}

// 预设颜色名称映射
const presetColorNames: Record<number, string> = {
  1: 'red',
  2: 'green',
  3: 'blue',
  4: 'yellow',
  5: 'cyan',
  6: 'magenta',
  7: 'white',
  8: 'orange',
  9: 'purple',
}

function RGBControlCard({ actuator, onControl, commandStatus, timeout }: {
  actuator: Actuator
  onControl: (cmd: RGBCommand) => void
  commandStatus: CommandStatus
  timeout: number
}) {
  const Icon = actuatorIcons[actuator.type] || Palette
  const isUpdating = commandStatus === 'sending' || commandStatus === 'pending'
  const isLocked = actuator.locked === 1
  const isOnline = actuator.status === 'online'
  
  // 获取当前状态 - 优先使用feedback中的颜色信息
  const feedbackColor = actuator.feedback?.color
  const feedbackBrightness = actuator.feedback?.brightness
  const feedbackState = actuator.feedback?.state
  
  // 当前颜色显示
  const currentR = feedbackColor?.r ?? 0
  const currentG = feedbackColor?.g ?? 0
  const currentB = feedbackColor?.b ?? 0
  const currentBrightness = feedbackBrightness ?? actuator.control_value ?? 0
  const currentState = feedbackState ?? actuator.state
  
  // 判断当前显示模式
  const isOff = currentState === 'off' || (currentR === 0 && currentG === 0 && currentB === 0 && currentBrightness === 0)
  
  // 计算当前颜色HEX
  const currentHex = `#${currentR.toString(16).padStart(2, '0')}${currentG.toString(16).padStart(2, '0')}${currentB.toString(16).padStart(2, '0')}`.toUpperCase()
  
  // 预设颜色列表（value 1-9）
  const presetColors = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(value => ({
    value,
    name: presetColorNames[value],
    color: valueToRgb(value),
  }))
  
  // 自定义RGB输入状态
  const [customR, setCustomR] = useState(0)
  const [customG, setCustomG] = useState(0)
  const [customB, setCustomB] = useState(0)

  /**
   * 处理预设颜色点击
   */
  const handlePresetColorClick = (value: number) => {
    onControl({ command: 'value', value })
  }

  /**
   * 处理白色亮度变化
   */
  const handleBrightnessChange = (value: number) => {
    if (value === 0) {
      onControl({ command: 'value', value: 0 }) // 关闭
    } else {
      onControl({ command: 'value', value }) // 白色亮度
    }
  }

  /**
   * 处理开关切换
   */
  const handleToggle = () => {
    if (isOff) {
      onControl({ command: 'value', value: 100 }) // 开启为100%白色
    } else {
      onControl({ command: 'value', value: 0 }) // 关闭
    }
  }

  /**
   * 发送自定义RGB颜色
   */
  const handleSendCustomRgb = () => {
    onControl({ 
      command: 'color', 
      r: customR, 
      g: customG, 
      b: customB 
    })
  }

  /**
   * 发送预设颜色名称
   */
  const handleSendPresetName = (preset: string) => {
    onControl({ command: 'preset', preset })
  }

  return (
    <Card key={actuator.id} className="bg-card/80 border-border hover:border-primary/30 transition-all duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${
              currentState === 'on' ? 'bg-chart-3/20' : 'bg-muted/50'
            }`}>
              <Icon className={`w-5 h-5 transition-colors ${
                currentState === 'on' ? 'text-chart-3' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{actuator.name}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {actuator.type_name} · {actuator.location}
                {actuator.area && ` · {actuator.area}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(actuator.status)}
            {currentState === 'on' && (
              <Badge className="bg-chart-3/20 text-chart-3 text-xs px-2 py-0.5">运行中</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 当前颜色预览 */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div 
              className={`w-14 h-14 rounded-xl border-2 shadow-inner transition-all ${
                isOff ? 'border-border' : 'border-primary/30'
              }`}
              style={{ backgroundColor: isOff ? 'transparent' : currentHex }}
            />
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isOff ? '已关闭' : currentBrightness >= 10 ? `亮度 ${currentBrightness}%` : presetColorNames[Math.round(currentBrightness)] || '自定义颜色'}
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {isOff ? '#000000' : currentHex}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant={!isOff ? 'destructive' : 'default'}
            onClick={handleToggle}
            disabled={!isOnline || isUpdating || isLocked}
            className="h-9 px-4"
          >
            {isUpdating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : !isOff ? (
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

        {/* 模式一：预设颜色选择 (value 1-9) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Palette className="w-3 h-3" />
              预设颜色
            </span>
            <span className="text-xs text-muted-foreground">value 1-9</span>
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {presetColors.map((color) => (
              <button
                key={color.value}
                onClick={() => handlePresetColorClick(color.value)}
                disabled={!isOnline || isUpdating || isLocked}
                className={`aspect-square rounded-lg transition-all hover:scale-110 relative ${
                  !isOnline || isUpdating || isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${color.value === 7 ? 'border border-border' : ''}`}
                style={{ backgroundColor: color.color.hex }}
                title={`${color.name} (value=${color.value})`}
              >
                {currentBrightness === color.value && !isOff && (
                  <CheckCircle className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 模式二：白色亮度 (value 10-100) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" />
              白色亮度
            </span>
            <span className="text-xs text-primary font-semibold">
              {currentBrightness >= 10 && !isOff ? `${currentBrightness}%` : '—'}
            </span>
          </div>
          <Slider
            value={[Math.max(10, currentBrightness)]}
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

        {/* 模式三：自定义RGB (color命令) */}
        <div className="space-y-2 p-3 bg-muted/20 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Palette className="w-3 h-3" />
              自定义 RGB 颜色
            </span>
            <span className="text-xs text-muted-foreground">color 命令</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* R通道 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  R
                </span>
                <span className="font-mono">{customR}</span>
              </div>
              <Slider
                value={[customR]}
                onValueChange={([v]) => setCustomR(v)}
                min={0}
                max={255}
                step={1}
                disabled={!isOnline || isUpdating || isLocked}
                className="py-1"
              />
            </div>
            {/* G通道 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  G
                </span>
                <span className="font-mono">{customG}</span>
              </div>
              <Slider
                value={[customG]}
                onValueChange={([v]) => setCustomG(v)}
                min={0}
                max={255}
                step={1}
                disabled={!isOnline || isUpdating || isLocked}
                className="py-1"
              />
            </div>
            {/* B通道 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  B
                </span>
                <span className="font-mono">{customB}</span>
              </div>
              <Slider
                value={[customB]}
                onValueChange={([v]) => setCustomB(v)}
                min={0}
                max={255}
                step={1}
                disabled={!isOnline || isUpdating || isLocked}
                className="py-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-10 h-10 rounded-lg border border-border"
              style={{ backgroundColor: `#${customR.toString(16).padStart(2,'0')}${customG.toString(16).padStart(2,'0')}${customB.toString(16).padStart(2,'0')}` }}
            />
            <Button
              size="sm"
              onClick={handleSendCustomRgb}
              disabled={!isOnline || isUpdating || isLocked}
              className="flex-1 h-8"
            >
              发送自定义颜色
            </Button>
          </div>
        </div>

        {/* 模式四：预设颜色名称 (preset命令) */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Star className="w-3 h-3" />
            颜色名称快捷指令
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(presetColorNames).map(([value, name]) => (
              <button
                key={value}
                onClick={() => handleSendPresetName(name)}
                disabled={!isOnline || isUpdating || isLocked}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all hover:scale-105 ${
                  !isOnline || isUpdating || isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  currentBrightness === Number(value) && !isOff
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* 当前状态信息 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
            <span className="text-muted-foreground">状态</span>
            <span className={currentState === 'on' ? 'text-green-600 font-medium' : 'text-gray-500'}>
              {isOff ? 'off' : 'on'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
            <span className="text-muted-foreground">亮度</span>
            <span className="font-mono font-medium">{currentBrightness}%</span>
          </div>
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
            <span className="text-muted-foreground">RGB</span>
            <span className="font-mono text-[10px]">{currentR},{currentG},{currentB}</span>
          </div>
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
            <span className="text-muted-foreground">HEX</span>
            <span className="font-mono text-[10px]">{isOff ? '#000000' : currentHex}</span>
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
          
          {/* 设备回馈信息 */}
          <FeedbackDisplay actuator={actuator} />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 执行器控制卡片组件
 * 根据执行器类型自动选择对应的控制方式
 * 
 * onControl 支持两种格式：
 * 1. 标准格式: onControl(command: 'on' | 'off' | 'value', value?: number)
 * 2. RGB格式: onControl(cmd: RGBCommand) - 用于RGB-LED设备
 */
export function ActuatorCard({ actuator, onControl, commandStatus, timeout }: {
  actuator: Actuator
  onControl: (command: 'on' | 'off' | 'value' | RGBCommand, value?: number) => void
  commandStatus: CommandStatus
  timeout: number
}) {
  const controlConfig = getControlConfig(actuator)

  // RGB-LED识别逻辑：
  // 1. 类型是 rgb_led
  // 2. 或者类型是 light 且 feedback 包含 color 字段（真实 RGB-LED 设备）
  const isRgbLed = actuator.type === 'rgb_led' || 
    (actuator.type === 'light' && actuator.feedback && 
     (actuator.feedback.color || 
      ('R' in actuator.feedback && 'G' in actuator.feedback && 'B' in actuator.feedback)))

  if (isRgbLed) {
    return (
      <RGBControlCard
        actuator={actuator}
        onControl={(cmd) => onControl(cmd)}
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