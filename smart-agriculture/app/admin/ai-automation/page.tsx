"use client"

import { useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  Search,
  Edit,
  Trash2,
  Loader2,
  Shield,
  User,
  Check,
  X,
  Zap,
  Play,
  Pause,
  Lightbulb,
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  Wind,
  AlertTriangle,
} from "lucide-react"

/**
 * 自动化方案数据接口
 */
interface AutomationScheme {
  id: number
  name: string
  description: string
  trigger_condition: string | null
  action_desc: string
  device_type: string
  related_sensors: string[]
  related_actuators: string[]
  action_type: 'on' | 'off' | 'value' | 'composite'
  action_value: number | null
  action_unit: string | null
  composite_actions: any
  priority: number
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 设备类型中文名映射 */
const deviceTypeNames: Record<string, string> = {
  water_pump: '水泵',
  fan: '风扇',
  heater: '加热器',
  valve: '电磁阀',
  light: '补光灯',
  ventilator: '通风机',
  fogger: '雾化器',
  motor: '电机',
  servo: '舵机',
  relay: '继电器',
  laser: '激光器',
  buzzer: '蜂鸣器',
  camera: '摄像头',
}

/** 动作类型配置 */
const actionTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
  on: { label: '开启', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: Play },
  off: { label: '关闭', color: 'bg-rose-50 text-rose-600 border-rose-200', icon: Pause },
  value: { label: '数值控制', color: 'bg-sky-50 text-sky-600 border-sky-200', icon: Check },
  composite: { label: '组合动作', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: Zap },
}

/** 场景图标 */
const sceneIcons: Record<string, any> = {
  temperature: Thermometer,
  humidity: Droplets,
  light_sensor: Sun,
  soil_moisture: Leaf,
  co2: Wind,
  pm25: Wind,
  default: Lightbulb,
}

export default function AiAutomationPage() {
  const [schemes, setSchemes] = useState<AutomationScheme[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterActionType, setFilterActionType] = useState<string>("all")

  // 编辑状态
  const [editingScheme, setEditingScheme] = useState<AutomationScheme | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    trigger_condition: "",
    action_desc: "",
    device_type: "",
    related_sensors: "",
    related_actuators: "",
    action_type: "on" as string,
    action_value: "",
    action_unit: "",
    priority: "0",
  })

  // 新建状态
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    trigger_condition: "",
    action_desc: "",
    device_type: "",
    related_sensors: "",
    related_actuators: "",
    action_type: "on" as string,
    action_value: "",
    action_unit: "",
    priority: "0",
  })

  /**
   * 获取自动化方案列表
   */
  const fetchSchemes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterActionType !== 'all') params.set('action_type', filterActionType)
      if (searchQuery) params.set('search', searchQuery)
      const response = await fetch(`/api/ai/automation?${params}`)
      const result = await response.json()
      if (result.success) {
        setSchemes(result.data)
      }
    } catch (error) {
      console.error("获取自动化方案失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchemes() }, [filterActionType])

  /**
   * 打开编辑对话框
   */
  const handleEdit = (scheme: AutomationScheme) => {
    setEditingScheme(scheme)
    setEditForm({
      name: scheme.name,
      description: scheme.description,
      trigger_condition: scheme.trigger_condition || "",
      action_desc: scheme.action_desc,
      device_type: scheme.device_type,
      related_sensors: Array.isArray(scheme.related_sensors) ? scheme.related_sensors.join(', ') : '',
      related_actuators: Array.isArray(scheme.related_actuators) ? scheme.related_actuators.join(', ') : '',
      action_type: scheme.action_type,
      action_value: scheme.action_value?.toString() || "",
      action_unit: scheme.action_unit || "",
      priority: scheme.priority.toString(),
    })
  }

  /**
   * 保存编辑
   */
  const handleSaveEdit = async () => {
    if (!editingScheme) return
    try {
      const response = await fetch(`/api/ai/automation?id=${editingScheme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          trigger_condition: editForm.trigger_condition || null,
          action_desc: editForm.action_desc,
          device_type: editForm.device_type,
          related_sensors: editForm.related_sensors.split(',').map(s => s.trim()).filter(Boolean),
          related_actuators: editForm.related_actuators.split(',').map(s => s.trim()).filter(Boolean),
          action_type: editForm.action_type,
          action_value: editForm.action_value ? parseFloat(editForm.action_value) : null,
          action_unit: editForm.action_unit || null,
          priority: parseInt(editForm.priority) || 0,
        }),
      })
      if (response.ok) {
        setEditingScheme(null)
        fetchSchemes()
      }
    } catch (error) {
      console.error("保存失败:", error)
    }
  }

  /**
   * 创建新方案
   */
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/ai/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          trigger_condition: createForm.trigger_condition || null,
          action_desc: createForm.action_desc,
          device_type: createForm.device_type,
          related_sensors: createForm.related_sensors.split(',').map(s => s.trim()).filter(Boolean),
          related_actuators: createForm.related_actuators.split(',').map(s => s.trim()).filter(Boolean),
          action_type: createForm.action_type,
          action_value: createForm.action_value ? parseFloat(createForm.action_value) : null,
          action_unit: createForm.action_unit || null,
          priority: parseInt(createForm.priority) || 0,
        }),
      })
      if (response.ok) {
        setShowCreate(false)
        setCreateForm({
          name: "", description: "", trigger_condition: "", action_desc: "",
          device_type: "", related_sensors: "", related_actuators: "",
          action_type: "on", action_value: "", action_unit: "", priority: "0",
        })
        fetchSchemes()
      }
    } catch (error) {
      console.error("创建失败:", error)
    }
  }

  /**
   * 切换启用状态
   */
  const handleToggleActive = async (scheme: AutomationScheme) => {
    try {
      await fetch(`/api/ai/automation?id=${scheme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !scheme.is_active }),
      })
      fetchSchemes()
    } catch (error) {
      console.error("切换失败:", error)
    }
  }

  /**
   * 删除方案
   */
  const handleDelete = async (scheme: AutomationScheme) => {
    if (scheme.is_system) {
      alert("系统预设方案不允许删除，您可以禁用它")
      return
    }
    if (!confirm(`确定要删除方案"${scheme.name}"吗？`)) return
    try {
      await fetch(`/api/ai/automation?id=${scheme.id}`, { method: 'DELETE' })
      fetchSchemes()
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  /**
   * 获取场景图标
   */
  const getSceneIcon = (sensors: string[]) => {
    const primary = sensors?.[0] || 'default'
    const Icon = sceneIcons[primary] || sceneIcons.default
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="knowledge" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="knowledge" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 标题和操作按钮 */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-amber-500" />
                  AI 自动化方案管理
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  管理 AI 可理解的自动化策略，用于智能推荐和自动执行
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchSchemes()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新建方案
                </Button>
              </div>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索方案名称或描述..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSchemes()}
                />
              </div>
              <Select value={filterActionType} onValueChange={setFilterActionType}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="动作类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="on">开启</SelectItem>
                  <SelectItem value="off">关闭</SelectItem>
                  <SelectItem value="value">数值控制</SelectItem>
                  <SelectItem value="composite">组合动作</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchSchemes}>
                搜索
              </Button>
            </div>

            {/* 方案列表 */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {schemes.map((scheme) => {
                  const actionCfg = actionTypeConfig[scheme.action_type] || actionTypeConfig.on
                  const ActionIcon = actionCfg.icon
                  return (
                    <div
                      key={scheme.id}
                      className={`rounded-xl border bg-card p-5 transition-all hover:shadow-md ${
                        !scheme.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      {/* 卡片头部 */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                            {getSceneIcon(scheme.related_sensors)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm">{scheme.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge className={actionCfg.color}>
                                <ActionIcon className="w-3 h-3 mr-1" />
                                {actionCfg.label}
                              </Badge>
                              {scheme.is_system ? (
                                <Badge className="bg-slate-50 text-slate-600 border-slate-200">
                                  <Shield className="w-3 h-3 mr-1" />
                                  系统
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                                  <User className="w-3 h-3 mr-1" />
                                  自定义
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(scheme)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggleActive(scheme)}
                          >
                            {scheme.is_active ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-600"
                            onClick={() => handleDelete(scheme)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* 描述 */}
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {scheme.description}
                      </p>

                      {/* 触发条件 */}
                      {scheme.trigger_condition && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-2">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-medium">触发:</span>
                          <span className="truncate">{scheme.trigger_condition}</span>
                        </div>
                      )}

                      {/* 动作描述 */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                        <Play className="w-3 h-3" />
                        <span className="truncate">{scheme.action_desc}</span>
                      </div>

                      {/* 底部信息 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>{deviceTypeNames[scheme.device_type] || scheme.device_type}</span>
                        <span>优先级: {scheme.priority}</span>
                      </div>
                    </div>
                  )
                })}
                {schemes.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    暂无自动化方案
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 编辑对话框 */}
      <Dialog open={!!editingScheme} onOpenChange={(v) => !v && setEditingScheme(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑自动化方案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">方案名称</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">描述</label>
                <Textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">触发条件</label>
                <Input
                  placeholder="如: 温度 > 30°C"
                  value={editForm.trigger_condition}
                  onChange={(e) => setEditForm({ ...editForm, trigger_condition: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">动作描述</label>
                <Input
                  placeholder="如: 开启风扇并开启雾化器"
                  value={editForm.action_desc}
                  onChange={(e) => setEditForm({ ...editForm, action_desc: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">设备类型</label>
                <Select value={editForm.device_type} onValueChange={(v) => setEditForm({ ...editForm, device_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择设备" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(deviceTypeNames).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">动作类型</label>
                <Select value={editForm.action_type} onValueChange={(v) => setEditForm({ ...editForm, action_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">开启</SelectItem>
                    <SelectItem value="off">关闭</SelectItem>
                    <SelectItem value="value">数值控制</SelectItem>
                    <SelectItem value="composite">组合动作</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">关联传感器</label>
                <Input
                  placeholder="如: temperature, humidity"
                  value={editForm.related_sensors}
                  onChange={(e) => setEditForm({ ...editForm, related_sensors: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">关联执行器</label>
                <Input
                  placeholder="如: fan, fogger"
                  value={editForm.related_actuators}
                  onChange={(e) => setEditForm({ ...editForm, related_actuators: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">优先级</label>
                <Input
                  type="number"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingScheme(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建对话框 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建自动化方案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">方案名称 *</label>
                <Input
                  placeholder="如: 高温自动降温"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">描述 *</label>
                <Textarea
                  rows={2}
                  placeholder="AI可理解的自然语言描述"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">触发条件</label>
                <Input
                  placeholder="如: 温度 > 30°C"
                  value={createForm.trigger_condition}
                  onChange={(e) => setCreateForm({ ...createForm, trigger_condition: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">动作描述</label>
                <Input
                  placeholder="如: 开启风扇并开启雾化器"
                  value={createForm.action_desc}
                  onChange={(e) => setCreateForm({ ...createForm, action_desc: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">设备类型 *</label>
                <Select value={createForm.device_type} onValueChange={(v) => setCreateForm({ ...createForm, device_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择设备" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(deviceTypeNames).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">动作类型</label>
                <Select value={createForm.action_type} onValueChange={(v) => setCreateForm({ ...createForm, action_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">开启</SelectItem>
                    <SelectItem value="off">关闭</SelectItem>
                    <SelectItem value="value">数值控制</SelectItem>
                    <SelectItem value="composite">组合动作</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">关联传感器</label>
                <Input
                  placeholder="如: temperature, humidity"
                  value={createForm.related_sensors}
                  onChange={(e) => setCreateForm({ ...createForm, related_sensors: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">关联执行器</label>
                <Input
                  placeholder="如: fan, fogger"
                  value={createForm.related_actuators}
                  onChange={(e) => setCreateForm({ ...createForm, related_actuators: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">优先级</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={createForm.priority}
                  onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!createForm.name || !createForm.description || !createForm.device_type}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}