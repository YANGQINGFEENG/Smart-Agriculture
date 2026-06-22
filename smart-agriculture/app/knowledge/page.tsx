"use client"

import { useState, useEffect, useRef } from "react"
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
  Search,
  FileText,
  Edit,
  Trash2,
  Loader2,
  Upload,
  Sparkles,
  AlertTriangle,
  Check,
  X,
} from "lucide-react"

interface KnowledgeItem {
  id: number
  title: string
  content: string
  category: string
  tags: string | null
  source: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

interface SmartAddResult {
  structured: {
    title: string
    content: string
    category: string
    tags: string
  }
  conflicts: Array<{
    id: number
    title: string
    category: string
    similarity: number
    existing_content: string
    type: string
    suggestion: string
  }>
  has_conflicts: boolean
}

const categoryOptions = [
  { value: "病虫害防治", label: "病虫害防治" },
  { value: "作物管理", label: "作物管理" },
  { value: "环境参数", label: "环境参数" },
  { value: "灌溉管理", label: "灌溉管理" },
  { value: "土壤管理", label: "土壤管理" },
  { value: "其他", label: "其他" },
]

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800",
}

const conflictTypeColors: Record<string, string> = {
  exact_title: "bg-red-100 text-red-800",
  duplicate: "bg-red-100 text-red-800",
  high_overlap: "bg-orange-100 text-orange-800",
  medium_overlap: "bg-yellow-100 text-yellow-800",
  low_overlap: "bg-blue-100 text-blue-800",
  similar: "bg-blue-100 text-blue-800",
}

const conflictTypeLabels: Record<string, string> = {
  exact_title: "标题相同",
  duplicate: "重复",
  high_overlap: "高度重叠",
  medium_overlap: "中度重叠",
  low_overlap: "低度重叠",
  similar: "相似",
}

export default function KnowledgePage() {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

  // 智能添加状态
  const [showSmartAdd, setShowSmartAdd] = useState(false)
  const [rawText, setRawText] = useState("")
  const [smartAddLoading, setSmartAddLoading] = useState(false)
  const [smartAddResult, setSmartAddResult] = useState<SmartAddResult | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({ title: "", content: "", category: "", tags: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 传统编辑状态
  const [showTraditionalAdd, setShowTraditionalAdd] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "病虫害防治",
    tags: "",
    source: "",
    status: "draft" as string,
  })

  const fetchKnowledge = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('pageSize', pagination.pageSize.toString())
      if (filterCategory !== 'all') params.set('category', filterCategory)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/knowledge?${params}`)
      const result = await response.json()
      if (result.success) {
        setKnowledgeList(result.data)
        setPagination(result.pagination)
      }
    } catch (error) {
      console.error("获取知识库失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledge(1)
  }, [filterCategory, filterStatus])

  const handleSearch = () => {
    fetchKnowledge(1)
  }

  // 智能添加 - 处理文本输入
  const handleSmartAdd = async () => {
    if (!rawText.trim()) return
    setSmartAddLoading(true)
    try {
      const response = await fetch('/api/knowledge/smart-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText }),
      })
      const result = await response.json()
      if (result.success) {
        setSmartAddResult(result.data)
        setEditData({
          title: result.data.structured.title,
          content: result.data.structured.content,
          category: result.data.structured.category,
          tags: result.data.structured.tags,
        })
        setEditMode(true)
      }
    } catch (error) {
      console.error("智能添加失败:", error)
      alert("智能处理失败，请重试")
    } finally {
      setSmartAddLoading(false)
    }
  }

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      setRawText(text)
      // 自动触发智能添加
      setTimeout(() => handleSmartAdd(), 100)
    }
    reader.readAsText(file)

    // 重置input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 保存智能添加的知识
  const handleSaveSmartAdd = async () => {
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editData.title,
          content: editData.content,
          category: editData.category,
          tags: editData.tags || null,
          source: 'smart_add',
          status: 'draft',
        }),
      })
      const result = await response.json()
      if (result.success) {
        setShowSmartAdd(false)
        setSmartAddResult(null)
        setRawText("")
        setEditMode(false)
        fetchKnowledge(pagination.page)
      }
    } catch (error) {
      console.error("保存知识失败:", error)
    }
  }

  // 传统添加相关
  const handleTraditionalAdd = () => {
    setEditingItem(null)
    setFormData({ title: "", content: "", category: "病虫害防治", tags: "", source: "", status: "draft" })
    setShowTraditionalAdd(true)
  }

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item)
    setFormData({
      title: item.title,
      content: item.content,
      category: item.category,
      tags: item.tags || "",
      source: item.source || "",
      status: item.status,
    })
    setShowTraditionalAdd(true)
  }

  const handleSaveTraditional = async () => {
    try {
      const url = editingItem ? `/api/knowledge/${editingItem.id}` : '/api/knowledge'
      const method = editingItem ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags || null,
          source: formData.source || null,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setShowTraditionalAdd(false)
        fetchKnowledge(pagination.page)
      }
    } catch (error) {
      console.error("保存知识失败:", error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条知识吗？")) return
    try {
      const response = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        fetchKnowledge(pagination.page)
      }
    } catch (error) {
      console.error("删除知识失败:", error)
    }
  }

  const filteredList = knowledgeList.filter(item => {
    if (searchQuery && !item.title.includes(searchQuery) && !item.content.includes(searchQuery)) {
      return false
    }
    return true
  })

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="knowledge" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="knowledge" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">知识库管理</h1>
                <p className="text-muted-foreground">管理农业领域知识库，支持智能添加和冲突检测</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchKnowledge(pagination.page)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
                <Button variant="outline" size="sm" onClick={handleTraditionalAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  手动添加
                </Button>
                <Button size="sm" onClick={() => { setShowSmartAdd(true); setSmartAddResult(null); setRawText(""); setEditMode(false) }}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  智能添加
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>知识列表</CardTitle>
                <CardDescription>共 {pagination.total} 条知识</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索知识..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="分类筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部分类</SelectItem>
                      {categoryOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="published">已发布</SelectItem>
                      <SelectItem value="archived">已归档</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleSearch}>
                    <Search className="h-4 w-4 mr-2" />
                    搜索
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无知识数据</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredList.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{item.title}</h3>
                              <Badge className={statusColors[item.status]}>
                                {item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '已归档'}
                              </Badge>
                              <Badge variant="outline">{item.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>更新时间: {new Date(item.updated_at).toLocaleString('zh-CN')}</span>
                              {item.source && <span>来源: {item.source}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
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

                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchKnowledge(pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      第 {pagination.page} / {pagination.totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchKnowledge(pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* 智能添加对话框 */}
      <Dialog open={showSmartAdd} onOpenChange={setShowSmartAdd}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              智能添加知识
            </DialogTitle>
          </DialogHeader>

          {!editMode ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">粘贴文字或上传MD文件</label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="直接粘贴农业相关文字内容，AI会自动整理成结构化知识...

支持的内容类型：
• 病虫害防治方法
• 作物种植技术
• 环境参数说明
• 灌溉管理技巧
• 土壤管理知识

也可以点击下方按钮上传 .md 或 .txt 文件"
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.text"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  上传文件
                </Button>
                <div className="flex-1" />
                <Button onClick={handleSmartAdd} disabled={!rawText.trim() || smartAddLoading}>
                  {smartAddLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AI整理
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 冲突提示 */}
              {smartAddResult?.has_conflicts && (
                <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">发现 {smartAddResult.conflicts.length} 条可能冲突的知识</span>
                  </div>
                  <div className="space-y-2">
                    {smartAddResult.conflicts.slice(0, 3).map((conflict) => (
                      <div key={conflict.id} className="flex items-start gap-2 text-sm">
                        <Badge className={conflictTypeColors[conflict.type]}>
                          {conflictTypeLabels[conflict.type]} {conflict.similarity}%
                        </Badge>
                        <div className="flex-1">
                          <span className="font-medium">{conflict.title}</span>
                          <p className="text-muted-foreground text-xs mt-1">{conflict.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI整理结果 */}
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-3">AI整理结果（可编辑）</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">标题</label>
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">分类</label>
                    <Select value={editData.category} onValueChange={(v) => setEditData({ ...editData, category: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">内容</label>
                    <Textarea
                      value={editData.content}
                      onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                      rows={10}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">标签（逗号分隔）</label>
                    <Input
                      value={editData.tags}
                      onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                      placeholder="番茄,晚疫病,病害防治"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => { setEditMode(false); setSmartAddResult(null) }}>
                  返回修改
                </Button>
                <Button onClick={handleSaveSmartAdd}>
                  <Check className="h-4 w-4 mr-2" />
                  确认保存
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowSmartAdd(false)}>
                取消
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 传统添加对话框 */}
      <Dialog open={showTraditionalAdd} onOpenChange={setShowTraditionalAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑知识' : '手动添加知识'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">标题 *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="输入知识标题"
              />
            </div>
            <div>
              <label className="text-sm font-medium">分类 *</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">内容 *</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="输入知识内容"
                rows={8}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">标签</label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="多个标签用逗号分隔"
                />
              </div>
              <div>
                <label className="text-sm font-medium">来源</label>
                <Input
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="知识来源链接"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="published">已发布</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTraditionalAdd(false)}>取消</Button>
            <Button onClick={handleSaveTraditional}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
