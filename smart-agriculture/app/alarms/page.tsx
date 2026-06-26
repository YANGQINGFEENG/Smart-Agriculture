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
  Bell,
  BellOff,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react"

interface AlarmRule {
  id: number
  name: string
  sensor_type: string
  condition_type: string
  min_value: number | null
  max_value: number | null
  severity: string
  enabled: number
  created_at: string
}

interface AlarmRecord {
  id: number
  rule_id: number | null
  sensor_id: string | null
  sensor_type: string | null
  alarm_type: string
  severity: string
  message: string
  value: number | null
  status: string
  created_at: string
}

const sensorTypeOptions = [
  { value: "temperature", label: "温度传感器" },
  { value: "humidity", label: "湿度传感器" },
  { value: "light", label: "光照传感器" },
  { value: "soil", label: "土壤湿度" },
  { value: "soil_temperature", label: "土壤温度" },
  { value: "ec", label: "土壤EC" },
  { value: "ph", label: "土壤pH" },
]

const conditionOptions = [
  { value: "above", label: "大于" },
  { value: "below", label: "小于" },
  { value: "range", label: "范围外" },
]

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
}

const severityLabels: Record<string, string> = {
  info: "提示",
  warning: "警告",
  critical: "严重",
}

const statusColors: Record<string, string> = {
  active: "bg-red-100 text-red-700",
  acknowledged: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
}

const statusLabels: Record<string, string> = {
  active: "未处理",
  acknowledged: "已确认",
  resolved: "已解决",
}

const alarmTypeLabels: Record<string, string> = {
  threshold: "阈值触发",
  offline: "设备离线",
  low_battery: "低电量",
  data_anomaly: "数据异常",
}

export default function AlarmsPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "records">("rules")
  const [rules, setRules] = useState<AlarmRule[]>([])
  const [records, setRecords] = useState<AlarmRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<AlarmRecord | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: "",
    sensor_type: "temperature",
    condition_type: "above",
    min_value: "",
    max_value: "",
    severity: "warning",
  })

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/alarms/rules')
      const result = await response.json()
      if (result.success) setRules(result.data)
    } catch (error) {
      console.error("获取规则失败:", error)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/alarms/records?pageSize=50')
      const result = await response.json()
      if (result.success) setRecords(result.data)
    } catch (error) {
      console.error("获取记录失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "rules") fetchRules()
    else fetchRecords()
  }, [activeTab])

  const handleCreateRule = async () => {
    try {
      const response = await fetch('/api/alarms/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ruleForm,
          min_value: ruleForm.min_value ? parseFloat(ruleForm.min_value) : null,
          max_value: ruleForm.max_value ? parseFloat(ruleForm.max_value) : null,
        }),
      })
      if (response.ok) {
        setShowRuleDialog(false)
        fetchRules()
        setRuleForm({ name: "", sensor_type: "temperature", condition_type: "above", min_value: "", max_value: "", severity: "warning" })
      }
    } catch (error) {
      console.error("创建规则失败:", error)
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm("确定要删除这条规则吗？")) return
    try {
      await fetch(`/api/alarms/rules?id=${id}`, { method: 'DELETE' })
      fetchRules()
    } catch (error) {
      console.error("删除规则失败:", error)
    }
  }

  const handleUpdateRecordStatus = async (id: number, status: string) => {
    try {
      await fetch('/api/alarms/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, acknowledged_by: 'user' }),
      })
      fetchRecords()
      setShowRecordDialog(false)
    } catch (error) {
      console.error("更新状态失败:", error)
    }
  }

  const activeAlarms = records.filter(r => r.status === 'active').length
  const todayAlarms = records.filter(r => {
    const today = new Date().toDateString()
    return new Date(r.created_at).toDateString() === today
  }).length

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="alarms" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="alarms" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Bell className="h-6 w-6" />
                  报警管理
                </h1>
                <p className="text-muted-foreground">
                  {activeAlarms > 0 ? `有 ${activeAlarms} 个未处理报警` : '暂无未处理报警'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => activeTab === "rules" ? fetchRules() : fetchRecords()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                {activeTab === "rules" && (
                  <Button size="sm" onClick={() => setShowRuleDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    新增规则
                  </Button>
                )}
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{activeAlarms}</div>
                <div className="text-xs text-red-500">未处理报警</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{todayAlarms}</div>
                <div className="text-xs text-yellow-500">今日报警</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{rules.filter(r => r.enabled).length}</div>
                <div className="text-xs text-blue-500">启用规则</div>
              </div>
            </div>

            {/* 标签页切换 */}
            <div className="flex gap-2 border-b">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "rules"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("rules")}
              >
                报警规则
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "records"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("records")}
              >
                报警记录
              </button>
            </div>

            {/* 报警规则列表 */}
            {activeTab === "rules" && (
              <div className="space-y-3">
                {rules.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无报警规则</p>
                    <p className="text-sm">点击"新增规则"创建报警规则</p>
                  </div>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={severityColors[rule.severity]}>{severityLabels[rule.severity]}</Badge>
                          <span className="font-medium">{rule.name}</span>
                          <Badge variant="outline">
                            {sensorTypeOptions.find(s => s.value === rule.sensor_type)?.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {conditionOptions.find(c => c.value === rule.condition_type)?.label}
                            {rule.condition_type === 'range' && rule.min_value !== null && rule.max_value !== null
                              ? ` ${rule.min_value} - ${rule.max_value}`
                              : rule.condition_type === 'above' && rule.max_value !== null
                              ? ` > ${rule.max_value}`
                              : rule.condition_type === 'below' && rule.min_value !== null
                              ? ` < ${rule.min_value}`
                              : ''
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={rule.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                            {rule.enabled ? "启用" : "停用"}
                          </Badge>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 报警记录列表 */}
            {activeTab === "records" && (
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                    <p>暂无报警记录</p>
                  </div>
                ) : (
                  records.map((record) => (
                    <div
                      key={record.id}
                      className={`border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        record.status === 'active' ? 'border-red-200 bg-red-50/30' : ''
                      }`}
                      onClick={() => { setSelectedRecord(record); setShowRecordDialog(true) }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={severityColors[record.severity]}>{severityLabels[record.severity]}</Badge>
                          <div>
                            <p className="font-medium">{record.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {alarmTypeLabels[record.alarm_type]} · {new Date(record.created_at).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusColors[record.status]}>{statusLabels[record.status]}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 新增规则对话框 */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增报警规则</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">规则名称 *</label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="如：温度过高报警"
              />
            </div>
            <div>
              <label className="text-sm font-medium">传感器类型 *</label>
              <Select value={ruleForm.sensor_type} onValueChange={(v) => setRuleForm({ ...ruleForm, sensor_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sensorTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">触发条件 *</label>
              <Select value={ruleForm.condition_type} onValueChange={(v) => setRuleForm({ ...ruleForm, condition_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {conditionOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ruleForm.condition_type === 'range' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">最小值</label>
                  <Input type="number" value={ruleForm.min_value} onChange={(e) => setRuleForm({ ...ruleForm, min_value: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="text-sm font-medium">最大值</label>
                  <Input type="number" value={ruleForm.max_value} onChange={(e) => setRuleForm({ ...ruleForm, max_value: e.target.value })} placeholder="100" />
                </div>
              </div>
            ) : ruleForm.condition_type === 'above' ? (
              <div>
                <label className="text-sm font-medium">阈值</label>
                <Input type="number" value={ruleForm.max_value} onChange={(e) => setRuleForm({ ...ruleForm, max_value: e.target.value })} placeholder="超过此值触发报警" />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">阈值</label>
                <Input type="number" value={ruleForm.min_value} onChange={(e) => setRuleForm({ ...ruleForm, min_value: e.target.value })} placeholder="低于此值触发报警" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">严重程度</label>
              <Select value={ruleForm.severity} onValueChange={(v) => setRuleForm({ ...ruleForm, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">提示</SelectItem>
                  <SelectItem value="warning">警告</SelectItem>
                  <SelectItem value="critical">严重</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>取消</Button>
            <Button onClick={handleCreateRule} disabled={!ruleForm.name}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 报警详情对话框 */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>报警详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={severityColors[selectedRecord.severity]}>{severityLabels[selectedRecord.severity]}</Badge>
                <Badge className={statusColors[selectedRecord.status]}>{statusLabels[selectedRecord.status]}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">报警信息</p>
                <p className="font-medium">{selectedRecord.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">报警类型</p>
                  <p>{alarmTypeLabels[selectedRecord.alarm_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">触发值</p>
                  <p>{selectedRecord.value ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">传感器</p>
                  <p>{selectedRecord.sensor_id || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">触发时间</p>
                  <p>{new Date(selectedRecord.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              {selectedRecord.status === 'active' && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleUpdateRecordStatus(selectedRecord.id, 'acknowledged')}>
                    <Eye className="h-4 w-4 mr-1" />
                    确认
                  </Button>
                  <Button onClick={() => handleUpdateRecordStatus(selectedRecord.id, 'resolved')}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    解决
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
