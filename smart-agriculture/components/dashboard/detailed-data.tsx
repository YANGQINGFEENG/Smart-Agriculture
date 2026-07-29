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
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Trash2,
  Save,
  X,
  AlertCircle,
  Lock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

/**
 * 可编辑字段配置
 */
const editableFields: Record<string, { editable: boolean; label: string; type: 'text' | 'select' }> = {
  id: { editable: false, label: '传感器ID', type: 'text' },
  name: { editable: true, label: '名称', type: 'text' },
  type: { editable: false, label: '类型', type: 'text' },
  value: { editable: false, label: '当前数值', type: 'text' },
  location: { editable: true, label: '位置', type: 'text' },
  time: { editable: false, label: '更新时间', type: 'text' },
  status: { editable: false, label: '状态', type: 'text' },
}

export function DetailedData() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sensorData, setSensorData] = useState<TableData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const { toast } = useToast()

  // 编辑状态管理：{ sensorId_fieldName: { value, original } }
  const [editingCell, setEditingCell] = useState<{ 
    sensorId: string 
    field: string 
    value: string 
    original: string 
  } | null>(null)

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

  /**
   * 删除传感器
   */
  const handleDeleteSensor = async (id: string) => {
    if (!confirm("确定要删除这个传感器吗？此操作将删除所有相关数据。")) return
    
    try {
      const response = await fetch(`/api/sensors/${id}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        fetchSensorData()
        toast({
          title: '删除成功',
          description: '传感器已成功删除',
          variant: 'default',
        })
      } else {
        const result = await response.json()
        toast({
          title: '删除失败',
          description: result.error || '未知错误',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('删除传感器失败:', error)
      toast({
        title: '删除失败',
        description: (error as Error).message,
        variant: 'destructive',
      })
    }
  }

  /**
   * 处理双击表格单元格
   */
  const handleDoubleClick = (sensorId: string, field: string, value: string) => {
    const fieldConfig = editableFields[field]
    
    if (!fieldConfig?.editable) {
      toast({
        title: '无法编辑',
        description: `${fieldConfig?.label || field}字段不支持编辑`,
        variant: 'destructive',
        duration: 2000,
      })
      return
    }

    if (editingCell && (editingCell.sensorId !== sensorId || editingCell.field !== field)) {
      // 取消之前的编辑
      setEditingCell(null)
    }

    setEditingCell({
      sensorId,
      field,
      value: String(value),
      original: String(value),
    })
  }

  /**
   * 保存编辑内容
   */
  const handleSaveEdit = async () => {
    if (!editingCell) return
    
    const { sensorId, field, value, original } = editingCell
    
    if (value.trim() === original.trim()) {
      setEditingCell(null)
      return
    }

    if (!value.trim()) {
      toast({
        title: '输入无效',
        description: `${editableFields[field]?.label || field}不能为空`,
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch(`/api/sensors/${sensorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value.trim() }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '更新成功',
          description: `${editableFields[field]?.label || field}已更新`,
          variant: 'default',
        })
        fetchSensorData()
      } else {
        toast({
          title: '更新失败',
          description: result.error || '未知错误',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('更新传感器失败:', error)
      toast({
        title: '更新失败',
        description: (error as Error).message,
        variant: 'destructive',
      })
    }

    setEditingCell(null)
  }

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingCell(null)
  }

  /**
   * 处理输入框回车保存
   */
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
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
            {/* 编辑提示 */}
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3 h-3" />
              <span>双击表格字段可编辑（名称、位置），其他字段不支持编辑</span>
            </div>
            
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
                    <TableHead className="text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-secondary/30">
                      {/* 传感器ID - 不可编辑 */}
                      <TableCell className="font-mono text-sm text-foreground">
                        {item.id}
                      </TableCell>
                      
                      {/* 名称 - 可编辑 */}
                      <TableCell className="text-foreground">
                        {editingCell?.sensorId === item.id && editingCell?.field === 'name' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                              onKeyDown={handleInputKeyDown}
                              className="w-32"
                            />
                            <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSaveEdit}>
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:text-primary hover:underline"
                            onDoubleClick={() => handleDoubleClick(item.id, 'name', item.name)}
                          >
                            {item.name}
                          </span>
                        )}
                      </TableCell>
                      
                      {/* 类型 - 不可编辑 */}
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-muted-foreground">
                          {getTypeLabel(item.type)}
                        </Badge>
                      </TableCell>
                      
                      {/* 当前数值 - 不可编辑 */}
                      <TableCell className={`font-medium ${item.valueColor}`}>
                        {item.value}
                      </TableCell>
                      
                      {/* 位置 - 可编辑 */}
                      <TableCell className="text-muted-foreground">
                        {editingCell?.sensorId === item.id && editingCell?.field === 'location' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                              onKeyDown={handleInputKeyDown}
                              className="w-32"
                            />
                            <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSaveEdit}>
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleCancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:text-primary hover:underline"
                            onDoubleClick={() => handleDoubleClick(item.id, 'location', item.location)}
                          >
                            {item.location}
                          </span>
                        )}
                      </TableCell>
                      
                      {/* 更新时间 - 不可编辑 */}
                      <TableCell className="text-muted-foreground text-sm">
                        {item.time}
                      </TableCell>
                      
                      {/* 状态 - 不可编辑 */}
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
                      
                      {/* 操作 */}
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSensor(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
