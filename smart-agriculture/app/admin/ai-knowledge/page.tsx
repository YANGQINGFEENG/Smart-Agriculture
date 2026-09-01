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
  Brain,
  Shield,
  User,
  Check,
  X,
  AlertTriangle,
} from "lucide-react"

/**
 * AI 设备知识库条目接口
 */
interface KnowledgeEntry {
  id: number
  target_type: 'device_type' | 'device_instance'
  device_type: string
  device_id?: string | null
  keywords: string[] | string
  actions: Record<string, string> | string
  parameters: Record<string, any> | null | string
  description: string
  note?: string | null
  priority: number
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * AI 设备知识库管理页面
 * 管理 AI 理解设备所需的自然语言映射和参数信息
 * - 系统预设条目（is_system=1）受保护，不可删除
 * - 用户可自行添加/编辑设备知识
 * - 支持关键词、动作、参数、描述的完整编辑
 */
export default function AIKnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterTarget, setFilterTarget] = useState<string>("all")

  // 编辑状态
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [editForm, setEditForm] = useState({
    device_type: "",
    target_type: "device_type" as 'device_type' | 'device_instance',
    device_id: "",
    keywords: "",
    actions: "",
    parameters: "",
    description: "",
    note: "",
    priority: 0,
    is_active: true,
  })
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  /**
   * 获取知识库列表
   */
  const fetchEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('device_type', filterType)
      if (filterTarget !== 'all') params.set('target_type', filterTarget)
      if (searchQuery) params.set('search', searchQuery)
      params.set('is_active', '')  // 不过滤，全部显示

      const response = await fetch(`/api/ai/knowledge?${params}`)
      const result = await response.json()
      if (result.success) {
        // 解析 JSON 字段
        const data = result.data.map((entry: any) => ({
          ...entry,
          keywords: typeof entry.keywords === 'string'
            ? safeJsonParse(entry.keywords, [])
            : entry.keywords,
          actions: typeof entry.actions === 'string'
            ? safeJsonParse(entry.actions, {})
            : entry.actions,
          parameters: typeof entry.parameters === 'string'
            ? safeJsonParse(entry.parameters, null)
            : entry.parameters,
        }))
        setEntries(data)
      }
    } catch (error) {
      console.error("获取知识库失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEntries() }, [filterType, filterTarget])

  /**
   * 安全解析 JSON
   */
  const safeJsonParse = (str: string, fallback: any) => {
    try {
      return JSON.parse(str)
    } catch {
      return fallback
    }
  }

  /**
   * 打开编辑对话框
   */
  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry)
    setIsNew(false)
    setEditForm({
      device_type: entry.device_type,
      target_type: entry.target_type,
      device_id: entry.device_id || "",
      keywords: Array.isArray(entry.keywords)
        ? entry.keywords.join(', ')
        : (typeof entry.keywords === 'string' ? entry.keywords : ''),
      actions: typeof entry.actions === 'object'
        ? JSON.stringify(entry.actions, null, 2)
        : (typeof entry.actions === 'string' ? entry.actions : '{}'),
      parameters: entry.parameters
        ? (typeof entry.parameters === 'object'
          ? JSON.stringify(entry.parameters, null, 2)
          : String(entry.parameters))
        : '',
      description: entry.description || "",
      note: entry.note || "",
      priority: entry.priority || 0,
      is_active: entry.is_active,
    })
  }

  /**
   * 打开新建对话框
   */
  const handleNew = () => {
    setEditingEntry(null)
    setIsNew(true)
    setEditForm({
      device_type: "",
      target_type: "device_type",
      device_id: "",
      keywords: "",
      actions: '{\n  "on": "开启",\n  "off": "关闭",\n  "query": "查询状态"\n}',
      parameters: '',
      description: "",
      note: "",
      priority: 0,
      is_active: true,
    })
  }

  /**
   * 保存编辑
   */
  const handleSave = async () => {
    // 验证必填字段
    if (!editForm.device_type.trim()) {
      alert("设备类型不能为空")
      return
    }
    if (!editForm.keywords.trim()) {
      alert("关键词不能为空")
      return
    }
    if (!editForm.description.trim()) {
      alert("描述不能为空")
      return
    }

    // 验证 JSON
    let actionsJson: any
    let paramsJson: any = null
    try {
      actionsJson = JSON.parse(editForm.actions)
    } catch {
      alert("actions 格式错误，请输入有效的 JSON")
      return
    }
    if (editForm.parameters.trim()) {
      try {
        paramsJson = JSON.parse(editForm.parameters)
      } catch {
        alert("parameters 格式错误，请输入有效的 JSON")
        return
      }
    }

    setSaving(true)
    try {
      const body: any = {
        target_type: editForm.target_type,
        device_type: editForm.device_type.trim(),
        keywords: editForm.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean),
        actions: actionsJson,
        description: editForm.description.trim(),
        note: editForm.note.trim() || null,
        priority: editForm.priority,
        is_active: editForm.is_active,
      }

      if (paramsJson) {
        body.parameters = paramsJson
      }

      if (editForm.target_type === 'device_instance') {
        body.device_id = editForm.device_id.trim() || null
      }

      let url = '/api/ai/knowledge'
      let method = 'POST'

      if (!isNew && editingEntry) {
        url = `/api/ai/knowledge?id=${editingEntry.id}`
        method = 'PUT'
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()
      if (result.success) {
        setEditingEntry(null)
        fetchEntries()
      } else {
        alert(result.error || "保存失败")
      }
    } catch (error) {
      console.error("保存失败:", error)
      alert("网络错误，保存失败")
    } finally {
      setSaving(false)
    }
  }

  /**
   * 删除条目
   */
  const handleDelete = async (entry: KnowledgeEntry) => {
    if (entry.is_system) {
      alert("系统预设条目不可删除")
      return
    }
    if (!confirm(`确定要删除 "${entry.device_type}" 的知识条目吗？`)) return

    try {
      const response = await fetch(`/api/ai/knowledge?id=${entry.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        fetchEntries()
      } else {
        alert(result.error || "删除失败")
      }
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  /**
   * 获取设备类型名称
   */
  const getDeviceTypeName = (type: string) => {
    const names: Record<string, string> = {
      water_pump: '水泵', fan: '风扇', heater: '加热器', valve: '阀门',
      light: '补光灯', ventilator: '通风机', fogger: '雾化器', motor: '电机',
      servo: '舵机', led: 'LED灯', relay: '继电器', laser: '激光器',
      buzzer: '蜂鸣器', rgb_led: 'RGB灯', camera: '摄像头',
      temperature: '温度传感器', humidity: '湿度传感器', light_sensor: '光照传感器',
      soil_moisture: '土壤湿度', soil_temperature: '土壤温度', ph: 'pH传感器',
      ec: '电导率', co2: 'CO2传感器', pressure: '气压传感器',
      altitude: '海拔传感器', vibration: '振动传感器', pm25: 'PM2.5传感器',
    }
    return names[type] || type
  }

  /**
   * 获取目标类型标签
   */
  const getTargetTypeLabel = (type: string) => {
    return type === 'device_type' ? '类型知识' : '设备实例'
  }

  const getTargetTypeColor = (type: string) => {
    return type === 'device_type'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-purple-100 text-purple-700'
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="ai-knowledge" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="ai-knowledge" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 标题 */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Brain className="h-6 w-6" />
                  AI 设备知识库
                </h1>
                <p className="text-muted-foreground text-sm">
                  管理 AI 理解设备所需的自然语言映射和参数信息
                  {entries.length > 0 && ` · 共 ${entries.length} 条`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchEntries}>
                  <RefreshCw className="h-4 w-4 mr-1" />刷新
                </Button>
                <Button size="sm" onClick={handleNew}>
                  <Plus className="h-4 w-4 mr-1" />添加知识
                </Button>
              </div>
            </div>

            {/* 筛选 */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索设备类型或关键词..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchEntries()}
                  className="pl-10"
                />
              </div>
              <Select value={filterTarget} onValueChange={setFilterTarget}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="条目类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="device_type">类型知识</SelectItem>
                  <SelectItem value="device_instance">设备实例</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="设备类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部设备</SelectItem>
                  {[...new Set(entries.map(e => e.device_type))].sort().map(type => (
                    <SelectItem key={type} value={type}>{getDeviceTypeName(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 知识库列表 */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Brain className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">知识库为空</p>
                <p className="text-sm">点击"添加知识"开始构建 AI 设备知识库</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-base">
                            {getDeviceTypeName(entry.device_type)}
                          </span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {entry.device_type}
                          </code>
                          <Badge className={getTargetTypeColor(entry.target_type)}>
                            {getTargetTypeLabel(entry.target_type)}
                          </Badge>
                          {entry.is_system ? (
                            <Badge className="bg-amber-100 text-amber-700">
                              <Shield className="h-3 w-3 mr-1" />系统预设
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">
                              <User className="h-3 w-3 mr-1" />用户自定义
                            </Badge>
                          )}
                          {!entry.is_active && (
                            <Badge className="bg-red-100 text-red-700">已禁用</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            优先级: {entry.priority}
                          </Badge>
                        </div>

                        {/* 关键词 */}
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground shrink-0">关键词:</span>
                          {(Array.isArray(entry.keywords) ? entry.keywords : []).map((kw: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                          ))}
                        </div>

                        {/* 描述 */}
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {entry.description}
                        </p>

                        {/* 备注 */}
                        {entry.note && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {entry.note}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entry)}
                          disabled={entry.is_system}
                          className={entry.is_system ? 'opacity-30 cursor-not-allowed' : 'text-destructive hover:text-destructive'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 说明信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium mb-1">使用说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li><strong>类型知识</strong>：定义某类设备的通用自然语言理解规则（如"水泵"→ water_pump）</li>
                <li><strong>设备实例</strong>：为具体设备添加个性化关键词（如"1号水泵"→ WP-1-001）</li>
                <li><strong>系统预设</strong>：带盾牌图标的条目由系统维护，不可删除，但可编辑</li>
                <li><strong>优先级</strong>：数值越大匹配优先级越高，用于解决关键词冲突</li>
                <li>AI 对话时会自动查询知识库来理解用户意图，无需手动触发</li>
              </ul>
            </div>
          </div>
        </main>
      </div>

      {/* 编辑/新建对话框 */}
      <Dialog open={!!editingEntry || isNew} onOpenChange={() => { setEditingEntry(null); setIsNew(false) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNew ? <Plus className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
              {isNew ? '添加知识条目' : `编辑知识: ${editingEntry?.device_type || ''}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 条目类型 */}
            <div>
              <label className="text-sm font-medium mb-1 block">条目类型</label>
              <Select
                value={editForm.target_type}
                onValueChange={(v) => setEditForm({ ...editForm, target_type: v as 'device_type' | 'device_instance' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="device_type">类型知识（通用设备类型）</SelectItem>
                  <SelectItem value="device_instance">设备实例（具体设备）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 设备类型 */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                设备类型 <span className="text-red-500">*</span>
              </label>
              <Input
                value={editForm.device_type}
                onChange={(e) => setEditForm({ ...editForm, device_type: e.target.value })}
                placeholder="如: water_pump, fan, light"
              />
              <p className="text-xs text-muted-foreground mt-1">
                使用英文下划线命名，如 water_pump, temperature, soil_moisture
              </p>
            </div>

            {/* 设备实例ID（仅实例类型显示） */}
            {editForm.target_type === 'device_instance' && (
              <div>
                <label className="text-sm font-medium mb-1 block">设备实例 ID</label>
                <Input
                  value={editForm.device_id}
                  onChange={(e) => setEditForm({ ...editForm, device_id: e.target.value })}
                  placeholder="如: WP-1-001, FAN-1-002"
                />
              </div>
            )}

            {/* 关键词 */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                自然语言关键词 <span className="text-red-500">*</span>
              </label>
              <Input
                value={editForm.keywords}
                onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                placeholder="用逗号分隔，如: 水泵, 灌溉, 浇水, 抽水"
              />
              <p className="text-xs text-muted-foreground mt-1">
                用户说这些词时，AI 会自动匹配到该设备类型
              </p>
            </div>

            {/* 动作定义 */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                动作定义 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={editForm.actions}
                onChange={(e) => setEditForm({ ...editForm, actions: e.target.value })}
                rows={5}
                className="font-mono text-sm"
                placeholder='{"on":"开启","off":"关闭","query":"查询状态"}'
              />
              <p className="text-xs text-muted-foreground mt-1">
                JSON 格式，定义设备支持的动作及其描述
              </p>
            </div>

            {/* 参数 */}
            <div>
              <label className="text-sm font-medium mb-1 block">参数配置</label>
              <Textarea
                value={editForm.parameters}
                onChange={(e) => setEditForm({ ...editForm, parameters: e.target.value })}
                rows={4}
                className="font-mono text-sm"
                placeholder='{"control_type":"integer","control_range":{"min":0,"max":100,"step":1,"unit":"%"}}'
              />
              <p className="text-xs text-muted-foreground mt-1">
                JSON 格式，可选。定义控制类型、范围、单位等参数
              </p>
            </div>

            {/* 描述 */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                设备描述 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                placeholder="描述该设备的功能和用途，AI 会据此理解设备能力"
              />
            </div>

            {/* 备注 */}
            <div>
              <label className="text-sm font-medium mb-1 block">备注</label>
              <Input
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                placeholder="如: 与光照传感器同名不同类型，此为执行器"
              />
            </div>

            {/* 优先级和状态 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">匹配优先级</label>
                <Input
                  type="number"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={100}
                />
                <p className="text-xs text-muted-foreground mt-1">数值越大越优先匹配</p>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">启用此条目</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingEntry(null); setIsNew(false) }}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}