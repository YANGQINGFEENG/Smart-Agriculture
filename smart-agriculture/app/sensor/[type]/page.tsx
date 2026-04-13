"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Download,
  RefreshCw,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { Spinner } from "@/components/ui/spinner"
import { ThemeToggle } from "@/components/theme-toggle"

const sensorConfig: Record<string, {
  title: string
  unit: string
  icon: typeof Thermometer
  color: string
  bgColor: string
  chartColor: string
  description: string
  normalRange: string
  warningThreshold: { min: number; max: number }
  sensorIds: string[]
}> = {
  temperature: {
    title: "温度传感器",
    unit: "°C",
    icon: Thermometer,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    chartColor: "var(--chart-4)",
    description: "监测环境温度变化，适用于温室大棚、养殖场等场景",
    normalRange: "18°C - 28°C",
    warningThreshold: { min: 15, max: 32 },
    sensorIds: ["T-001", "T-002", "T-003"],
  },
  humidity: {
    title: "空气湿度传感器",
    unit: "%",
    icon: Droplets,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    chartColor: "var(--chart-2)",
    description: "监测空气相对湿度，对作物生长和病虫害防治至关重要",
    normalRange: "60% - 80%",
    warningThreshold: { min: 40, max: 90 },
    sensorIds: ["H-001", "H-002"],
  },
  light: {
    title: "光照传感器",
    unit: "Lux",
    icon: Sun,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    chartColor: "var(--chart-3)",
    description: "监测光照强度，帮助调节补光灯和遮阳设施",
    normalRange: "8,000 - 15,000 Lux",
    warningThreshold: { min: 5000, max: 20000 },
    sensorIds: ["L-001", "L-002"],
  },
  soil: {
    title: "土壤湿度传感器",
    unit: "%",
    icon: Leaf,
    color: "text-primary",
    bgColor: "bg-primary/10",
    chartColor: "var(--primary)",
    description: "监测土壤含水量，精准灌溉节约水资源",
    normalRange: "35% - 55%",
    warningThreshold: { min: 25, max: 65 },
    sensorIds: ["S-001", "S-002", "S-003"],
  },
  soil_temperature: {
    title: "土壤温度传感器",
    unit: "°C",
    icon: Thermometer,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
    chartColor: "var(--chart-5)",
    description: "监测土壤温度，影响作物根系生长和养分吸收",
    normalRange: "15°C - 25°C",
    warningThreshold: { min: 10, max: 30 },
    sensorIds: ["T-002"],
  },
  ec: {
    title: "土壤电导率传感器",
    unit: "μS/cm",
    icon: Activity,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    chartColor: "var(--chart-1)",
    description: "监测土壤电导率，反映土壤盐分含量和肥力状况",
    normalRange: "200 - 800 μS/cm",
    warningThreshold: { min: 100, max: 1500 },
    sensorIds: ["E-001"],
  },
  ph: {
    title: "土壤pH值传感器",
    unit: "pH",
    icon: Droplets,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    chartColor: "var(--chart-2)",
    description: "监测土壤酸碱度，影响作物对养分的吸收效率",
    normalRange: "6.0 - 7.5 pH",
    warningThreshold: { min: 5.5, max: 8.0 },
    sensorIds: ["P-001"],
  },
}

interface SensorDataPoint {
  id: number
  sensor_id: string
  value: number
  timestamp: string
}

interface SensorInfo {
  id: string
  name: string
  type: string
  type_name: string
  unit: string
  status: string
  location: string
}

interface SensorWithStatus extends SensorInfo {
  currentValue: number
  lastUpdate: string
  battery: number
}

export default function SensorDetailPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = use(params)
  const config = sensorConfig[type]
  const [timeRange, setTimeRange] = useState("24h")
  const [mounted, setMounted] = useState(false)
  const [hourlyData, setHourlyData] = useState<{ time: string; value: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ day: string; avg: number; max: number; min: number }[]>([])
  const [sensorList, setSensorList] = useState<SensorWithStatus[]>([])
  const [stats, setStats] = useState({ current: 0, avg: 0, max: 0, min: 0 })
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const fetchData = async () => {
    if (!config) return

    try {
      const sensorId = config.sensorIds[0]
      const dataResponse = await fetch(`/api/sensors/${sensorId}/data?limit=24`)
      const dataResult = await dataResponse.json()

      if (dataResult.success && dataResult.data) {
        const formattedData = dataResult.data
          .reverse()
          .map((item: SensorDataPoint) => ({
            time: formatTime(item.timestamp),
            value: Number(item.value),
          }))
        setHourlyData(formattedData)

        if (dataResult.stats) {
          setStats({
            current: Number(dataResult.data[dataResult.data.length - 1]?.value) || 0,
            avg: dataResult.stats.avg || 0,
            max: dataResult.stats.max || 0,
            min: dataResult.stats.min || 0,
          })
        }
      }

      const sensorsResponse = await fetch('/api/sensors')
      const sensorsResult = await sensorsResponse.json()

      if (sensorsResult.success && sensorsResult.data) {
        const typeSensors = sensorsResult.data.filter((s: SensorInfo) => s.type === type)
        
        const sensorsWithStatus = await Promise.all(
          typeSensors.map(async (sensor: SensorInfo) => {
            const sensorDataResponse = await fetch(`/api/sensors/${sensor.id}/data?limit=1`)
            const sensorDataResult = await sensorDataResponse.json()
            
            const latestData = sensorDataResult.data?.[0]
            
            return {
              ...sensor,
              currentValue: latestData ? Number(latestData.value) : 0,
              lastUpdate: latestData 
                ? new Date(latestData.timestamp).toLocaleString('zh-CN')
                : '暂无数据',
              battery: Math.floor(60 + Math.random() * 40),
              status: Math.random() > 0.1 ? 'online' : 'offline',
            }
          })
        )
        
        setSensorList(sensorsWithStatus)
      }

      const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      const mockWeeklyData = days.map((day) => ({
        day,
        avg: stats.avg + (Math.random() - 0.5) * 5,
        max: stats.max + Math.random() * 3,
        min: stats.min - Math.random() * 3,
      }))
      setWeeklyData(mockWeeklyData)

      setLastUpdate(new Date())
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchData()

    const interval = setInterval(fetchData, 5000)

    return () => clearInterval(interval)
  }, [type])

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <h1 className="text-xl font-bold text-foreground mb-4">传感器类型不存在</h1>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const Icon = config.icon

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{config.title}</h1>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24小时</SelectItem>
                <SelectItem value="7d">7天</SelectItem>
                <SelectItem value="30d">30天</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="bg-secondary border-border" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <ThemeToggle />
            <Button variant="outline" className="bg-secondary border-border">
              <Download className="w-4 h-4 mr-2" />
              导出数据
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">当前值</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <Spinner className="text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${config.color}`}>
                      {type === 'light' ? stats.current.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : stats.current.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">{config.unit}</span>
                  </div>
                  <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary">
                    <Activity className="w-3 h-3 mr-1" />
                    实时
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">平均值</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <Spinner className="text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {type === 'light' ? stats.avg.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : stats.avg.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">{config.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">过去24小时</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">最高值</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <Spinner className="text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <TrendingUp className="w-5 h-5 text-chart-4 mr-1" />
                    <span className="text-3xl font-bold text-chart-4">
                      {type === 'light' ? stats.max.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : stats.max.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">{config.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">过去24小时</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">最低值</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <Spinner className="text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <TrendingDown className="w-5 h-5 text-chart-2 mr-1" />
                    <span className="text-3xl font-bold text-chart-2">
                      {type === 'light' ? stats.min.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : stats.min.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">{config.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">过去24小时</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="trend">趋势图</TabsTrigger>
            <TabsTrigger value="comparison">对比分析</TabsTrigger>
            <TabsTrigger value="sensors">传感器列表</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">24小时变化趋势</CardTitle>
                <CardDescription>显示{config.title}在过去24小时内的数据变化</CardDescription>
              </CardHeader>
              <CardContent>
                {loading || !mounted ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <Spinner className="text-primary" />
                  </div>
                ) : hourlyData.length > 0 ? (
                  <ChartContainer
                    config={{
                      value: { label: config.title, color: config.chartColor },
                    }}
                    className="h-[350px] w-full"
                  >
                    <AreaChart data={hourlyData} width={1000} height={350} accessibilityLayer>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={config.chartColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={config.chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "var(--foreground)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={config.chartColor}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                        name={config.title}
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">正常范围参考</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                    <span className="text-muted-foreground">建议范围</span>
                    <span className="font-semibold text-primary">{config.normalRange}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-chart-4/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-chart-4" />
                      <span className="text-muted-foreground">高温预警阈值</span>
                    </div>
                    <span className="font-semibold text-chart-4">
                      {">"} {config.warningThreshold.max} {config.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-chart-2/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-chart-2" />
                      <span className="text-muted-foreground">低温预警阈值</span>
                    </div>
                    <span className="font-semibold text-chart-2">
                      {"<"} {config.warningThreshold.min} {config.unit}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">传感器状态概览</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 text-center">
                      <p className="text-3xl font-bold text-primary">
                        {sensorList.filter((s) => s.status === "online").length}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">在线设备</p>
                    </div>
                    <div className="p-4 rounded-lg bg-chart-4/10 text-center">
                      <p className="text-3xl font-bold text-chart-4">
                        {sensorList.filter((s) => s.status === "offline").length}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">离线设备</p>
                    </div>
                    <div className="p-4 rounded-lg bg-chart-3/10 text-center">
                      <p className="text-3xl font-bold text-chart-3">{sensorList.length}</p>
                      <p className="text-sm text-muted-foreground mt-1">总设备数</p>
                    </div>
                    <div className="p-4 rounded-lg bg-chart-2/10 text-center">
                      <p className="text-3xl font-bold text-chart-2">
                        {sensorList.length > 0
                          ? Math.round(
                              (sensorList.filter((s) => s.status === "online").length /
                                sensorList.length) *
                                100
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">在线率</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="comparison">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">每周数据对比</CardTitle>
                <CardDescription>显示本周每天的平均值、最高值和最低值对比</CardDescription>
              </CardHeader>
              <CardContent>
                {loading || !mounted ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <Spinner className="text-primary" />
                  </div>
                ) : (
                  <ChartContainer
                    config={{
                      min: { label: "最低值", color: "var(--chart-2)" },
                      avg: { label: "平均值", color: config.chartColor },
                      max: { label: "最高值", color: "var(--chart-4)" },
                    }}
                    className="h-[400px] w-full"
                  >
                    <BarChart data={weeklyData} width={1000} height={400} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "var(--foreground)" }}
                      />
                      <Bar dataKey="min" fill="var(--chart-2)" name="最低值" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="avg" fill={config.chartColor} name="平均值" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="max" fill="var(--chart-4)" name="最高值" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sensors">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">传感器列表</CardTitle>
                <CardDescription>所有{config.title}的详细信息和状态</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Spinner className="text-primary" />
                  </div>
                ) : sensorList.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">设备ID</TableHead>
                        <TableHead className="text-muted-foreground">名称</TableHead>
                        <TableHead className="text-muted-foreground">状态</TableHead>
                        <TableHead className="text-muted-foreground">当前值</TableHead>
                        <TableHead className="text-muted-foreground">电量</TableHead>
                        <TableHead className="text-muted-foreground">最后更新</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sensorList.map((sensor) => (
                        <TableRow key={sensor.id} className="border-border">
                          <TableCell className="font-mono text-foreground">{sensor.id}</TableCell>
                          <TableCell className="text-foreground">{sensor.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                sensor.status === "online"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-chart-4/10 text-chart-4"
                              }
                            >
                              {sensor.status === "online" ? "在线" : "离线"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-foreground">
                            {type === 'light' 
                              ? sensor.currentValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
                              : sensor.currentValue.toFixed(1)
                            } {config.unit}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    sensor.battery > 50
                                      ? "bg-primary"
                                      : sensor.battery > 20
                                      ? "bg-chart-3"
                                      : "bg-chart-4"
                                  }`}
                                  style={{ width: `${sensor.battery}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{sensor.battery}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {sensor.lastUpdate}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    暂无传感器数据
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
