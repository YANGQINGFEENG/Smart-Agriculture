"use client"

import { useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  FileText,
  Edit,
  Trash2,
  Play,
  Loader2,
} from "lucide-react"

interface PromptTemplate {
  id: number
  name: string
  type: string
  content: string
  description: string | null
  variables: Array<{
    name: string
    label: string
    type: string
    required: boolean
    default_value?: string
  }>
  version: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

const typeOptions = [
  { value: "chat", label: "通用对话" },
  { value: "diagnosis", label: "诊断分析" },
  { value: "general", label: "通用" },
]

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
}

export default function PromptsPage() {
  const [promptList, setPromptList] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<PromptTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "chat",
    content: "",
    description: "",
    variables: [] as Array<{ name: string; label: string; type: string; required: boolean }>,
    status: "active",
  })
  const [testVariables, setTestVariables] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<string>("")
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testTemplate, setTestTemplate] = useState<PromptTemplate | null>(null)

  const fetchPrompts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)

      const response = await fetch(`/api/prompts?${params}`)
      const result = await response.json()
      if (result.success) {
        setPromptList(result.data)
      }
    } catch (error) {
      console.error("获取模板列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrompts()
  }, [filterType])

  const handleCreate = () => {
    setEditingItem(null)
    setFormData({ name: "", type: "chat", content: "", description: "", variables: [], status: "active" })
    setShowDialog(true)
  }

  const handleEdit = (item: PromptTemplate) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      type: item.type,
      content: item.content,
      description: item.description || "",
      variables: item.variables || [],
      status: item.status,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    try {
      const url = editingItem ? `/api/prompts/${editingItem.id}` : '/api/prompts'
      const method = editingItem ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          description: formData.description || null,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setShowDialog(false)
        fetchPrompts()
      }
    } catch (error) {
      console.error("保存模板失败:", error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个模板吗？")) return
    try {
      const response = await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        fetchPrompts()
      }
    } catch (error) {
      console.error("删除模板失败:", error)
    }
  }

  const handleTest = (item: PromptTemplate) => {
    setTestTemplate(item)
    const initialVars: Record<string, string> = {}
    item.variables?.forEach(v => {
      initialVars[v.name] = v.default_value || ""
    })
    setTestVariables(initialVars)
    setTestResult("")
    setShowTestDialog(true)
  }

  const handleTestRender = async () => {
    if (!testTemplate) return
    try {
      const response = await fetch('/api/prompts/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: testTemplate.id,
          variables: testVariables,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setTestResult(result.data.rendered_prompt)
      }
    } catch (error) {
      console.error("渲染模板失败:", error)
    }
  }

  const addVariable = () => {
    setFormData({
      ...formData,
      variables: [...formData.variables, { name: "", label: "", type: "string", required: true }],
    })
  }

  const updateVariable = (index: number, field: string, value: any) => {
    const newVars = [...formData.variables]
    ;(newVars[index] as any)[field] = value
    setFormData({ ...formData, variables: newVars })
  }

  const removeVariable = (index: number) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="prompts" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="prompts" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">提示词模板管理</h1>
                <p className="text-muted-foreground">管理AI提示词模板，支持变量替换和测试</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchPrompts}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增模板
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>模板列表</CardTitle>
                    <CardDescription>共 {promptList.length} 个模板</CardDescription>
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="类型筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      {typeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : promptList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无模板数据</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {promptList.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{item.name}</h3>
                              <Badge className={statusColors[item.status]}>
                                {item.status === 'active' ? '启用' : '停用'}
                              </Badge>
                              <Badge variant="outline">
                                {typeOptions.find(t => t.value === item.type)?.label || item.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">v{item.version}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{item.description || "无描述"}</p>
                            <div className="text-xs text-muted-foreground">
                              变量: {item.variables?.length || 0} 个 |
                              更新时间: {new Date(item.updated_at).toLocaleString('zh-CN')}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button variant="ghost" size="sm" onClick={() => handleTest(item)}>
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑模板' : '新增模板'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">模板名称 *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入模板名称"
                />
              </div>
              <div>
                <label className="text-sm font-medium">类型 *</label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入模板描述"
              />
            </div>
            <div>
              <label className="text-sm font-medium">模板内容 *</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="输入模板内容，使用 {变量名} 作为占位符"
                rows={10}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">变量定义</label>
                <Button variant="outline" size="sm" onClick={addVariable}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加变量
                </Button>
              </div>
              {formData.variables.map((variable, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="变量名"
                    value={variable.name}
                    onChange={(e) => updateVariable(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="显示标签"
                    value={variable.label}
                    onChange={(e) => updateVariable(index, 'label', e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeVariable(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>测试模板: {testTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {testTemplate?.variables?.map((variable) => (
              <div key={variable.name}>
                <label className="text-sm font-medium">
                  {variable.label} {variable.required && <span className="text-destructive">*</span>}
                </label>
                <Input
                  value={testVariables[variable.name] || ""}
                  onChange={(e) => setTestVariables({ ...testVariables, [variable.name]: e.target.value })}
                  placeholder={`输入${variable.label}`}
                />
              </div>
            ))}
            <Button onClick={handleTestRender} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              渲染预览
            </Button>
            {testResult && (
              <div className="border rounded-lg p-4 bg-muted">
                <label className="text-sm font-medium mb-2 block">渲染结果</label>
                <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
