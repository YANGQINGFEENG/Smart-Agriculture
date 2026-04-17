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
  console.log('ChartsClient 组件初始化')
  
  const [temperatureData, setTemperatureData] = useState<{ time: string; value: number }[]>([])
  const [humidityData, setHumidityData] = useState<{ time: string; air: number; soil: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ day: string; temperature: number; humidity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 初始值设置为null，避免服务器端渲染时间
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // 只在客户端设置初始时间
  useEffect(() => {
    console.log('ChartsClient useEffect 执行')
    setLastUpdate(new Date())
  }, [])

  const formatTime = (timestamp: string): string => {
    if (!timestamp) return ''
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch (error) {
      console.warn('时间格式化失败:', error)
      return ''
    }
  }

  const fetchChartData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // 温度数据
      try {
        const tempResponse = await fetch('/api/sensors/T-001/data?limit=60')
        if (!tempResponse.ok) {
          throw new Error(`温度数据请求失败: ${tempResponse.status}`)
        }
        const tempResult = await tempResponse.json()
        
        console.log('温度数据响应:', tempResult)
        
        if (tempResult.success && tempResult.data && Array.isArray(tempResult.data)) {
          console.log('温度数据长度:', tempResult.data.length)
          const formattedData = tempResult.data
            .reverse()
            .map((item: SensorDataPoint) => ({
              time: formatTime(item.timestamp),
              value: Number(item.value),
            }))
          console.log('格式化后的数据:', formattedData.slice(0, 5)) // 只打印前5条
          setTemperatureData(formattedData)
        } else {
          console.warn('温度数据格式错误:', tempResult)
          // 使用默认数据
          const defaultTempData = Array.from({ length: 60 }, (_, i) => ({
            time: `${Math.floor(i / 60 * 24)}:${(i % 60).toString().padStart(2, '0')}`,
            value: 25 + Math.random() * 5
          }))
          setTemperatureData(defaultTempData)
        }
      } catch (tempError) {
        console.warn('获取温度数据失败:', tempError)
        // 使用默认数据，避免图表为空
        const defaultTempData = Array.from({ length: 60 }, (_, i) => ({
          time: `${Math.floor(i / 60 * 24)}:${(i % 60).toString().padStart(2, '0')}`,
          value: 25 + Math.random() * 5
        }))
        setTemperatureData(defaultTempData)
      }

      // 湿度数据
      try {
        const airHumidityResponse = await fetch('/api/sensors/H-001/data?limit=60')
        const soilHumidityResponse = await fetch('/api/sensors/S-001/data?limit=60')
        
        if (airHumidityResponse.ok && soilHumidityResponse.ok) {
          const airHumidityResult = await airHumidityResponse.json()
          const soilHumidityResult = await soilHumidityResponse.json()
          
          if (airHumidityResult.success && soilHumidityResult.success) {
            const airData = airHumidityResult.data.reverse()
            const soilData = soilHumidityResult.data.reverse()
            
            if (airData.length > 0 && soilData.length > 0) {
              const combinedData = airData.map((air: SensorDataPoint, index: number) => ({
                time: formatTime(air.timestamp),
                air: Number(air.value),
                soil: soilData[index] ? Number(soilData[index].value) : 0,
              }))
              
              setHumidityData(combinedData)
            } else {
              // 使用默认数据
              const defaultHumidityData = Array.from({ length: 60 }, (_, i) => ({
                time: `${Math.floor(i / 60 * 24)}:${(i % 60).toString().padStart(2, '0')}`,
                air: 60 + Math.random() * 10,
                soil: 40 + Math.random() * 15
              }))
              setHumidityData(defaultHumidityData)
            }
          } else {
            // 使用默认数据
            const defaultHumidityData = Array.from({ length: 60 }, (_, i) => ({
              time: `${Math.floor(i / 60 * 24)}:${(i % 60).toString().padStart(2, '0')}`,
              air: 60 + Math.random() * 10,
              soil: 40 + Math.random() * 15
            }))
            setHumidityData(defaultHumidityData)
          }
        } else {
          // 使用默认数据
          const defaultHumidityData = Array.from({ length: 60 }, (_, i) => ({
            time: `${Math.floor(i / 60 * 24)}:${(i % 60).toString().padStart(2, '0')}`,
            air: 60 + Math.random() * 10,
            soil: 40 + Math.random() * 15
          }))
          setHumidityData(defaultHumidityData)
        }
      } catch (humidityError) {
        console.warn('获取湿度数据失败:', humidityError)
        // 使用默认数据
        const defaultHumidityData = Array.from({ length: 60 }, (_, i) => ({
          time: `${Math.floor(i / 60 * 24)}:${(i % 60).toString().padStart(2, '0')}`,
          air: 60 + Math.random() * 10,
          soil: 40 + Math.random() * 15
        }))
        setHumidityData(defaultHumidityData)
      }

      // 周数据（模拟）
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
      setError('数据加载失败，显示默认数据')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('ChartsClient: 开始获取数据')
    fetchChartData()
    
    const interval = setInterval(() => {
      console.log('ChartsClient: 定时获取数据')
      fetchChartData()
    }, 5000)
    
    return () => {
      console.log('ChartsClient: 清理定时器')
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>最后更新: {lastUpdate ? lastUpdate.toLocaleTimeString('zh-CN') : ''}</span>
        </div>
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
        <span className="text-xs text-muted-foreground">
          温度数据: {temperatureData.length} 条
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            ) : temperatureData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <div className="h-[200px] w-full">
                <AreaChart data={temperatureData} width="100%" height={200}>
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
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </div>
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
            ) : humidityData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <div className="h-[200px] w-full">
                <LineChart data={humidityData} width="100%" height={200}>
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
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                  <Line
                    type="monotone"
                    dataKey="soil"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border md:col-span-2">
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
              <BarChart data={weeklyData} width="100%" height={200}>
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
                <Bar dataKey="temperature" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} animationDuration={1500} animationEasing="ease-in-out" />
                <Bar dataKey="humidity" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} animationDuration={1500} animationEasing="ease-in-out" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
