"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
  Download,
  RefreshCw,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  FileText,
  TrendingUp,
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
import { ChartContainer } from "@/components/ui/chart"
import { ThemeToggle } from "@/components/theme-toggle"
import { format, subDays, subHours, subWeeks, subMonths, startOfDay, endOfDay } from "date-fns"
import { zhCN } from "date-fns/locale"

/**
 * 传感器数据接口
 */
interface Sensor {
  id: string
  name: string
  type: string
  type_name: string
  unit: string
  location: string
  status: string
}

/**
 * 传感器历史数据接口
 */
interface SensorDataPoint {
  timestamp: string
  [key: string]: string | number
}

/**
 * 时间范围选项
 */
const timeRangeOptions = [
  { label: "最近1小时", value: "1h", hours: 1 },
  { label: "最近6小时", value: "6h", hours: 6 },
  { label: "最近12小时", value: "12h", hours: 12 },
  { label: "最近24小时", value: "24h", hours: 24 },
  { label: "最近3天", value: "3d", days: 3 },
  { label: "最近7天", value: "7d", days: 7 },
  { label: "最近30天", value: "30d", days: 30 },
  { label: "自定义", value: "custom" },
]

/**
 * 图表颜色配置
 */
const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

/**
 * 数据对比页面组件
 * 支持多传感器选择、自定义时间范围、数据对比图表、CSV/Excel导出
 */
export default function ComparePage() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [selectedSensors, setSelectedSensors] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<string>("24h")
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()
  const [chartData, setChartData] = useState<SensorDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  /**
   * 获取所有传感器列表
   */
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const response = await fetch('/api/sensors')
        const result = await response.json()
        
        if (result.success && result.data) {
          setSensors(result.data)
        }
      } catch (error) {
        console.error('获取传感器列表失败:', error)
      }
    }
    
    fetchSensors()
  }, [])

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
        return {
          sensorId,
          data: result.success ? result.data : [],
        }
      })

      const results = await Promise.all(dataPromises)

      const mergedData: Map<string, SensorDataPoint> = new Map()

      results.forEach(({ sensorId, data }) => {
        data.forEach((point: any) => {
          const timeKey = format(new Date(point.timestamp), 'MM-dd HH:mm')
          
          if (!mergedData.has(timeKey)) {
            mergedData.set(timeKey, { timestamp: timeKey })
          }
          
          const existingPoint = mergedData.get(timeKey)!
          existingPoint[sensorId] = parseFloat(point.value.toFixed(2))
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
   * 自动刷新数据
   */
  useEffect(() => {
    if (selectedSensors.length > 0) {
      fetchCompareData()
      
      const interval = setInterval(fetchCompareData, 30000)
      
      return () => clearInterval(interval)
    }
  }, [selectedSensors, timeRange, customStartDate, customEndDate])

  /**
   * 切换传感器选择
   */
  const toggleSensor = (sensorId: string) => {
    setSelectedSensors(prev => 
      prev.includes(sensorId)
        ? prev.filter(id => id !== sensorId)
        : [...prev, sensorId]
    )
  }

  /**
   * 导出为CSV
   */
  const exportToCSV = () => {
    if (chartData.length === 0) {
      alert('没有数据可导出')
      return
    }

    const selectedSensorInfo = sensors.filter(s => selectedSensors.includes(s.id))
    
    const headers = ['时间', ...selectedSensorInfo.map(s => `${s.name}(${s.unit})`)]
    
    const rows = chartData.map(point => {
      const row = [point.timestamp]
      selectedSensorInfo.forEach(sensor => {
        row.push(point[sensor.id]?.toString() || '')
      })
      return row
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `传感器数据对比_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * 导出为Excel
   */
  const exportToExcel = () => {
    if (chartData.length === 0) {
      alert('没有数据可导出')
      return
    }

    const selectedSensorInfo = sensors.filter(s => selectedSensors.includes(s.id))
    
    const headers = ['时间', ...selectedSensorInfo.map(s => `${s.name}(${s.unit})`)]
    
    const rows = chartData.map(point => {
      const row = [point.timestamp]
      selectedSensorInfo.forEach(sensor => {
        row.push(point[sensor.id]?.toString() || '')
      })
      return row
    })

    const tableData = [headers, ...rows]
    
    const worksheet = tableData.map(row => row.join('\t')).join('\n')
    
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + worksheet], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `传感器数据对比_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xls`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * 获取传感器类型颜色
   */
  const getSensorColor = (type: string) => {
    const colorMap: Record<string, string> = {
      temperature: "bg-chart-4/20 text-chart-4",
      humidity: "bg-chart-2/20 text-chart-2",
      light: "bg-chart-3/20 text-chart-3",
      soil: "bg-primary/20 text-primary",
      soil_temperature: "bg-chart-5/20 text-chart-5",
      ec: "bg-chart-1/20 text-chart-1",
      ph: "bg-chart-2/20 text-chart-2",
    }
    return colorMap[type] || "bg-muted text-muted-foreground"
  }

  /**
   * 格式化图表数据点
   */
  const formatChartData = chartData.map(point => {
    const formatted: any = { timestamp: point.timestamp }
    selectedSensors.forEach(sensorId => {
      if (point[sensorId] !== undefined) {
        formatted[sensorId] = point[sensorId]
      }
    })
    return formatted
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">数据对比分析</h1>
              <p className="text-sm text-muted-foreground">
                多传感器数据对比、趋势分析和数据导出
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">选择传感器</CardTitle>
              <CardDescription>
                选择要对比的传感器（最多5个）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {sensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={sensor.id}
                      checked={selectedSensors.includes(sensor.id)}
                      onCheckedChange={() => toggleSensor(sensor.id)}
                      disabled={
                        !selectedSensors.includes(sensor.id) && 
                        selectedSensors.length >= 5
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={sensor.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {sensor.name}
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getSensorColor(sensor.type)}`}
                        >
                          {sensor.type_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {sensor.location}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  已选择 {selectedSensors.length}/5 个传感器
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">时间范围</CardTitle>
                    <CardDescription>
                      选择数据查询的时间范围
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3" />
                    <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
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
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-[200px] justify-start text-left font-normal ${
                              !customStartDate && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customStartDate ? (
                              format(customStartDate, "PPP", { locale: zhCN })
                            ) : (
                              <span>开始日期</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customStartDate}
                            onSelect={setCustomStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground">至</span>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-[200px] justify-start text-left font-normal ${
                              !customEndDate && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customEndDate ? (
                              format(customEndDate, "PPP", { locale: zhCN })
                            ) : (
                              <span>结束日期</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customEndDate}
                            onSelect={setCustomEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <Button
                    onClick={fetchCompareData}
                    disabled={selectedSensors.length === 0 || loading}
                    size="sm"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    刷新数据
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">数据对比图表</CardTitle>
                    <CardDescription>
                      多传感器数据趋势对比
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={exportToCSV}
                      disabled={chartData.length === 0}
                      size="sm"
                      variant="outline"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      导出CSV
                    </Button>
                    <Button
                      onClick={exportToExcel}
                      disabled={chartData.length === 0}
                      size="sm"
                      variant="outline"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      导出Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedSensors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                    <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">请选择要对比的传感器</p>
                    <p className="text-sm">从左侧列表中选择1-5个传感器进行数据对比</p>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                    <p className="text-lg font-medium">暂无数据</p>
                    <p className="text-sm">所选时间范围内没有数据记录</p>
                  </div>
                ) : (
                  <ChartContainer
                    config={Object.fromEntries(
                      selectedSensors.map((id, index) => [
                        id,
                        {
                          label: sensors.find(s => s.id === id)?.name || id,
                          color: chartColors[index % chartColors.length],
                        },
                      ])
                    )}
                    className="h-[400px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formatChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="timestamp" 
                          className="text-xs"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          className="text-xs"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        {selectedSensors.map((sensorId, index) => (
                          <Line
                            key={sensorId}
                            type="monotone"
                            dataKey={sensorId}
                            name={sensors.find(s => s.id === sensorId)?.name || sensorId}
                            stroke={chartColors[index % chartColors.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">数据明细</CardTitle>
                  <CardDescription>
                    查看详细数据记录
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          {selectedSensors.map(sensorId => {
                            const sensor = sensors.find(s => s.id === sensorId)
                            return (
                              <TableHead key={sensorId}>
                                {sensor?.name} ({sensor?.unit})
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.slice(0, 20).map((point, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {point.timestamp}
                            </TableCell>
                            {selectedSensors.map(sensorId => (
                              <TableCell key={sensorId}>
                                {point[sensorId] !== undefined 
                                  ? point[sensorId] 
                                  : '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {chartData.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      显示前20条记录，共 {chartData.length} 条记录
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
