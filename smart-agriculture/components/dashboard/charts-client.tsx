"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { RefreshCw, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SensorDataPoint {
  id: number
  sensor_id: string
  value: number
  timestamp: string
}

export function ChartsClient() {
  const [temperatureData, setTemperatureData] = useState<{ time: string; value: number }[]>([])
  const [humidityData, setHumidityData] = useState<{ time: string; air: number; soil: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ day: string; temperature: number; humidity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [timeRange, setTimeRange] = useState<string>('24h') // 24h, 7d, 30d
  const [selectedSensor, setSelectedSensor] = useState<string>('T-001') // 温度传感器ID

  const formatTime = (timestamp: string, range: string): string => {
    const date = new Date(timestamp)
    switch (range) {
      case '24h':
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      case '7d':
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
      case '30d':
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
      default:
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const getLimitByRange = (range: string): number => {
    switch (range) {
      case '24h':
        return 24
      case '7d':
        return 7
      case '30d':
        return 30
      default:
        return 24
    }
  }

  const fetchChartData = async () => {
    try {
      setLoading(true)
      
      const limit = getLimitByRange(timeRange)
      
      // 获取温度数据
      const tempResponse = await fetch(`/api/sensors/${selectedSensor}/data?limit=${limit}`)
      const tempResult = await tempResponse.json()
      
      if (tempResult.success && tempResult.data) {
        const formattedData = tempResult.data
          .reverse()
          .map((item: SensorDataPoint) => ({
            time: formatTime(item.timestamp, timeRange),
            value: Number(item.value),
          }))
        setTemperatureData(formattedData)
      }

      // 获取湿度数据
      const airHumidityResponse = await fetch(`/api/sensors/H-001/data?limit=${limit}`)
      const airHumidityResult = await airHumidityResponse.json()
      
      const soilHumidityResponse = await fetch(`/api/sensors/S-001/data?limit=${limit}`)
      const soilHumidityResult = await soilHumidityResponse.json()
      
      if (airHumidityResult.success && soilHumidityResult.success) {
        const airData = airHumidityResult.data.reverse()
        const soilData = soilHumidityResult.data.reverse()
        
        const combinedData = airData.map((air: SensorDataPoint, index: number) => ({
          time: formatTime(air.timestamp, timeRange),
          air: Number(air.value),
          soil: soilData[index] ? Number(soilData[index].value) : 0,
        }))
        
        setHumidityData(combinedData)
      }

      // 生成每周数据
      const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      const mockWeeklyData = days.map((day) => ({
        day,
        temperature: 20 + Math.random() * 10,
        humidity: 50 + Math.random() * 30,
      }))
      setWeeklyData(mockWeeklyData)

      setLastUpdate(new Date())
    } catch (error) {
      console.error('获取图表数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChartData()
    
    const interval = setInterval(fetchChartData, 10000) // 优化：降低更新频率到10秒
    
    return () => clearInterval(interval)
  }, [timeRange, selectedSensor])

  // 导出图表数据
  const exportChartData = () => {
    const dataToExport = {
      temperature: temperatureData,
      humidity: humidityData,
      weekly: weeklyData,
      exportTime: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">时间范围:</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="选择时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24小时</SelectItem>
                <SelectItem value="7d">7天</SelectItem>
                <SelectItem value="30d">30天</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">温度传感器:</span>
            <Select value={selectedSensor} onValueChange={setSelectedSensor}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="选择传感器" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="T-001">T-001 (温室1号)</SelectItem>
                <SelectItem value="T-003">T-003 (温室2号)</SelectItem>
                <SelectItem value="T-002">T-002 (土壤温度)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="secondary" onClick={exportChartData} className="h-8 text-xs">
            <Download className="w-3 h-3 mr-1" />
            导出数据
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
              温度趋势
              <span className="text-xs text-muted-foreground font-normal">
                {timeRange === '24h' ? '过去24小时' : timeRange === '7d' ? '过去7天' : '过去30天'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                加载中...
              </div>
            ) : (
              <ChartContainer
                config={{
                  value: {
                    label: "温度",
                    color: "var(--color-chart-4)",
                  },
                }}
                className="h-[250px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={temperatureData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      interval={timeRange === '24h' ? 3 : 0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      domain={[10, 35]}
                    />
                    <Tooltip 
                      content={<ChartTooltipContent />}
                      animationDuration={300}
                    />
                    <ReferenceLine y={25} stroke="var(--color-primary)" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-chart-4)"
                      strokeWidth={2}
                      fill="url(#tempGradient)"
                      animationDuration={1000}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
              湿度对比
              <div className="flex items-center gap-4 text-xs font-normal">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-chart-2" />
                  空气湿度
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  土壤湿度
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                加载中...
              </div>
            ) : (
              <ChartContainer
                config={{
                  air: {
                    label: "空气湿度",
                    color: "var(--color-chart-2)",
                  },
                  soil: {
                    label: "土壤湿度",
                    color: "var(--color-primary)",
                  },
                }}
                className="h-[250px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={humidityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      interval={timeRange === '24h' ? 3 : 0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      domain={[30, 90]}
                    />
                    <Tooltip 
                      content={<ChartTooltipContent />}
                      animationDuration={300}
                    />
                    <ReferenceLine y={60} stroke="var(--color-primary)" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="air"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      animationDuration={1000}
                      animationEasing="ease-in-out"
                    />
                    <Line
                      type="monotone"
                      dataKey="soil"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      animationDuration={1000}
                      animationEasing="ease-in-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-2 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
              本周数据汇总
              <div className="flex items-center gap-4 text-xs font-normal">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-chart-4" />
                  温度 (°C)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-chart-2" />
                  湿度 (%)
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                temperature: {
                  label: "温度",
                  color: "var(--color-chart-4)",
                },
                humidity: {
                  label: "湿度",
                  color: "var(--color-chart-2)",
                },
              }}
              className="h-[250px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip 
                    content={<ChartTooltipContent />}
                    animationDuration={300}
                  />
                  <Bar 
                    dataKey="temperature" 
                    fill="var(--color-chart-4)" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                  <Bar 
                    dataKey="humidity" 
                    fill="var(--color-chart-2)" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
