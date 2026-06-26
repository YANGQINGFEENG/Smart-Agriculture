"use client"

import { useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { useFarm } from "@/lib/farm-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  RefreshCw,
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  Router,
  Power,
  Bell,
  Activity,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface SensorStats {
  type: string
  name: string
  icon: any
  value: number
  unit: string
  trend: 'up' | 'down'
  change: string
  color: string
  bgColor: string
}

interface GatewayStats {
  total: number
  online: number
}

interface DeviceStats {
  total: number
  online: number
}

interface AlarmStats {
  active: number
  today: number
}

export default function DashboardPage() {
  const { farms, selectedFarmId } = useFarm()
  const [sensorStats, setSensorStats] = useState<SensorStats[]>([])
  const [gatewayStats, setGatewayStats] = useState<GatewayStats>({ total: 0, online: 0 })
  const [deviceStats, setDeviceStats] = useState<DeviceStats>({ total: 0, online: 0 })
  const [alarmStats, setAlarmStats] = useState<AlarmStats>({ active: 0, today: 0 })
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setLastUpdate(new Date().toLocaleTimeString("zh-CN"))
    const interval = setInterval(() => {
      setLastUpdate(new Date().toLocaleTimeString("zh-CN"))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    if (!selectedFarmId) return
    setLoading(true)
    try {
      // 获取传感器统计
      const sensorRes = await fetch(`/api/sensors?farm_id=${selectedFarmId}`)
      const sensorData = await sensorRes.json()
      
      if (sensorData.success) {
        const stats: SensorStats[] = []
        const types = [
          { type: 'temperature', name: '平均温度', icon: Thermometer, unit: '°C', color: 'text-red-500', bgColor: 'bg-red-50' },
          { type: 'humidity', name: '空气湿度', icon: Droplets, unit: '%', color: 'text-blue-500', bgColor: 'bg-blue-50' },
          { type: 'light', name: '光照强度', icon: Sun, unit: 'lux', color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
          { type: 'soil', name: '土壤湿度', icon: Leaf, unit: '%', color: 'text-green-500', bgColor: 'bg-green-50' },
        ]
        
        for (const t of types) {
          const sensors = sensorData.data.filter((s: any) => s.type === t.type)
          stats.push({
            ...t,
            value: sensors.length,
            trend: Math.random() > 0.5 ? 'up' : 'down',
            change: (Math.random() * 5).toFixed(1),
          })
        }
        setSensorStats(stats)
      }

      // 获取网关统计
      const gatewayRes = await fetch(`/api/gateways?farm_id=${selectedFarmId}`)
      const gatewayData = await gatewayRes.json()
      if (gatewayData.success) {
        setGatewayStats({
          total: gatewayData.data.length,
          online: gatewayData.data.filter((g: any) => g.status === 'online').length,
        })
      }

      // 获取设备节点统计
      const nodeRes = await fetch(`/api/device-nodes?farm_id=${selectedFarmId}`)
      const nodeData = await nodeRes.json()
      if (nodeData.success) {
        setDeviceStats({
          total: nodeData.data.length,
          online: nodeData.data.filter((n: any) => n.status === 'online').length,
        })
      }

      // 获取报警统计
      const alarmRes = await fetch('/api/alarms/records?pageSize=100')
      const alarmData = await alarmRes.json()
      if (alarmData.success) {
        const today = new Date().toDateString()
        setAlarmStats({
          active: alarmData.data.filter((r: any) => r.status === 'active').length,
          today: alarmData.data.filter((r: any) => new Date(r.created_at).toDateString() === today).length,
        })
      }

      setLastUpdate(new Date().toLocaleTimeString("zh-CN"))
    } catch (error) {
      console.error("获取统计数据失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [selectedFarmId])

  const farmName = farms.find(f => f.id === selectedFarmId)?.name || '未选择基地'

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex">
        <SidebarNav activeTab="overview" />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg bg-card border border-border shadow-lg">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SidebarNav activeTab="overview" />
            </SheetContent>
          </Sheet>
        </div>
        
        <Header activeTab="overview" />
        
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">数据概览</h1>
                <p className="text-muted-foreground">{farmName} · 最后更新: {mounted ? lastUpdate : '--:--:--'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* 传感器概览 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">📊 传感器概览</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sensorStats.map((stat) => (
                      <Card key={stat.type} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                              <stat.icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              {stat.trend === 'up' ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                              )}
                              <span className={stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                                {stat.change}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.name} · {stat.unit}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 设备状态概览 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">⚙️ 设备状态</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/devices">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-50">
                                <Router className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <p className="font-medium">网关设备</p>
                                <p className="text-xs text-muted-foreground">设备连接管理</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{gatewayStats.online}/{gatewayStats.total}</p>
                              <Badge variant={gatewayStats.online === gatewayStats.total ? 'default' : 'secondary'}>
                                {gatewayStats.online === gatewayStats.total ? '全部在线' : '部分离线'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>

                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-50">
                              <Activity className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium">传感器节点</p>
                              <p className="text-xs text-muted-foreground">数据采集设备</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{deviceStats.online}/{deviceStats.total}</p>
                            <Badge variant={deviceStats.online === deviceStats.total ? 'default' : 'secondary'}>
                              {deviceStats.online === deviceStats.total ? '全部在线' : '部分离线'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Link href="/actuators">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-purple-50">
                                <Power className="h-5 w-5 text-purple-500" />
                              </div>
                              <div>
                                <p className="font-medium">执行器控制</p>
                                <p className="text-xs text-muted-foreground">设备控制管理</p>
                              </div>
                            </div>
                            <Badge variant="outline">前往控制</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </div>

                {/* 报警概览 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">🔔 报警概览</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/alarms">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${alarmStats.active > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                                <Bell className={`h-5 w-5 ${alarmStats.active > 0 ? 'text-red-500' : 'text-green-500'}`} />
                              </div>
                              <div>
                                <p className="font-medium">未处理报警</p>
                                <p className="text-xs text-muted-foreground">需要关注的报警</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${alarmStats.active > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {alarmStats.active}
                              </p>
                              <Badge variant={alarmStats.active > 0 ? 'destructive' : 'default'}>
                                {alarmStats.active > 0 ? '需要处理' : '暂无报警'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>

                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-yellow-50">
                              <Bell className="h-5 w-5 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-medium">今日报警</p>
                              <p className="text-xs text-muted-foreground">今日触发的报警</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{alarmStats.today}</p>
                            <p className="text-xs text-muted-foreground">条</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* 快捷入口 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">🚀 快捷入口</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <Link href="/farms" className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer text-center p-4">
                        <p className="text-2xl mb-1">🏗️</p>
                        <p className="text-sm font-medium">基地管理</p>
                      </Card>
                    </Link>
                    <Link href="/devices" className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer text-center p-4">
                        <p className="text-2xl mb-1">📡</p>
                        <p className="text-sm font-medium">设备连接</p>
                      </Card>
                    </Link>
                    <Link href="/knowledge" className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer text-center p-4">
                        <p className="text-2xl mb-1">📚</p>
                        <p className="text-sm font-medium">知识库</p>
                      </Card>
                    </Link>
                    <Link href="/ai-video" className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer text-center p-4">
                        <p className="text-2xl mb-1">🎥</p>
                        <p className="text-sm font-medium">AI视频</p>
                      </Card>
                    </Link>
                    <Link href="/analysis" className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer text-center p-4">
                        <p className="text-2xl mb-1">📈</p>
                        <p className="text-sm font-medium">数据分析</p>
                      </Card>
                    </Link>
                    <Link href="/export" className="block">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer text-center p-4">
                        <p className="text-2xl mb-1">📥</p>
                        <p className="text-sm font-medium">数据导出</p>
                      </Card>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
        
        <footer className="h-12 border-t border-border bg-card/50 flex items-center justify-center px-4">
          <p className="text-xs text-muted-foreground text-center">
            天工慧眼 - 智慧农业物联网监控平台 v1.0.0 | {mounted ? lastUpdate : '--:--:--'}
          </p>
        </footer>
      </div>
    </div>
  )
}
