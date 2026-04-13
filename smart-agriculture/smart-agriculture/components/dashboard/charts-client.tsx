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
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { RefreshCw } from "lucide-react"

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

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const fetchChartData = async () => {
    try {
      const tempResponse = await fetch('/api/sensors/T-001/data?limit=24')
      const tempResult = await tempResponse.json()
      
      if (tempResult.success && tempResult.data) {
        const formattedData = tempResult.data
          .reverse()
          .map((item: SensorDataPoint) => ({
            time: formatTime(item.timestamp),
            value: Number(item.value),
          }))
        setTemperatureData(formattedData)
      }

      const airHumidityResponse = await fetch('/api/sensors/H-001/data?limit=24')
      const airHumidityResult = await airHumidityResponse.json()
      
      const soilHumidityResponse = await fetch('/api/sensors/S-001/data?limit=24')
      const soilHumidityResult = await soilHumidityResponse.json()
      
      if (airHumidityResult.success && soilHumidityResult.success) {
        const airData = airHumidityResult.data.reverse()
        const soilData = soilHumidityResult.data.reverse()
        
        const combinedData = airData.map((air: SensorDataPoint, index: number) => ({
          time: formatTime(air.timestamp),
          air: Number(air.value),
          soil: soilData[index] ? Number(soilData[index].value) : 0,
        }))
        
        setHumidityData(combinedData)
      }

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
    
    const interval = setInterval(fetchChartData, 5000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
              温度趋势
              <span className="text-xs text-muted-foreground font-normal">过去24小时</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
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
                className="h-[200px] w-full"
              >
                <AreaChart data={temperatureData} width={500} height={200}>
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
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    domain={[10, 35]}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-chart-4)"
                    strokeWidth={2}
                    fill="url(#tempGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
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
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
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
                className="h-[200px] w-full"
              >
                <LineChart data={humidityData} width={500} height={200}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    domain={[30, 90]}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="air"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="soil"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-2">
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
              className="h-[200px] w-full"
            >
              <BarChart data={weeklyData} width={1000} height={200}>
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
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="temperature" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="humidity" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
