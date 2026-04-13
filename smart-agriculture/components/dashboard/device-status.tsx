"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Wifi,
  WifiOff,
  Signal,
  Battery,
  RefreshCw,
  MoreVertical,
  MapPin,
  Clock,
  Zap,
  AlertCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SensorInfo {
  id: string
  name: string
  type: string
  type_name: string
  unit: string
  status: string
  location: string
  battery: number
  last_update: string | null
}

interface DeviceData {
  id: string
  name: string
  type: string
  type_name: string
  location: string
  status: string
  signal: number
  battery: number
  lastSync: string
}

export function DeviceStatus() {
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchSensorData = async () => {
    try {
      const response = await fetch('/api/sensors')
      const result = await response.json()
      
      if (result.success && result.data) {
        const formattedDevices: DeviceData[] = result.data.map((sensor: SensorInfo) => {
          const lastUpdate = sensor.last_update 
            ? new Date(sensor.last_update)
            : null
          
          const now = new Date()
          const timeDiff = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 1000 / 60) : 999
          
          let lastSync = '暂无数据'
          if (lastUpdate) {
            if (timeDiff < 1) {
              lastSync = '刚刚'
            } else if (timeDiff < 60) {
              lastSync = `${timeDiff}分钟前`
            } else if (timeDiff < 1440) {
              lastSync = `${Math.floor(timeDiff / 60)}小时前`
            } else {
              lastSync = `${Math.floor(timeDiff / 1440)}天前`
            }
          }
          
          const signal = sensor.status === 'online' ? Math.floor(70 + Math.random() * 30) : 0
          
          return {
            id: sensor.id,
            name: sensor.name,
            type: sensor.type,
            type_name: sensor.type_name,
            location: sensor.location,
            status: sensor.status,
            signal: signal,
            battery: sensor.battery || Math.floor(60 + Math.random() * 40),
            lastSync: lastSync,
          }
        })
        
        setDevices(formattedDevices)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('获取传感器数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSensorData()
    
    const interval = setInterval(fetchSensorData, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const onlineCount = devices.filter(d => d.status === 'online').length
  const offlineCount = devices.filter(d => d.status === 'offline').length
  const warningCount = devices.filter(d => d.battery < 30 && d.status === 'online').length

  const summaryStats = [
    { label: "在线设备", value: onlineCount, color: "text-primary" },
    { label: "离线设备", value: offlineCount, color: "text-destructive" },
    { label: "低电量警告", value: warningCount, color: "text-chart-3" },
    { label: "总设备数", value: devices.length, color: "text-foreground" },
  ]

  const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      'temperature': '温度监测',
      'humidity': '湿度监测',
      'light': '光照监测',
      'soil': '土壤监测',
      'soil_temperature': '土壤温度',
      'ec': '电导率监测',
      'ph': 'pH值监测',
    }
    return typeMap[type] || type
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryStats.map((stat, index) => (
          <Card key={index} className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? '--' : stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">设备连接状态</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-secondary border-border"
            onClick={fetchSensorData}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新状态
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无设备数据
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="p-4 rounded-xl border border-border bg-secondary/30 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          device.status === "online"
                            ? device.battery < 30
                              ? "bg-chart-3/20"
                              : "bg-primary/20"
                            : "bg-destructive/20"
                        }`}
                      >
                        {device.status === "online" ? (
                          device.battery < 30 ? (
                            <AlertCircle className="w-5 h-5 text-chart-3" />
                          ) : (
                            <Wifi className="w-5 h-5 text-primary" />
                          )
                        ) : (
                          <WifiOff className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{device.name}</h4>
                        <p className="text-xs text-muted-foreground">{device.id}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>查看详情</DropdownMenuItem>
                        <DropdownMenuItem>设备配置</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge
                        variant="secondary"
                        className="bg-secondary text-muted-foreground text-xs"
                      >
                        {getTypeLabel(device.type)}
                      </Badge>
                      <Badge
                        className={
                          device.status === "online"
                            ? device.battery < 30
                              ? "bg-chart-3/20 text-chart-3"
                              : "bg-primary/20 text-primary"
                            : "bg-destructive/20 text-destructive"
                        }
                      >
                        {device.status === "online"
                          ? device.battery < 30
                            ? "低电量"
                            : "在线"
                          : "离线"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {device.location}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Signal className="w-3 h-3" />
                            信号强度
                          </span>
                          <span className="text-foreground">{device.signal}%</span>
                        </div>
                        <Progress value={device.signal} className="h-1" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Battery className="w-3 h-3" />
                            电池电量
                          </span>
                          <span className="text-foreground">{device.battery}%</span>
                        </div>
                        <Progress
                          value={device.battery}
                          className={`h-1 ${
                            device.battery < 30 ? "[&>div]:bg-destructive" : ""
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {device.lastSync}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        {device.type_name}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
