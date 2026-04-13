"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { AlertTriangle, Save, X, Check } from "lucide-react"

interface Sensor {
  id: string
  name: string
  type: string
  type_name: string
  unit: string
}

interface Threshold {
  sensor_id: string
  min_value: number | null
  max_value: number | null
}

interface SensorWithThreshold extends Sensor {
  threshold: Threshold
}

export function ThresholdSettings() {
  const [sensors, setSensors] = useState<SensorWithThreshold[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSensor, setEditingSensor] = useState<string | null>(null)
  const [editedThresholds, setEditedThresholds] = useState<Record<string, { min_value: number | null; max_value: number | null }>>({})

  // 获取传感器列表和阈值设置
  const fetchSensorsWithThresholds = async () => {
    try {
      setLoading(true)
      
      // 获取传感器列表
      const sensorsResponse = await fetch('/api/sensors')
      const sensorsData = await sensorsResponse.json()
      
      if (sensorsData.success && sensorsData.data) {
        // 获取所有阈值设置
        const thresholdsResponse = await fetch('/api/sensors/thresholds')
        const thresholdsData = await thresholdsResponse.json()
        
        if (thresholdsData.success && thresholdsData.data) {
          const thresholdsMap = new Map(thresholdsData.data.map((t: Threshold) => [t.sensor_id, t]))
          
          const sensorsWithThresholds = sensorsData.data.map((sensor: Sensor) => ({
            ...sensor,
            threshold: thresholdsMap.get(sensor.id) || { sensor_id: sensor.id, min_value: null, max_value: null }
          }))
          
          setSensors(sensorsWithThresholds)
        }
      }
    } catch (error) {
      console.error('获取传感器和阈值设置失败:', error)
      toast.error('获取传感器和阈值设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 开始编辑阈值
  const startEditing = (sensorId: string) => {
    const sensor = sensors.find(s => s.id === sensorId)
    if (sensor) {
      setEditingSensor(sensorId)
      setEditedThresholds(prev => ({
        ...prev,
        [sensorId]: { ...sensor.threshold }
      }))
    }
  }

  // 取消编辑
  const cancelEditing = () => {
    setEditingSensor(null)
    setEditedThresholds({})
  }

  // 保存阈值设置
  const saveThresholds = async (sensorId: string) => {
    try {
      const threshold = editedThresholds[sensorId]
      if (!threshold) return

      const response = await fetch('/api/sensors/thresholds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sensor_id: sensorId,
          min_value: threshold.min_value,
          max_value: threshold.max_value
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('阈值设置保存成功')
        fetchSensorsWithThresholds()
        setEditingSensor(null)
        setEditedThresholds({})
      } else {
        toast.error('阈值设置保存失败: ' + data.error)
      }
    } catch (error) {
      console.error('保存阈值设置失败:', error)
      toast.error('保存阈值设置失败')
    }
  }

  // 处理阈值输入变化
  const handleThresholdChange = (sensorId: string, field: 'min_value' | 'max_value', value: string) => {
    setEditedThresholds(prev => ({
      ...prev,
      [sensorId]: {
        ...prev[sensorId],
        [field]: value === '' ? null : parseFloat(value)
      }
    }))
  }

  // 检查值是否在阈值范围内
  const checkValueInRange = (value: number, min: number | null, max: number | null) => {
    if (min !== null && value < min) return 'below'
    if (max !== null && value > max) return 'above'
    return 'normal'
  }

  useEffect(() => {
    fetchSensorsWithThresholds()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>传感器阈值设置</CardTitle>
        <CardDescription>设置传感器的正常范围阈值，超出范围将触发预警</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>传感器名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>最小值</TableHead>
              <TableHead>最大值</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sensors.map((sensor) => (
              <TableRow key={sensor.id}>
                <TableCell>{sensor.name}</TableCell>
                <TableCell>{sensor.type_name}</TableCell>
                <TableCell>
                  {editingSensor === sensor.id ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={editedThresholds[sensor.id]?.min_value || ''}
                      onChange={(e) => handleThresholdChange(sensor.id, 'min_value', e.target.value)}
                      className="w-24"
                    />
                  ) : (
                    <span>{sensor.threshold.min_value !== null ? sensor.threshold.min_value : '--'} {sensor.unit}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingSensor === sensor.id ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={editedThresholds[sensor.id]?.max_value || ''}
                      onChange={(e) => handleThresholdChange(sensor.id, 'max_value', e.target.value)}
                      className="w-24"
                    />
                  ) : (
                    <span>{sensor.threshold.max_value !== null ? sensor.threshold.max_value : '--'} {sensor.unit}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingSensor === sensor.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveThresholds(sensor.id)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={cancelEditing}
                      >
                        <X className="w-4 h-4 mr-1" />
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startEditing(sensor.id)}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
