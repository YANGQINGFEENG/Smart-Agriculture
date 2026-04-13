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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchSensorData = async () => {
    try {
      const response = await fetch('/api/sensors')
      const result = await response.json()
      
      if (result.success && result.data) {
        const dataPromises = result.data.map(async (sensor: SensorInfo) => {
          const dataResponse = await fetch(`/api/sensors/${sensor.id}/data?limit=1`)
          const dataResult = await dataResponse.json()
          
          const latestData = dataResult.data?.[0] as SensorDataPoint | undefined
          
          const now = new Date()
          const lastUpdate = sensor.last_update ? new Date(sensor.last_update) : null
          const timeDiff = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 1000 / 60) : 999
          
          let status = '离线'
          if (sensor.status === 'online') {
            if (timeDiff < 5) {
              status = '正常'
            } else if (timeDiff < 30) {
              status = '延迟'
            } else {
              status = '异常'
            }
          }
          
          const formatValue = (value: number, type: string): string => {
            if (type === 'light') {
              return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} Lux`
            } else if (type === 'ec') {
              return `${value.toFixed(0)} μS/cm`
            } else if (type === 'ph') {
              return `${value.toFixed(2)} pH`
            } else {
              return `${value.toFixed(1)} ${sensor.unit}`
            }
          }
          
          return {
            id: sensor.id,
            name: sensor.name,
            type: sensor.type,
            type_name: sensor.type_name,
            value: latestData ? formatValue(latestData.value, sensor.type) : '--',
            location: sensor.location,
            time: latestData 
              ? new Date(latestData.timestamp).toLocaleString('zh-CN')
              : '暂无数据',
            status: status,
            unit: sensor.unit,
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
              <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
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
                      <TableCell className="font-medium text-foreground">{item.value}</TableCell>
                      <TableCell className="text-muted-foreground">{item.location}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.time}</TableCell>
                      <TableCell>
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
