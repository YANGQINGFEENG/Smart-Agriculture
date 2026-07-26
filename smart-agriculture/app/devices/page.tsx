"use client"

import { useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { useFarm } from "@/lib/farm-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  RefreshCw,
  Plus,
  Wifi,
  Router,
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  MapPin,
  Loader2,
  Trash2,
  Signal,
  SignalZero,
  Search,
  Zap,
  Wind,
  Flame,
  CircleDot,
  Lightbulb,
  Fan,
  CloudRain,
  Waves,
  Battery,
  Cloud,
  Activity,
  ChevronRight,
  Grid3X3,
  List,
  HelpCircle,
} from "lucide-react"
import { getSensorTypes, getActuatorTypes, isUnassignedType } from "@/lib/device-types"

interface Gateway {
  id: number
  farm_id: number
  zone_id: number | null
  name: string
  gateway_type: string
  ip_address: string | null
  mac_address: string | null
  protocol: string | null
  status: string
  last_heartbeat: string | null
  created_at: string
  nodes?: DeviceNode[]
}

interface DeviceNode {
  id: number
  gateway_id: number
  node_id: string
  name: string
  node_type: 'sensor' | 'actuator'
  sensor_type: string | null
  location: string | null
  status: string
  last_update: string | null
  value?: number
  unit?: string
  battery?: number
  signal_strength?: number
  state?: 'on' | 'off'
  mode?: 'auto' | 'manual'
}

const gatewayTypeOptions = [
  { value: "wifi_sensor", label: "WiFi传感器（独立IP）" },
  { value: "lorawan_gateway", label: "LoRa网关" },
  { value: "serial_gateway", label: "串口网关（RS485）" },
  { value: "zigbee_gateway", label: "Zigbee网关" },
  { value: "bluetooth_gateway", label: "蓝牙网关" },
]

const protocolOptions = [
  { value: "mqtt", label: "MQTT" },
  { value: "http", label: "HTTP" },
  { value: "lorawan", label: "LoRaWAN" },
  { value: "zigbee", label: "Zigbee" },
  { value: "bluetooth", label: "Bluetooth" },
]

const iconMap: Record<string, any> = {
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  Zap,
  Wind,
  Flame,
  CircleDot,
  Lightbulb,
  Fan,
  CloudRain,
  Waves,
  Battery,
  Cloud,
  Activity,
}

export default function DevicesPage() {
  const { farms, selectedFarmId } = useFarm()
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [showGatewayDialog, setShowGatewayDialog] = useState(false)
  const [showNodeDialog, setShowNodeDialog] = useState(false)
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [viewMode, setViewMode] = useState<string>("gateway")

  const [gatewayForm, setGatewayForm] = useState({
    name: "",
    gateway_type: "wifi_sensor",
    ip_address: "",
    mac_address: "",
    protocol: "mqtt",
  })

  const [nodeForm, setNodeForm] = useState({
    node_id: "",
    name: "",
    node_type: "sensor",
    sensor_type: "temperature",
    actuator_type: "water_pump",
    location: "",
  })

  const sensorTypes = getSensorTypes()
  const actuatorTypes = getActuatorTypes()

  const fetchGateways = async () => {
    if (!selectedFarmId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/gateways?farm_id=${selectedFarmId}`)
      const result = await response.json()
      if (result.success) setGateways(result.data)
    } catch (error) {
      console.error("获取网关列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGateways() }, [selectedFarmId])

  const handleCreateGateway = async () => {
    try {
      const response = await fetch('/api/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gatewayForm,
          farm_id: selectedFarmId,
        }),
      })
      if (response.ok) {
        setShowGatewayDialog(false)
        fetchGateways()
        setGatewayForm({ name: "", gateway_type: "wifi_sensor", ip_address: "", mac_address: "", protocol: "mqtt" })
      }
    } catch (error) {
      console.error("创建网关失败:", error)
    }
  }

  const handleCreateNode = async () => {
    if (!selectedGateway) return
    try {
      const type = nodeForm.node_type === 'sensor' ? nodeForm.sensor_type : nodeForm.actuator_type

      const response = await fetch('/api/device-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeForm.node_id,
          name: nodeForm.name,
          node_type: nodeForm.node_type,
          sensor_type: type,
          location: nodeForm.location,
          gateway_id: selectedGateway.id,
        }),
      })
      if (response.ok) {
        setShowNodeDialog(false)
        fetchGateways()
        setNodeForm({
          node_id: "",
          name: "",
          node_type: "sensor",
          sensor_type: "temperature",
          actuator_type: "water_pump",
          location: ""
        })
      }
    } catch (error) {
      console.error("创建设备节点失败:", error)
    }
  }

  const handleDeleteGateway = async (id: number) => {
    if (!confirm("确定要删除这个网关吗？")) return
    try {
      await fetch(`/api/gateways/${id}`, { method: 'DELETE' })
      fetchGateways()
    } catch (error) {
      console.error("删除网关失败:", error)
    }
  }

  const getDeviceConfig = (type: string) => {
    return sensorTypes.find(t => t.type === type) || actuatorTypes.find(t => t.type === type)
  }

  const getAllNodes = (): DeviceNode[] => {
    return gateways.flatMap(gw => gw.nodes || [])
  }

  const getFilteredNodes = (): DeviceNode[] => {
    let nodes = getAllNodes()

    if (filterCategory !== 'all') {
      nodes = nodes.filter(n => n.node_type === filterCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      nodes = nodes.filter(n =>
        n.name.toLowerCase().includes(query) ||
        n.node_id.toLowerCase().includes(query) ||
        (n.sensor_type && n.sensor_type.toLowerCase().includes(query))
      )
    }

    return nodes
  }

  const getNodesGroupedByType = () => {
    const nodes = getFilteredNodes()
    const groups: Record<string, DeviceNode[]> = {}

    nodes.forEach(node => {
      const type = node.sensor_type || 'unknown'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(node)
    })

    return groups
  }

  // 获取未分配设备
  const getUnassignedNodes = (): DeviceNode[] => {
    return getAllNodes().filter(node => {
      if (!node.sensor_type) return true
      return isUnassignedType(node.sensor_type)
    })
  }

  // 按地点分组未分配设备
  const getUnassignedNodesGroupedByLocation = () => {
    const nodes = getUnassignedNodes()
    const groups: Record<string, DeviceNode[]> = {}

    nodes.forEach(node => {
      const location = node.location || '未指定位置'
      if (!groups[location]) {
        groups[location] = []
      }
      groups[location].push(node)
    })

    return groups
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '未知'
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getBatteryColor = (level: number | undefined) => {
    if (!level) return 'text-gray-400'
    if (level >= 80) return 'text-green-500'
    if (level >= 50) return 'text-yellow-500'
    if (level >= 20) return 'text-orange-500'
    return 'text-red-500'
  }

  const getSignalColor = (strength: number | undefined) => {
    if (!strength) return 'text-gray-400'
    if (strength >= 70) return 'text-green-500'
    if (strength >= 40) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="devices" onTabChange={() => { }} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="devices" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Router className="h-6 w-6" />
                  设备管理
                </h1>
                <p className="text-muted-foreground">
                  {farms.find(f => f.id === selectedFarmId)?.name || '未选择基地'}
                  {viewMode === 'gateway' && ` · 共 ${gateways.length} 个网关`}
                  {viewMode !== 'gateway' && ` · 共 ${getFilteredNodes().length} 个设备`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchGateways}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                {viewMode === 'gateway' && (
                  <Button size="sm" onClick={() => setShowGatewayDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    添加网关
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={viewMode === 'gateway' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('gateway')}
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                网关视图
              </Button>
              <Button
                variant={viewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('all')}
              >
                <List className="h-4 w-4 mr-1" />
                所有设备
              </Button>
              <Button
                variant={viewMode === 'sensor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('sensor')}
              >
                <Thermometer className="h-4 w-4 mr-1" />
                传感器
              </Button>
              <Button
                variant={viewMode === 'actuator' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('actuator')}
              >
                <Zap className="h-4 w-4 mr-1" />
                执行器
              </Button>
              <Button
                variant={viewMode === 'unassigned' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('unassigned')}
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                未分配
              </Button>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  设备数据上报流程
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-700">
                  <div>
                    <p className="font-medium">场景1：独立传感器</p>
                    <p>传感器 → 独立IP → 服务器 → 自动分类注册</p>
                  </div>
                  <div>
                    <p className="font-medium">场景2：网关聚合上报</p>
                    <p>多设备 → 网关 → 服务器 → 自动同步到对应表</p>
                  </div>
                  <div>
                    <p className="font-medium">场景3：执行器上报</p>
                    <p>执行器 → 状态上报 → 服务器 → actuator表</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col md:flx-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索设备名称或ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {viewMode === 'gateway' && (
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="网关类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {gatewayTypeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {viewMode !== 'gateway' && (
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="设备类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类别</SelectItem>
                    <SelectItem value="sensor">传感器</SelectItem>
                    <SelectItem value="actuator">执行器</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {viewMode === 'gateway' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : gateways.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Router className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">暂无网关设备</p>
                    <p className="text-sm">点击"添加网关"开始配置</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gateways.map((gateway) => {
                      const sensorCount = gateway.nodes?.filter(n => n.node_type === 'sensor').length || 0
                      const actuatorCount = gateway.nodes?.filter(n => n.node_type === 'actuator').length || 0

                      return (
                        <Card key={gateway.id} className={selectedGateway?.id === gateway.id ? 'ring-2 ring-primary' : ''}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${gateway.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}>
                                  {gateway.status === 'online' ? (
                                    <Signal className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <SignalZero className="h-5 w-5 text-gray-400" />
                                  )}
                                </div>
                                <div>
                                  <CardTitle className="text-base">{gateway.name}</CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    {gatewayTypeOptions.find(t => t.value === gateway.gateway_type)?.label}
                                    {gateway.ip_address && ` · ${gateway.ip_address}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={gateway.status === 'online' ? 'default' : 'secondary'}>
                                  {gateway.status === 'online' ? '在线' : '离线'}
                                </Badge>
                                {sensorCount > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <Thermometer className="h-3 w-3 mr-1" />
                                    {sensorCount}传感器
                                  </Badge>
                                )}
                                {actuatorCount > 0 && (
                                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                    <Zap className="h-3 w-3 mr-1" />
                                    {actuatorCount}执行器
                                  </Badge>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setSelectedGateway(gateway)
                                  setShowNodeDialog(true)
                                }}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteGateway(gateway.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {gateway.nodes && gateway.nodes.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {gateway.nodes.map((node) => {
                                  const deviceConfig = getDeviceConfig(node.sensor_type || '')
                                  const IconComponent = deviceConfig ? iconMap[deviceConfig.icon] || Thermometer : Thermometer
                                  const isActuator = node.node_type === 'actuator'

                                  return (
                                    <div
                                      key={node.id}
                                      className={`flex items-center gap-3 p-3 rounded-lg ${isActuator ? 'bg-yellow-50 border border-yellow-100' : 'bg-muted/50'
                                        }`}
                                    >
                                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActuator ? 'bg-yellow-100 text-yellow-600' : 'bg-primary/10 text-primary'
                                        }`}>
                                        <IconComponent className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{node.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {node.node_id}
                                          {node.location && ` · ${node.location}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {deviceConfig?.name || node.sensor_type}
                                          {deviceConfig?.unit && ` (${deviceConfig.unit})`}
                                        </p>
                                        {!isActuator && node.value !== undefined && (
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-lg font-bold text-primary">
                                              {node.value}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                              {node.unit}
                                            </span>
                                          </div>
                                        )}
                                        {isActuator && (
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant={node.state === 'on' ? 'default' : 'outline'} className="text-xs">
                                              {node.state === 'on' ? '运行中' : '已停止'}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                              {node.mode === 'auto' ? '自动' : '手动'}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <Badge variant={node.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                                          {node.status === 'online' ? '在线' : '离线'}
                                        </Badge>
                                        {!isActuator && (
                                          <>
                                            {node.battery !== undefined && (
                                              <div className={`flex items-center gap-1 text-xs ${getBatteryColor(node.battery)}`}>
                                                <Battery className="h-3 w-3" />
                                                {node.battery}%
                                              </div>
                                            )}
                                            {node.signal_strength !== undefined && (
                                              <div className={`flex items-center gap-1 text-xs ${getSignalColor(node.signal_strength)}`}>
                                                <Signal className="h-3 w-3" />
                                                {node.signal_strength}%
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {node.last_update && (
                                          <span className="text-xs text-muted-foreground">
                                            {formatTime(node.last_update)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                暂无设备节点，点击 + 添加
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {viewMode === 'unassigned' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : getUnassignedNodes().length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <HelpCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">暂无未分配设备</p>
                    <p className="text-sm">所有设备均已正确分类</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Card className="bg-gray-50 border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <HelpCircle className="h-4 w-4" />
                          <span>未分配设备说明：这些设备的类型未在系统中注册，系统自动将其归类为"未分配"。</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <p>• 带有数值(value)的设备被归类为"未分配传感器"</p>
                          <p>• 带有状态(state)的设备被归类为"未分配执行器"</p>
                          <p>• 设备按安装地点分组显示</p>
                        </div>
                      </CardContent>
                    </Card>
                    {Object.entries(getUnassignedNodesGroupedByLocation()).map(([location, nodes]) => {
                      return (
                        <Card key={location}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-100">
                                  <MapPin className="h-5 w-5 text-gray-600" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">
                                    {location}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    共 {nodes.length} 个未分配设备
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {nodes.filter(n => n.status === 'online').length}/{nodes.length} 在线
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {nodes.map((node) => {
                                const isActuator = node.node_type === 'actuator'
                                const IconComponent = isActuator ? Zap : Thermometer
                                const isUnknownSensor = node.sensor_type === 'unknown_sensor'
                                const isUnknownActuator = node.sensor_type === 'unknown_actuator'

                                return (
                                  <div
                                    key={node.id}
                                    className={`p-3 rounded-lg border transition-all bg-gray-50 border-gray-200 ${node.status === 'online' ? '' : 'opacity-50'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-200 text-gray-600">
                                          <IconComponent className="h-4 w-4" />
                                        </div>
                                        <span className="text-sm font-medium">{node.name}</span>
                                      </div>
                                      <Badge variant={node.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                                        {node.status === 'online' ? '在线' : '离线'}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                      <span className="font-mono">{node.node_id}</span>
                                      {node.sensor_type && (
                                        <span className="ml-2">
                                          · 原始类型: <span className="font-medium">{node.sensor_type}</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="text-xs bg-gray-100">
                                        {isActuator ? '执行器' : '传感器'}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs bg-gray-100">
                                        {isUnknownSensor ? '未分配传感器' : isUnknownActuator ? '未分配执行器' : '未知类型'}
                                      </Badge>
                                    </div>
                                    {!isActuator && node.value !== undefined && (
                                      <div className="flex items-end justify-between">
                                        <div>
                                          <span className="text-xl font-bold text-primary">
                                            {node.value}
                                          </span>
                                          <span className="text-sm text-muted-foreground ml-1">
                                            {node.unit || ''}
                                          </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          {node.battery !== undefined && (
                                            <div className={`flex items-center gap-1 text-xs ${getBatteryColor(node.battery)}`}>
                                              <Battery className="h-3 w-3" />
                                              {node.battery}%
                                            </div>
                                          )}
                                          {node.signal_strength !== undefined && (
                                            <div className={`flex items-center gap-1 text-xs ${getSignalColor(node.signal_strength)}`}>
                                              <Signal className="h-3 w-3" />
                                              {node.signal_strength}%
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {isActuator && (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded-full ${node.state === 'on' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                          <span className={`font-medium ${node.state === 'on' ? 'text-green-600' : 'text-gray-500'}`}>
                                            {node.state === 'on' ? '运行中' : '已停止'}
                                          </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                          {node.mode === 'auto' ? '自动' : '手动'}
                                        </Badge>
                                      </div>
                                    )}
                                    {node.last_update && (
                                      <div className="text-xs text-muted-foreground mt-2 text-right">
                                        更新于 {formatTime(node.last_update)}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {viewMode !== 'gateway' && viewMode !== 'unassigned' && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : getFilteredNodes().length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Activity className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">暂无{viewMode === 'sensor' ? '传感器' : viewMode === 'actuator' ? '执行器' : ''}设备</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(getNodesGroupedByType()).map(([type, nodes]) => {
                      const deviceConfig = getDeviceConfig(type)
                      const IconComponent = deviceConfig ? iconMap[deviceConfig.icon] || Thermometer : Thermometer
                      const isActuator = actuatorTypes.find(t => t.type === type)

                      return (
                        <Card key={type}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isActuator ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                                  <IconComponent className={`h-5 w-5 ${isActuator ? 'text-yellow-600' : 'text-blue-600'}`} />
                                </div>
                                <div>
                                  <CardTitle className="text-base">
                                    {deviceConfig?.name || type}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    {isActuator ? '执行器' : '传感器'} · 共 {nodes.length} 个设备
                                    {!isActuator && deviceConfig?.unit && ` · 单位：${deviceConfig.unit}`}
                                  </p>
                                </div>
                              </div>
                              <Badge variant={isActuator ? 'outline' : 'default'} className="text-xs">
                                {nodes.filter(n => n.status === 'online').length}/{nodes.length} 在线
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {nodes.map((node) => {
                                return (
                                  <div
                                    key={node.id}
                                    className={`p-3 rounded-lg border transition-all ${isActuator
                                      ? 'bg-yellow-50 border-yellow-100'
                                      : 'bg-blue-50 border-blue-100'
                                      } ${node.status === 'online' ? '' : 'opacity-50'}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium">{node.name}</span>
                                      <Badge variant={node.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                                        {node.status === 'online' ? '在线' : '离线'}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                      {node.node_id}
                                      {node.location && ` · ${node.location}`}
                                    </div>
                                    {!isActuator && (
                                      <div className="flex items-end justify-between">
                                        <div>
                                          {node.value !== undefined ? (
                                            <span className="text-2xl font-bold text-primary">
                                              {node.value}
                                            </span>
                                          ) : (
                                            <span className="text-sm text-muted-foreground">--</span>
                                          )}
                                          <span className="text-sm text-muted-foreground ml-1">
                                            {node.unit}
                                          </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          {node.battery !== undefined && (
                                            <div className={`flex items-center gap-1 text-xs ${getBatteryColor(node.battery)}`}>
                                              <Battery className="h-3 w-3" />
                                              {node.battery}%
                                            </div>
                                          )}
                                          {node.signal_strength !== undefined && (
                                            <div className={`flex items-center gap-1 text-xs ${getSignalColor(node.signal_strength)}`}>
                                              <Signal className="h-3 w-3" />
                                              {node.signal_strength}%
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {isActuator && (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded-full ${node.state === 'on' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                          <span className={`font-medium ${node.state === 'on' ? 'text-green-600' : 'text-gray-500'}`}>
                                            {node.state === 'on' ? '运行中' : '已停止'}
                                          </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                          {node.mode === 'auto' ? '自动' : '手动'}
                                        </Badge>
                                      </div>
                                    )}
                                    {node.last_update && (
                                      <div className="text-xs text-muted-foreground mt-2 text-right">
                                        更新于 {formatTime(node.last_update)}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <Dialog open={showGatewayDialog} onOpenChange={setShowGatewayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加网关设备</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">网关名称 *</label>
              <Input value={gatewayForm.name} onChange={(e) => setGatewayForm({ ...gatewayForm, name: e.target.value })} placeholder="如：A区网关" />
            </div>
            <div>
              <label className="text-sm font-medium">网关类型 *</label>
              <Select value={gatewayForm.gateway_type} onValueChange={(v) => setGatewayForm({ ...gatewayForm, gateway_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {gatewayTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">IP地址</label>
              <Input value={gatewayForm.ip_address} onChange={(e) => setGatewayForm({ ...gatewayForm, ip_address: e.target.value })} placeholder="192.168.1.100" />
            </div>
            <div>
              <label className="text-sm font-medium">MAC地址</label>
              <Input value={gatewayForm.mac_address} onChange={(e) => setGatewayForm({ ...gatewayForm, mac_address: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" />
            </div>
            <div>
              <label className="text-sm font-medium">通信协议</label>
              <Select value={gatewayForm.protocol} onValueChange={(v) => setGatewayForm({ ...gatewayForm, protocol: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {protocolOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGatewayDialog(false)}>取消</Button>
            <Button onClick={handleCreateGateway} disabled={!gatewayForm.name}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNodeDialog} onOpenChange={setShowNodeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加设备节点</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">设备ID *</label>
              <Input value={nodeForm.node_id} onChange={(e) => setNodeForm({ ...nodeForm, node_id: e.target.value })} placeholder="MAC地址或序列号" />
            </div>
            <div>
              <label className="text-sm font-medium">设备名称 *</label>
              <Input value={nodeForm.name} onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })} placeholder="如：1号温度传感器" />
            </div>
            <div>
              <label className="text-sm font-medium">设备类别 *</label>
              <Select value={nodeForm.node_type} onValueChange={(v) => setNodeForm({ ...nodeForm, node_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensor">传感器</SelectItem>
                  <SelectItem value="actuator">执行器</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {nodeForm.node_type === 'sensor' && (
              <div>
                <label className="text-sm font-medium">传感器类型</label>
                <Select value={nodeForm.sensor_type} onValueChange={(v) => setNodeForm({ ...nodeForm, sensor_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sensorTypes.map(opt => (
                      <SelectItem key={opt.type} value={opt.type}>
                        {opt.name}（{opt.unit}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {nodeForm.node_type === 'actuator' && (
              <div>
                <label className="text-sm font-medium">执行器类型</label>
                <Select value={nodeForm.actuator_type} onValueChange={(v) => setNodeForm({ ...nodeForm, actuator_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {actuatorTypes.map(opt => (
                      <SelectItem key={opt.type} value={opt.type}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">安装位置</label>
              <Input value={nodeForm.location} onChange={(e) => setNodeForm({ ...nodeForm, location: e.target.value })} placeholder="如：1号大棚北侧" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNodeDialog(false)}>取消</Button>
            <Button onClick={handleCreateNode} disabled={!nodeForm.node_id || !nodeForm.name}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}