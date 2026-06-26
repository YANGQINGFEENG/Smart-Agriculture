"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, subHours, subDays, startOfDay, endOfDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  TrendingUp,
  Download,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Check,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

/**
 * 传感器数据点接口
 */
interface SensorDataPoint {
  timestamp: string
  [key: string]: number | string
}

/**
 * 传感器接口
 */
interface Sensor {
  id: string
  name: string
  type: string
  type_name: string
  location: string
  status: string
  last_value: string
  last_update: string
}

/**
 * 时间范围选项
 */
interface TimeRangeOption {
  label: string
  value: string
  hours?: number
  days?: number
}

const timeRangeOptions: TimeRangeOption[] = [
  { label: "最近1小时", value: "1h", hours: 1 },
  { label: "最近6小时", value: "6h", hours: 6 },
  { label: "最近12小时", value: "12h", hours: 12 },
  { label: "最近24小时", value: "24h", hours: 24 },
  { label: "最近7天", value: "7d", days: 7 },
  { label: "自定义", value: "custom" },
]

/**
 * 图表颜色
 */
const chartColors = [
  "#0ea5e9", // 蓝色
  "#22c55e", // 绿色
  "#f59e0b", // 橙色
  "#ef4444", // 红色
  "#8b5cf6", // 紫色
  "#14b8a6", // 青色
]

/**
 * 数据对比组件
 * 支持多传感器数据趋势对比和导出
 */
export function DataCompare() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [selectedSensors, setSelectedSensors] = useState<string[]>([])
  const [chartData, setChartData] = useState<SensorDataPoint[]>([])
  const [timeRange, setTimeRange] = useState<string>("6h")
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>()
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>()
  const [loading, setLoading] = useState<boolean>(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  /**
   * 加载传感器列表
   */
  const loadSensors = async () => {
    try {
      const response = await fetch("/api/sensors")
      const result = await response.json()
      if (result.success) {
        setSensors(result.data)
      }
    } catch (error) {
      console.error("获取传感器列表失败:", error)
    }
  }

  useEffect(() => {
    loadSensors()
  }, [])

  /**
   * 滑动平均滤波
   * @param data 原始数据数组
   * @param windowSize 窗口大小
   * @returns 滤波后的数据
   */
  const movingAverageFilter = (data: any[], windowSize: number = 3) => {
    if (data.length <= windowSize) {
      return data
    }

    const filteredData = []
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2))
      const end = Math.min(data.length, i + Math.ceil(windowSize / 2))
      const windowData = data.slice(start, end)
      
      const sum = windowData.reduce((acc, point) => acc + parseFloat(point.value), 0)
      const avg = sum / windowData.length
      
      filteredData.push({
        ...data[i],
        value: avg
      })
    }
    
    return filteredData
  }

  /**
   * 异常值检测和处理
   * @param data 数据数组
   * @param threshold 阈值（默认2倍标准差）
   * @returns 处理后的数据
   */
  const detectAndHandleOutliers = (data: any[], threshold: number = 2) => {
    if (data.length < 3) {
      return data
    }

    // 计算均值和标准差
    const values = data.map(point => parseFloat(point.value))
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length
    const stdDev = Math.sqrt(
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
    )

    // 处理异常值
    const processedData = data.map((point, index) => {
      const value = parseFloat(point.value)
      const isOutlier = Math.abs(value - mean) > threshold * stdDev
      
      if (isOutlier) {
        // 用前后值的平均值替换异常值
        let replacementValue
        if (index === 0) {
          replacementValue = parseFloat(data[index + 1].value)
        } else if (index === data.length - 1) {
          replacementValue = parseFloat(data[index - 1].value)
        } else {
          replacementValue = (parseFloat(data[index - 1].value) + parseFloat(data[index + 1].value)) / 2
        }
        return {
          ...point,
          value: replacementValue
        }
      }
      return point
    })
    
    return processedData
  }

  /**
   * 补全缺失数据
   * @param data 数据数组
   * @returns 补全后的数据
   */
  const fillMissingData = (data: any[]) => {
    if (data.length < 2) {
      return data
    }

    const filledData = []
    
    for (let i = 0; i < data.length; i++) {
      filledData.push(data[i])
      
      // 检查是否有时间间隔过大的情况
      if (i < data.length - 1) {
        const currentTime = new Date(data[i].timestamp).getTime()
        const nextTime = new Date(data[i + 1].timestamp).getTime()
        const timeDiff = nextTime - currentTime
        
        // 如果时间间隔超过30秒，认为有缺失数据
        if (timeDiff > 30000) {
          const currentValue = parseFloat(data[i].value)
          const nextValue = parseFloat(data[i + 1].value)
          const valueDiff = nextValue - currentValue
          
          // 计算需要插入的点数
          const insertCount = Math.floor(timeDiff / 10000) // 每10秒插入一个点
          
          for (let j = 1; j <= insertCount; j++) {
            const interpolatedTime = new Date(currentTime + (timeDiff * j) / (insertCount + 1))
            const interpolatedValue = currentValue + (valueDiff * j) / (insertCount + 1)
            
            filledData.push({
              ...data[i],
              timestamp: interpolatedTime,
              value: interpolatedValue
            })
          }
        }
      }
    }
    
    return filledData
  }

  /**
   * 获取对比数据
   */
  const fetchCompareData = async () => {
    if (selectedSensors.length === 0) {
      return
    }

    setLoading(true)
    
    try {
      let startTime: Date
      let endTime = new Date()

      if (timeRange === "custom") {
        if (!customStartDate || !customEndDate) {
          alert('请选择自定义时间范围')
          setLoading(false)
          return
        }
        startTime = startOfDay(customStartDate)
        endTime = endOfDay(customEndDate)
      } else {
        const option = timeRangeOptions.find(opt => opt.value === timeRange)
        if (option?.hours) {
          startTime = subHours(endTime, option.hours)
        } else if (option?.days) {
          startTime = subDays(endTime, option.days)
        } else {
          startTime = subHours(endTime, 24)
        }
      }

      const dataPromises = selectedSensors.map(async (sensorId) => {
        const response = await fetch(
          `/api/sensors/${sensorId}/data?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}&limit=1000`
        )
        const result = await response.json()
        
        let processedData = result.success ? result.data : []
        
        // 1. 处理异常值
        processedData = detectAndHandleOutliers(processedData)
        
        // 2. 滑动平均滤波
        processedData = movingAverageFilter(processedData, 3)
        
        // 3. 补全缺失数据
        processedData = fillMissingData(processedData)
        
        return {
          sensorId,
          data: processedData,
        }
      })

      const results = await Promise.all(dataPromises)

      const mergedData: Map<string, SensorDataPoint> = new Map()

      results.forEach(({ sensorId, data }) => {
        data.forEach((point: any) => {
          const timeKey = format(new Date(point.timestamp), 'HH:mm:ss')
          
          if (!mergedData.has(timeKey)) {
            mergedData.set(timeKey, { timestamp: timeKey })
          }
          
          const existingPoint = mergedData.get(timeKey)!
          existingPoint[sensorId] = parseFloat(parseFloat(point.value).toFixed(2))
        })
      })

      const sortedData = Array.from(mergedData.values()).sort((a, b) => 
        a.timestamp.localeCompare(b.timestamp)
      )

      setChartData(sortedData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('获取对比数据失败:', error)
      alert('获取对比数据失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 导出数据
   */
  const exportData = async (format: 'csv' | 'excel') => {
    if (selectedSensors.length === 0) {
      alert('请先选择传感器')
      return
    }

    try {
      let startTime: Date
      let endTime = new Date()

      if (timeRange === "custom") {
        if (!customStartDate || !customEndDate) {
          alert('请选择自定义时间范围')
          return
        }
        startTime = startOfDay(customStartDate)
        endTime = endOfDay(customEndDate)
      } else {
        const option = timeRangeOptions.find(opt => opt.value === timeRange)
        if (option?.hours) {
          startTime = subHours(endTime, option.hours)
        } else if (option?.days) {
          startTime = subDays(endTime, option.days)
        } else {
          startTime = subHours(endTime, 24)
        }
      }

      const params = new URLSearchParams()
      selectedSensors.forEach(id => params.append('sensorIds', id))
      params.append('startTime', startTime.toISOString())
      params.append('endTime', endTime.toISOString())

      const url = `/api/export?${params.toString()}&format=${format}`
      window.open(url, '_blank')
    } catch (error) {
      console.error('导出数据失败:', error)
      alert('导出数据失败')
    }
  }

  /**
   * 格式化图表数据
   */
  const formatChartData = chartData.map(point => ({
    ...point,
  }))

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">数据对比</h1>
          <p className="text-sm text-muted-foreground">
            多传感器数据趋势对比与分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" />
            <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 传感器选择 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">传感器选择</CardTitle>
            <CardDescription className="text-sm">
              选择1-5个传感器进行对比
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {sensors.map((sensor) => (
                <div key={sensor.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={`sensor-${sensor.id}`}
                    checked={selectedSensors.includes(sensor.id)}
                    onCheckedChange={(checked) => {
                      if (checked && selectedSensors.length >= 5) {
                        alert('最多只能选择5个传感器')
                        return
                      }
                      if (checked) {
                        setSelectedSensors([...selectedSensors, sensor.id])
                      } else {
                        setSelectedSensors(selectedSensors.filter(id => id !== sensor.id))
                      }
                    }}
                  />
                  <Label htmlFor={`sensor-${sensor.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">{sensor.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sensor.type_name} · {sensor.location}
                    </div>
                  </Label>
                  <span className="text-xs font-medium">
                    {sensor.last_value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 时间范围选择 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">时间范围</CardTitle>
            <CardDescription className="text-sm">
              选择要对比的数据时间范围
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择时间范围" />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {timeRange === "custom" && (
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-sm">
                    开始日期
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="start-date"
                        className="w-[160px] justify-start text-left font-normal"
                      >
                        {customStartDate ? format(customStartDate, "yyyy-MM-dd") : "选择日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                        locale={zhCN}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date" className="text-sm">
                    结束日期
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="end-date"
                        className="w-[160px] justify-start text-left font-normal"
                      >
                        {customEndDate ? format(customEndDate, "yyyy-MM-dd") : "选择日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                        locale={zhCN}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <Button onClick={fetchCompareData} disabled={selectedSensors.length === 0 || loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              获取数据
            </Button>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData('csv')}
                disabled={selectedSensors.length === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                导出CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData('excel')}
                disabled={selectedSensors.length === 0}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                导出Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表显示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据对比图表</CardTitle>
          <CardDescription className="text-sm">
            多传感器数据趋势对比
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedSensors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
              <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">请选择要对比的传感器</p>
              <p className="text-sm">从左侧列表中选择1-5个传感器进行数据对比</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
              <RefreshCw className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">暂无数据</p>
              <p className="text-sm">请点击"获取数据"按钮加载数据</p>
            </div>
          ) : (
            <div className="h-[50vh] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={formatChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={[
                      (dataMin: number) => Math.floor(dataMin * 0.9),
                      (dataMax: number) => Math.ceil(dataMax * 1.1)
                    ]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [`${value}`, '数值']}
                    labelFormatter={(label) => `时间: ${label}`}
                  />
                  <Legend 
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                  {selectedSensors.map((sensorId, index) => {
                    const sensor = sensors.find(s => s.id === sensorId)
                    return (
                      <Line
                        key={sensorId}
                        type="monotone"
                        dataKey={sensorId}
                        name={sensor?.name || sensorId}
                        stroke={chartColors[index % chartColors.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ 
                          r: 6, 
                          stroke: chartColors[index % chartColors.length],
                          strokeWidth: 2,
                          fill: 'white'
                        }}
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-primary mt-0.5" />
            <p>最多可以选择5个传感器进行数据对比</p>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-primary mt-0.5" />
            <p>系统会自动对数据进行降噪处理，消除异常值和毛刺</p>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-primary mt-0.5" />
            <p>支持导出CSV和Excel格式的数据文件</p>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-primary mt-0.5" />
            <p>图表会自动调整Y轴范围，确保数据变化清晰可见</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
