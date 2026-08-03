"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Camera,
  Video,
  VideoOff,
  Power,
  PowerOff,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Crosshair,
  Navigation,
  Eye,
  Palette,
  Zap,
  RotateCcw,
  Activity,
} from "lucide-react"
import { Actuator, CommandStatus } from "./actuator-card"

/**
 * 摄像头控制卡片组件
 * 提供以下功能：
 * 1. MJPEG 实时视频流显示
 * 2. 云台控制（pan/tilt 角度调节、方向按钮、复位）
 * 3. 颜色追踪开关
 * 4. 追踪颜色切换
 * 5. 摄像头开启/关闭
 *
 * 命令格式：
 * - on/off：开启/关闭摄像头
 * - value：设置云台角度 {pan, tilt} 或增量 {pan_delta, tilt_delta}
 * - track：跟踪开关 on/off
 * - color：切换追踪颜色 red/blue/green/yellow/orange
 * - reset：云台复位到 90,90
 */

/** 支持的追踪颜色列表 */
const TRACK_COLORS = [
  { name: 'red', label: '红色', color: '#ef4444' },
  { name: 'blue', label: '蓝色', color: '#3b82f6' },
  { name: 'green', label: '绿色', color: '#22c55e' },
  { name: 'yellow', label: '黄色', color: '#eab308' },
  { name: 'orange', label: '橙色', color: '#f97316' },
]

/** 摄像头命令接口 */
export interface CameraCommand {
  control_type: 'camera'
  command: 'on' | 'off' | 'value' | 'track' | 'color' | 'reset'
  pan?: number
  tilt?: number
  pan_delta?: number
  tilt_delta?: number
  value?: any
  color?: string
}

/**
 * 摄像头控制卡片主组件
 */
export function CameraControlCard({
  actuator,
  onControl,
  commandStatus,
  timeout,
}: {
  actuator: Actuator
  onControl: (command: CameraCommand) => void
  commandStatus: CommandStatus
  timeout: number
}) {
  // 从 feedback 中获取摄像头状态信息
  const feedback = actuator.feedback || {}
  const streamUrl = feedback.stream_url || ''
  const snapshotUrl = feedback.snapshot_url || ''
  const trackingEnabled = feedback.tracking_enabled === true
  const found = feedback.found === true
  const currentColor = feedback.color_preset || ''
  const currentPan = feedback.pan_angle ?? 90
  const currentTilt = feedback.tilt_angle ?? 90

  // 本地状态：云台角度滑块
  const [panValue, setPanValue] = useState(currentPan)
  const [tiltValue, setTiltValue] = useState(currentTilt)
  // 本地状态：视频流是否加载中
  const [streamLoading, setStreamLoading] = useState(true)
  // 本地状态：视频流是否出错
  const [streamError, setStreamError] = useState(false)
  // 视频流重载计数器（用于强制刷新）
  const [reloadKey, setReloadKey] = useState(0)

  const isUpdating = commandStatus === 'sending' || commandStatus === 'pending'
  const isLocked = actuator.locked === 1
  const isOnline = actuator.status === 'online'
  const isDisabled = !isOnline || isUpdating || isLocked

  // 当 feedback 中角度变化时，同步本地滑块
  useEffect(() => {
    setPanValue(currentPan)
  }, [currentPan])

  useEffect(() => {
    setTiltValue(currentTilt)
  }, [currentTilt])

  /**
   * 发送云台绝对角度命令
   */
  const handlePanTiltChange = () => {
    onControl({
      control_type: 'camera',
      command: 'value',
      pan: panValue,
      tilt: tiltValue,
    })
  }

  /**
   * 发送云台增量移动命令
   */
  const handleDeltaMove = (panDelta: number, tiltDelta: number) => {
    onControl({
      control_type: 'camera',
      command: 'value',
      pan_delta: panDelta,
      tilt_delta: tiltDelta,
    })
  }

  /**
   * 开关摄像头
   */
  const handleTogglePower = () => {
    onControl({
      control_type: 'camera',
      command: actuator.state === 'on' ? 'off' : 'on',
    })
  }

  /**
   * 切换追踪开关
   */
  const handleToggleTracking = () => {
    onControl({
      control_type: 'camera',
      command: 'track',
      value: trackingEnabled ? 'off' : 'on',
    })
  }

  /**
   * 切换追踪颜色
   */
  const handleColorChange = (color: string) => {
    onControl({
      control_type: 'camera',
      command: 'color',
      color,
    })
  }

  /**
   * 云台复位
   */
  const handleReset = () => {
    onControl({
      control_type: 'camera',
      command: 'reset',
    })
    setPanValue(90)
    setTiltValue(90)
  }

  /**
   * 重新加载视频流
   */
  const handleReloadStream = () => {
    setStreamLoading(true)
    setStreamError(false)
    setReloadKey(k => k + 1)
  }

  return (
    <Card className="bg-card/80 border-border hover:border-primary/30 transition-all duration-200 lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${actuator.state === 'on' ? 'bg-primary/20' : 'bg-muted/50'}`}>
              <Camera className={`w-5 h-5 transition-colors ${actuator.state === 'on' ? 'text-primary' : 'text-muted-foreground'}`} />
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
            {actuator.status === 'online' ? (
              <Badge className="bg-primary/20 text-primary text-xs px-2 py-0.5">在线</Badge>
            ) : (
              <Badge className="bg-destructive/20 text-destructive text-xs px-2 py-0.5">离线</Badge>
            )}
            {actuator.state === 'on' && (
              <Badge className="bg-chart-3/20 text-chart-3 text-xs px-2 py-0.5">运行中</Badge>
            )}
            {actuator.locked === 1 && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs px-2 py-0.5">
                <Clock className="w-3 h-3 mr-1" />
                控制中
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 视频流显示区域 */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
          {actuator.state === 'on' && streamUrl && !streamError ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={reloadKey}
                src={streamUrl}
                alt="摄像头实时画面"
                className="w-full h-full object-contain"
                onLoad={() => setStreamLoading(false)}
                onError={() => {
                  setStreamLoading(false)
                  setStreamError(true)
                }}
              />
              {/* 加载中遮罩 */}
              {streamLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-sm">视频加载中...</span>
                  </div>
                </div>
              )}
              {/* 检测目标标识 */}
              {found && !streamLoading && (
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/80 text-white text-xs">
                  <Crosshair className="w-3 h-3" />
                  检测到目标
                </div>
              )}
              {/* 重新加载按钮 */}
              <button
                onClick={handleReloadStream}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors"
                title="重新加载视频流"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {/* 当前坐标显示 */}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/50 text-white text-xs font-mono">
                Pan: {currentPan.toFixed(1)}° / Tilt: {currentTilt.toFixed(1)}°
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              {actuator.state !== 'on' ? (
                <>
                  <VideoOff className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">摄像头未开启</p>
                </>
              ) : streamError ? (
                <>
                  <AlertTriangle className="w-12 h-12 mb-2 text-orange-500" />
                  <p className="text-sm mb-2">视频流加载失败</p>
                  <Button size="sm" variant="outline" onClick={handleReloadStream}>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    重试
                  </Button>
                </>
              ) : (
                <>
                  <Video className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">无视频流地址</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* 摄像头开关和追踪开关 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 摄像头电源开关 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              {actuator.state === 'on' ? <Video className="w-4 h-4 text-primary" /> : <VideoOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm font-medium">摄像头</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={actuator.state === 'on'}
                onCheckedChange={handleTogglePower}
                disabled={isDisabled}
                className="data-[state=checked]:bg-primary"
              />
              <Button
                size="sm"
                variant={actuator.state === 'on' ? 'destructive' : 'default'}
                onClick={handleTogglePower}
                disabled={isDisabled}
                className="h-8 px-3"
              >
                {isUpdating ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : actuator.state === 'on' ? (
                  <><PowerOff className="w-3 h-3 mr-1" />关闭</>
                ) : (
                  <><Power className="w-3 h-3 mr-1" />开启</>
                )}
              </Button>
            </div>
          </div>

          {/* 颜色追踪开关 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Eye className={`w-4 h-4 ${trackingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">颜色追踪</span>
              {found && trackingEnabled && (
                <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0">命中</Badge>
              )}
            </div>
            <Switch
              checked={trackingEnabled}
              onCheckedChange={handleToggleTracking}
              disabled={isDisabled || actuator.state !== 'on'}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        {/* 云台控制区域 */}
        <div className="space-y-3 p-3 rounded-lg bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              云台控制
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={isDisabled}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              复位
            </Button>
          </div>

          {/* 方向控制十字按钮 */}
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-1 w-fit">
              <div></div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeltaMove(0, 10)}
                disabled={isDisabled}
                className="h-9 w-9 p-0"
                title="上"
              >
                ↑
              </Button>
              <div></div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeltaMove(-10, 0)}
                disabled={isDisabled}
                className="h-9 w-9 p-0"
                title="左"
              >
                ←
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                disabled={isDisabled}
                className="h-9 w-9 p-0"
                title="居中"
              >
                <Crosshair className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeltaMove(10, 0)}
                disabled={isDisabled}
                className="h-9 w-9 p-0"
                title="右"
              >
                →
              </Button>
              <div></div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeltaMove(0, -10)}
                disabled={isDisabled}
                className="h-9 w-9 p-0"
                title="下"
              >
                ↓
              </Button>
              <div></div>
            </div>
          </div>

          {/* Pan 角度滑块 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                水平角度 (Pan)
              </span>
              <span className="font-mono text-primary font-semibold">{panValue.toFixed(0)}°</span>
            </div>
            <Slider
              value={[panValue]}
              onValueChange={([v]) => setPanValue(v)}
              min={0}
              max={180}
              step={1}
              disabled={isDisabled}
              className="py-1"
            />
          </div>

          {/* Tilt 角度滑块 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                俯仰角度 (Tilt)
              </span>
              <span className="font-mono text-primary font-semibold">{tiltValue.toFixed(0)}°</span>
            </div>
            <Slider
              value={[tiltValue]}
              onValueChange={([v]) => setTiltValue(v)}
              min={0}
              max={180}
              step={1}
              disabled={isDisabled}
              className="py-1"
            />
          </div>

          {/* 应用角度按钮 */}
          <Button
            size="sm"
            onClick={handlePanTiltChange}
            disabled={isDisabled || (panValue === currentPan && tiltValue === currentTilt)}
            className="w-full h-8"
          >
            <Zap className="w-3 h-3 mr-1" />
            应用角度
          </Button>
        </div>

        {/* 追踪颜色选择 */}
        <div className="space-y-2 p-3 rounded-lg bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Palette className="w-3 h-3" />
              追踪颜色
            </span>
            {currentColor && (
              <span className="text-xs text-primary font-medium">当前: {currentColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {TRACK_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => handleColorChange(c.name)}
                disabled={isDisabled || !trackingEnabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${currentColor === c.name
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
                  } ${isDisabled || !trackingEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/10"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 指令状态提示 */}
        {commandStatus !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 rounded-xl transition-all ${commandStatus === 'executed' ? 'bg-green-50 border border-green-100' :
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
        <div className="pt-3 border-t border-border/50 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              控制模式
            </span>
            <span className={actuator.mode === 'auto' ? 'text-green-600 font-medium' : 'text-blue-600 font-medium'}>
              {actuator.mode === 'auto' ? '自动' : '手动'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>最后更新</span>
            <span>{actuator.last_update ? new Date(actuator.last_update).toLocaleString('zh-CN') : '从未更新'}</span>
          </div>
          {snapshotUrl && actuator.state === 'on' && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>快照地址</span>
              <a
                href={snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                打开快照
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
