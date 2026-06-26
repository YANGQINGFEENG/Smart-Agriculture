"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Filter, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

interface SensorInfo {
  id: string
  name: string
  type: string
  type_name: string
  unit: string
  status: string
  location: string
  last_update: string | null
}

interface SensorDataPoint {
  id: number
  sensor_id: string
  value: number
  timestamp: string
}

interface TableData {
  id: string
  name: string
  type: string
  type_name: string
  value: string
  valueColor: string
  location: string
  time: string
  status: string
  unit: string
}

export function DetailedData() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sensorData, setSensorData] = useState<TableData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return '暂无数据'
    
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) return `${diffSeconds}秒前`
    if (diffMinutes < 60) return `${diffMinutes}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    return date.toLocaleDateString('zh-CN')
  }

  const getStatusFromTime = (dateStr: string | null, onlineStatus: string): string => {
    if (onlineStatus !== 'online') return '离线'
    if (!dateStr) return '离线'
    
    const date = new Date(dateStr)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60)
    
    if (diffMinutes < 5) return '正常'
    if (diffMinutes < 30) return '延迟'
    return '异常'
  }

  const fetchSensorData = async () => {
    try {
      const response = await fetch('/api/sensors')
      const result = await response.json()
      
      if (result.success && result.data) {
        const dataPromises = result.data.map(async (sensor: any) => {
          try {
            const dataResponse = await fetch(`/api/sensors/${sensor.id}/data?limit=1`)
            const dataResult = await dataResponse.json()
            const latestData = dataResult.data?.[0]
            
            const updateTime = latestData?.timestamp || sensor.last_update
            const status = getStatusFromTime(updateTime, sensor.status)
            
            const formatValue = (value: any, type: string): string => {
              const numValue = typeof value === 'string' ? parseFloat(value) : value
              if (isNaN(numValue)) return '--'
              
              if (type === 'light') {
                return `${numValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} Lux`
              } else if (type === 'ec') {
                return `${numValue.toFixed(0)} μS/cm`
              } else if (type === 'ph') {
                return `${numValue.toFixed(2)} pH`
              } else {
                return `${numValue.toFixed(1)} ${sensor.unit || ''}`
              }
            }
            
            const getValueColor = (value: any, type: string): string => {
              const numValue = typeof value === 'string' ? parseFloat(value) : value
              if (isNaN(numValue)) return 'text-muted-foreground'
              
              if (type === 'temperature') {
                if (numValue > 30) return 'text-chart-4';
                if (numValue < 10) return 'text-chart-2';
                return 'text-foreground';
              } else if (type === 'humidity' || type === 'soil') {
                if (numValue > 80) return 'text-chart-4';
                if (numValue < 30) return 'text-chart-4';
                return 'text-foreground';
              } else if (type === 'light') {
                if (numValue > 10000) return 'text-chart-3';
                if (numValue < 1000) return 'text-chart-2';
                return 'text-foreground';
              } else if (type === 'ph') {
                if (numValue > 7.5 || numValue < 5.5) return 'text-chart-4';
                return 'text-foreground';
              }
              return 'text-foreground';
            };

            return {
              id: sensor.id,
              name: sensor.name,
              type: sensor.type || 'unknown',
              type_name: sensor.type_name || '未知类型',
              value: latestData ? formatValue(latestData.value, sensor.type || 'unknown') : '--',
              valueColor: latestData ? getValueColor(latestData.value, sensor.type || 'unknown') : 'text-muted-foreground',
              location: sensor.location,
              time: formatRelativeTime(updateTime),
              status: status,
              unit: sensor.unit || '',
            }
          } catch (error) {
            return {
              id: sensor.id,
              name: sensor.name,
              type: sensor.type || 'unknown',
              type_name: sensor.type_name || '未知类型',
              value: '--',
              valueColor: 'text-muted-foreground',
              location: sensor.location,
              time: '暂无数据',
              status: '离线',
              unit: sensor.unit || '',
            }
          }
        })
        
        const resolvedData = await Promise.all(dataPromises)
        setSensorData(resolvedData)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('获取传感器数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLastUpdate(new Date())
    fetchSensorData()
    
    const interval = setInterval(fetchSensorData, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const filteredData = sensorData.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === "all" || item.type === filterType
    return matchesSearch && matchesFilter
  })

  const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      'temperature': '温度',
      'humidity': '湿度',
      'light': '光照',
      'soil': '土壤',
      'soil_temperature': '土壤温度',
      'ec': '电导率',
      'ph': 'pH值',
    }
    return typeMap[type] || type
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span>精细数据查看</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              <span>最后更新: {lastUpdate ? lastUpdate.toLocaleTimeString('zh-CN') : '--:--:--'}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索传感器..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[200px] bg-secondary border-border"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px] bg-secondary border-border">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="筛选类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="temperature">温度</SelectItem>
                <SelectItem value="humidity">湿度</SelectItem>
                <SelectItem value="light">光照</SelectItem>
                <SelectItem value="soil">土壤湿度</SelectItem>
                <SelectItem value="soil_temperature">土壤温度</SelectItem>
                <SelectItem value="ec">电导率</SelectItem>
                <SelectItem value="ph">pH值</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-secondary border-border"
              onClick={fetchSensorData}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="text-muted-foreground">传感器ID</TableHead>
                    <TableHead className="text-muted-foreground">名称</TableHead>
                    <TableHead className="text-muted-foreground">类型</TableHead>
                    <TableHead className="text-muted-foreground">当前数值</TableHead>
                    <TableHead className="text-muted-foreground">位置</TableHead>
                    <TableHead className="text-muted-foreground">更新时间</TableHead>
                    <TableHead className="text-muted-foreground">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-secondary/30">
                      <TableCell className="font-mono text-sm text-foreground">{item.id}</TableCell>
                      <TableCell className="text-foreground">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-muted-foreground">
                          {getTypeLabel(item.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-medium ${item.valueColor}`}>{item.value}</TableCell>
                      <TableCell className="text-muted-foreground">{item.location}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.time}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`
                            w-2 h-2 rounded-full
                            ${item.status === "正常" ? "bg-primary" :
                              item.status === "延迟" ? "bg-chart-3" :
                              item.status === "异常" ? "bg-chart-4" :
                              "bg-destructive"}
                          `} />
                          <Badge
                            className={
                              item.status === "正常"
                                ? "bg-primary/20 text-primary hover:bg-primary/30"
                                : item.status === "延迟"
                                ? "bg-chart-3/20 text-chart-3 hover:bg-chart-3/30"
                                : item.status === "异常"
                                ? "bg-chart-4/20 text-chart-4 hover:bg-chart-4/30"
                                : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                显示 {filteredData.length} 条记录，共 {sensorData.length} 条
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="bg-secondary border-border">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">第 1 页</span>
                <Button variant="outline" size="sm" className="bg-secondary border-border">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
