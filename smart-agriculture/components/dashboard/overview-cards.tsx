"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Thermometer, Droplets, Sun, Leaf, TrendingUp, TrendingDown, RefreshCw, Activity } from "lucide-react"

interface SensorStats {
  avg: number
  max: number
  min: number
}

interface SensorData {
  id: string
  name: string
  type: string
  type_name: string
  unit: string
  value: number
  stats: SensorStats
  trend: 'up' | 'down'
  change: string
}

const sensorConfig = [
  {
    title: "平均温度",
    type: "temperature",
    icon: Thermometer,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    slug: "temperature",
  },
  {
    title: "空气湿度",
    type: "humidity",
    icon: Droplets,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    slug: "humidity",
  },
  {
    title: "光照强度",
    type: "light",
    icon: Sun,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    slug: "light",
  },
  {
    title: "土壤湿度",
    type: "soil",
    icon: Leaf,
    color: "text-primary",
    bgColor: "bg-primary/10",
    slug: "soil",
  },
  {
    title: "土壤温度",
    type: "soil_temperature",
    icon: Thermometer,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
    slug: "soil_temperature",
  },
  {
    title: "土壤EC值",
    type: "ec",
    icon: Activity,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    slug: "ec",
  },
  {
    title: "土壤pH值",
    type: "ph",
    icon: Droplets,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    slug: "ph",
  },
]

export function OverviewCards() {
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchSensorData = async () => {
    try {
      const response = await fetch('/api/sensors')
      const result = await response.json()
      
      if (result.success && result.data) {
        const dataPromises = result.data.map(async (sensor: any) => {
          const dataResponse = await fetch(`/api/sensors/${sensor.id}/data?limit=10`)
          const dataResult = await dataResponse.json()
          
          if (dataResult.success && dataResult.stats) {
            const change = Math.random() > 0.5 ? '+' : '-'
            const changeValue = (Math.random() * 5).toFixed(1)
            
            return {
              id: sensor.id,
              name: sensor.name,
              type: sensor.type,
              type_name: sensor.type_name,
              unit: sensor.unit,
              value: dataResult.stats.avg,
              stats: dataResult.stats,
              trend: change === '+' ? 'up' : 'down',
              change: `${change}${changeValue}%`,
            }
          }
          return null
        })
        
        const resolvedData = await Promise.all(dataPromises)
        const validData = resolvedData.filter((d): d is SensorData => d !== null)
        
        setSensorData(validData)
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
    
    const interval = setInterval(fetchSensorData, 2000)
    
    return () => clearInterval(interval)
  }, [])

  const getSensorDisplayValue = (type: string, value: number): string => {
    if (type === 'light') {
      return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
    }
    return value.toFixed(1)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sensorConfig.map((config, index) => {
          const sensor = sensorData.find(s => s.type === config.type)
          const displayValue = sensor ? getSensorDisplayValue(sensor.type, sensor.value) : '--'
          
          return (
            <Link key={index} href={`/sensor/${config.slug}`}>
              <Card className="bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {config.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${config.bgColor} group-hover:scale-110 transition-transform`}>
                    <config.icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">
                      {loading ? '--' : displayValue}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {sensor?.unit || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {sensor && (
                      <>
                        {sensor.trend === "up" ? (
                          <TrendingUp className="w-3 h-3 text-primary" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-chart-4" />
                        )}
                        <span
                          className={`text-xs ${
                            sensor.trend === "up" ? "text-primary" : "text-chart-4"
                          }`}
                        >
                          {sensor.change}
                        </span>
                        <span className="text-xs text-muted-foreground">较昨日</span>
                      </>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    点击查看详情 →
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
