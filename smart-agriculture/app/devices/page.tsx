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
  Edit,
  Signal,
  SignalZero,
  Search,
  Filter,
} from "lucide-react"

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
  node_type: string
  sensor_type: string | null
  location: string | null
  status: string
  last_update: string | null
}

const gatewayTypeOptions = [
  { value: "wifi_sensor", label: "WiFi传感器（独立IP）" },
  { value: "lorawan_gateway", label: "LoRa网关" },
  { value: "serial_gateway", label: "串口网关（RS485）" },
  { value: "zigbee_gateway", label: "Zigbee网关" },
  { value: "bluetooth_gateway", label: "蓝牙网关" },
]

const sensorTypeOptions = [
  { value: "temperature", label: "温度", icon: Thermometer, unit: "°C" },
  { value: "humidity", label: "湿度", icon: Droplets, unit: "%" },
  { value: "light", label: "光照", icon: Sun, unit: "lux" },
  { value: "soil_moisture", label: "土壤湿度", icon: Leaf, unit: "%" },
  { value: "soil_temperature", label: "土壤温度", icon: Thermometer, unit: "°C" },
  { value: "ph", label: "pH值", icon: Droplets, unit: "pH" },
  { value: "ec", label: "电导率", icon: Droplets, unit: "μS/cm" },
  { value: "co2", label: "CO2", icon: Leaf, unit: "ppm" },
  { value: "pm25", label: "PM2.5", icon: Leaf, unit: "μg/m³" },
]

const protocolOptions = [
  { value: "mqtt", label: "MQTT" },
  { value: "http", label: "HTTP" },
  { value: "lorawan", label: "LoRaWAN" },
  { value: "zigbee", label: "Zigbee" },
  { value: "bluetooth", label: "Bluetooth" },
]

export default function DevicesPage() {
  const { farms, selectedFarmId } = useFarm()
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [showGatewayDialog, setShowGatewayDialog] = useState(false)
  const [showNodeDialog, setShowNodeDialog] = useState(false)
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

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
    location: "",
  })

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
      const response = await fetch('/api/device-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nodeForm,
          gateway_id: selectedGateway.id,
        }),
      })
      if (response.ok) {
        setShowNodeDialog(false)
        fetchGateways()
        setNodeForm({ node_id: "", name: "", node_type: "sensor", sensor_type: "temperature", location: "" })
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

  const filteredGateways = gateways.filter(gw => {
    if (filterType !== 'all' && gw.gateway_type !== filterType) return false
    if (searchQuery && !gw.name.includes(searchQuery) && !gw.ip_address?.includes(searchQuery)) return false
    return true
  })

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="devices" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="devices" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Router className="h-6 w-6" />
                  设备连接
                </h1>
                <p className="text-muted-foreground">
                  {farms.find(f => f.id === selectedFarmId)?.name || '未选择基地'} · 共 {gateways.length} 个网关
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchGateways}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                <Button size="sm" onClick={() => setShowGatewayDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加网关
                </Button>
              </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索网关名称或IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
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
            </div>

            {/* 网关列表 */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGateways.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Router className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">暂无网关设备</p>
                <p className="text-sm">点击"添加网关"开始配置</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGateways.map((gateway) => (
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
                            const sensorInfo = sensorTypeOptions.find(s => s.value === node.sensor_type)
                            const SensorIcon = sensorInfo?.icon || Thermometer
                            return (
                              <div key={node.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                  <SensorIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{node.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {node.node_id}
                                    {node.location && ` · ${node.location}`}
                                  </p>
                                </div>
                                <Badge variant={node.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                                  {node.status === 'online' ? '在线' : '离线'}
                                </Badge>
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
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 添加网关对话框 */}
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

      {/* 添加设备节点对话框 */}
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
              <label className="text-sm font-medium">传感器类型</label>
              <Select value={nodeForm.sensor_type} onValueChange={(v) => setNodeForm({ ...nodeForm, sensor_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sensorTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}（{opt.unit}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
