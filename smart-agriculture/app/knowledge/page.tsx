"use client"

import { useState, useEffect, useRef } from "react"
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
  Upload,
  Sparkles,
  AlertTriangle,
  Check,
  BookOpen,
  ChevronRight,
  GitCompare,
  Merge,
  Link,
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

interface SmartAddItem {
  structured: { title: string; content: string; category: string; tags: string }
  conflicts: Array<{ id: number; title: string; similarity: number; type: string; suggestion: string; existing_content?: string }>
  has_conflicts: boolean
}

interface SmartAddResult {
  items: SmartAddItem[]
  total: number
  has_any_conflicts: boolean
}

interface CompareResult {
  items: KnowledgeItem[]
  comparisons: Array<{
    item1: { id: number; title: string; category: string; content: string }
    item2: { id: number; title: string; category: string; content: string }
    similarity: number
    title_similarity: number
    content_similarity: number
    common_keywords: string[]
    overlapping_segments: Array<{ text: string; positions: { text1: number; text2: number } }>
    relation_type: string
    suggestion: string
    same_category: boolean
  }>
  stats: { total_pairs: number; high_overlap: number; medium_overlap: number; low_overlap: number }
  merge_suggestions: any[]
}

const categoryOptions = [
  { value: "病虫害防治", label: "病虫害防治", color: "bg-rose-50 text-rose-600 border-rose-200" },
  { value: "作物管理", label: "作物管理", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  { value: "环境参数", label: "环境参数", color: "bg-sky-50 text-sky-600 border-sky-200" },
  { value: "灌溉管理", label: "灌溉管理", color: "bg-teal-50 text-teal-600 border-teal-200" },
  { value: "土壤管理", label: "土壤管理", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "其他", label: "其他", color: "bg-slate-50 text-slate-600 border-slate-200" },
]

const categoryColors: Record<string, string> = {
  '病虫害防治': 'from-rose-400/80 to-rose-500/80',
  '作物管理': 'from-emerald-400/80 to-emerald-500/80',
  '环境参数': 'from-sky-400/80 to-sky-500/80',
  '灌溉管理': 'from-teal-400/80 to-teal-500/80',
  '土壤管理': 'from-amber-400/80 to-amber-500/80',
  '其他': 'from-slate-400/80 to-slate-500/80',
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-50 text-amber-600 border-amber-200",
  published: "bg-emerald-50 text-emerald-600 border-emerald-200",
  archived: "bg-slate-50 text-slate-500 border-slate-200",
}

const relationColors: Record<string, string> = {
  exact_duplicate: "bg-red-100 text-red-700",
  near_duplicate: "bg-red-100 text-red-700",
  high_overlap: "bg-orange-100 text-orange-700",
  related: "bg-yellow-100 text-yellow-700",
  loosely_related: "bg-blue-100 text-blue-700",
  unrelated: "bg-gray-100 text-gray-700",
}

const relationLabels: Record<string, string> = {
  exact_duplicate: "完全重复",
  near_duplicate: "几乎重复",
  high_overlap: "高度重叠",
  related: "相关",
  loosely_related: "弱相关",
  unrelated: "无关联",
}

export default function KnowledgePage() {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [compareMode, setCompareMode] = useState(false)

  // 智能添加状态
  const [showSmartAdd, setShowSmartAdd] = useState(false)
  const [rawText, setRawText] = useState("")
  const [smartAddLoading, setSmartAddLoading] = useState(false)
  const [smartAddResult, setSmartAddResult] = useState<SmartAddResult | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 编辑状态
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "", tags: "" })

  // 对比结果状态
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [comparing, setComparing] = useState(false)

  const fetchKnowledge = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('pageSize', pagination.pageSize.toString())
      if (filterCategory !== 'all') params.set('category', filterCategory)
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

  useEffect(() => { fetchKnowledge(1) }, [filterCategory])

  // 编辑功能
  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item)
    setEditForm({
      title: item.title,
      content: item.content,
      category: item.category,
      tags: item.tags || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return
    try {
      const response = await fetch(`/api/knowledge/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (response.ok) {
        setEditingItem(null)
        fetchKnowledge(pagination.page)
      }
    } catch (error) {
      console.error("保存失败:", error)
    }
  }

  // 删除功能
  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条知识吗？")) return
    try {
      const response = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      if (response.ok) fetchKnowledge(pagination.page)
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  // 多选功能
  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    if (selectedIds.size === knowledgeList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(knowledgeList.map(i => i.id)))
    }
  }

  // 对比功能
  const handleCompare = async () => {
    if (selectedIds.size < 2) {
      alert("请选择至少2条知识进行对比")
      return
    }
    setComparing(true)
    try {
      const response = await fetch('/api/knowledge/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const result = await response.json()
      if (result.success) {
        setCompareResult(result.data)
      }
    } catch (error) {
      console.error("对比失败:", error)
    } finally {
      setComparing(false)
    }
  }

  // 智能添加
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
        setSelectedItems(new Set(result.data.items.map((_: any, i: number) => i)))
      }
    } catch (error) {
      console.error("智能添加失败:", error)
    } finally {
      setSmartAddLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => { setRawText(event.target?.result as string) }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveSelected = async () => {
    if (!smartAddResult) return
    let savedCount = 0
    for (const index of selectedItems) {
      const item = smartAddResult.items[index]
      if (!item) continue
      try {
        const response = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.structured.title,
            content: item.structured.content,
            category: item.structured.category,
            tags: item.structured.tags || null,
            source: 'smart_add',
            status: 'draft',
          }),
        })
        if (response.ok) savedCount++
      } catch (error) {
        console.error("保存失败:", error)
      }
    }
    if (savedCount > 0) {
      setShowSmartAdd(false)
      setSmartAddResult(null)
      setRawText("")
      fetchKnowledge(pagination.page)
    }
  }

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) { newSelected.delete(index) } else { newSelected.add(index) }
    setSelectedItems(newSelected)
  }

  const getCategoryColor = (category: string) => categoryColors[category] || 'from-slate-400/80 to-slate-500/80'
  const getCategoryBadgeColor = (category: string) => categoryOptions.find(c => c.value === category)?.color || 'bg-slate-50 text-slate-600'

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
                  <BookOpen className="h-6 w-6" />
                  知识库
                </h1>
                <p className="text-muted-foreground">
                  共 {pagination.total} 条知识
                  {selectedIds.size > 0 && ` · 已选 ${selectedIds.size} 条`}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => fetchKnowledge(pagination.page)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                <Button
                  variant={compareMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setCompareMode(!compareMode); setSelectedIds(new Set()); setCompareResult(null) }}
                >
                  <GitCompare className="h-4 w-4 mr-1" />
                  {compareMode ? "退出对比" : "对比模式"}
                </Button>
                {compareMode && selectedIds.size >= 2 && (
                  <Button size="sm" onClick={handleCompare} disabled={comparing}>
                    {comparing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <GitCompare className="h-4 w-4 mr-1" />}
                    开始对比 ({selectedIds.size})
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => { setShowSmartAdd(true); setSmartAddResult(null); setRawText(""); setSelectedItems(new Set()) }}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  智能添加
                </Button>
              </div>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜索知识..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchKnowledge(1)} className="pl-10" />
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
            </div>

            {/* 对比模式提示 */}
            {compareMode && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-blue-700">
                  对比模式：点击书本选择要对比的知识（至少2条）
                </span>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedIds.size === knowledgeList.length ? "取消全选" : "全选"}
                </Button>
              </div>
            )}

            {/* 书本式知识列表 */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : knowledgeList.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">知识库为空</p>
                <p className="text-sm">点击"智能添加"开始添加知识</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {knowledgeList.map((item) => (
                  <div key={item.id} className="group cursor-pointer" onClick={() => {
                    if (compareMode) { toggleSelect(item.id) } else { handleEdit(item) }
                  }}>
                    <div className={`relative h-44 rounded-lg bg-gradient-to-br ${getCategoryColor(item.category)} p-5 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${compareMode && selectedIds.has(item.id) ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/5 rounded-l-lg" />
                      <div className="relative h-full flex flex-col justify-between text-white/90">
                        <div>
                          <Badge className="bg-white/15 text-white/80 border-0 text-xs mb-2">{item.category}</Badge>
                          <h3 className="font-semibold text-base line-clamp-2 drop-shadow-sm">{item.title}</h3>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs opacity-60">{new Date(item.updated_at).toLocaleDateString('zh-CN')}</span>
                          {compareMode ? (
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedIds.has(item.id) ? 'bg-white border-white' : 'border-white/50'}`}>
                              {selectedIds.has(item.id) && <Check className="h-3 w-3 text-primary" />}
                            </div>
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                          )}
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge className={`${statusColors[item.status]} text-xs`}>
                          {item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '归档'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 px-1">
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchKnowledge(pagination.page - 1)}>上一页</Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">第 {pagination.page} / {pagination.totalPages} 页</span>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchKnowledge(pagination.page + 1)}>下一页</Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 编辑对话框 */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              编辑知识
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">标题</label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">分类</label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">内容</label>
              <Textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={10} />
            </div>
            <div>
              <label className="text-sm font-medium">标签（逗号分隔）</label>
              <Input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="番茄,晚疫病" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>
              <Check className="h-4 w-4 mr-1" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对比结果对话框 */}
      <Dialog open={!!compareResult} onOpenChange={() => setCompareResult(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              知识对比分析
            </DialogTitle>
          </DialogHeader>

          {compareResult && (
            <div className="space-y-6">
              {/* 统计概览 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{compareResult.stats.total_pairs}</div>
                  <div className="text-xs text-blue-500">对比组数</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{compareResult.stats.high_overlap}</div>
                  <div className="text-xs text-red-500">高度重叠</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{compareResult.stats.medium_overlap}</div>
                  <div className="text-xs text-yellow-500">中度重叠</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{compareResult.stats.low_overlap}</div>
                  <div className="text-xs text-green-500">低重叠</div>
                </div>
              </div>

              {/* 合并建议 */}
              {compareResult.merge_suggestions.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Merge className="h-4 w-4" />
                    智能建议
                  </h3>
                  {compareResult.merge_suggestions.map((suggestion, i) => (
                    <div key={i} className="mb-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {suggestion.type === 'merge' ? (
                          <Badge className="bg-red-100 text-red-700">建议合并</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700">建议关联</Badge>
                        )}
                        <span className="text-sm">{suggestion.reason}</span>
                      </div>
                      {suggestion.items && (
                        <div className="text-xs text-muted-foreground">
                          涉及：{suggestion.items.map((item: any) => item.title).join(' ↔ ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 详细对比结果 */}
              <div className="space-y-4">
                <h3 className="font-medium">详细对比</h3>
                {compareResult.comparisons.map((comp, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    {/* 标题对比 */}
                    <div className="grid grid-cols-2 divide-x">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getCategoryBadgeColor(comp.item1.category)}>{comp.item1.category}</Badge>
                          <span className="font-medium text-sm">{comp.item1.title}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getCategoryBadgeColor(comp.item2.category)}>{comp.item2.category}</Badge>
                          <span className="font-medium text-sm">{comp.item2.title}</span>
                        </div>
                      </div>
                    </div>

                    {/* 相似度统计 */}
                    <div className="bg-muted/30 px-4 py-3 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span>相似度：<strong className={comp.similarity > 60 ? 'text-red-600' : comp.similarity > 30 ? 'text-yellow-600' : 'text-green-600'}>{comp.similarity}%</strong></span>
                          <span className="text-muted-foreground">标题: {comp.title_similarity}%</span>
                          <span className="text-muted-foreground">内容: {comp.content_similarity}%</span>
                          <Badge className={relationColors[comp.relation_type]}>{relationLabels[comp.relation_type]}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{comp.suggestion}</span>
                      </div>
                      {comp.common_keywords.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>共同关键词：</span>
                          {comp.common_keywords.map((kw, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 重复文字高亮显示 */}
                    {comp.overlapping_segments.length > 0 && (
                      <div className="border-t">
                        <div className="px-4 py-2 bg-amber-50 border-b flex items-center gap-2">
                          <span className="text-sm font-medium text-amber-700">
                            📝 重复文字（{comp.overlapping_segments.length}处）
                          </span>
                        </div>
                        <div className="divide-y">
                          {comp.overlapping_segments.slice(0, 5).map((segment, j) => (
                            <div key={j} className="grid grid-cols-2 divide-x text-xs">
                              <div className="p-3">
                                <div className="text-muted-foreground mb-1">知识1：</div>
                                <HighlightedText text={comp.item1.content} highlight={segment.text} />
                              </div>
                              <div className="p-3">
                                <div className="text-muted-foreground mb-1">知识2：</div>
                                <HighlightedText text={comp.item2.content} highlight={segment.text} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareResult(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 智能添加对话框 */}
      <Dialog open={showSmartAdd} onOpenChange={setShowSmartAdd}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              智能添加知识
            </DialogTitle>
          </DialogHeader>

          {!smartAddResult ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">粘贴文字内容（支持多条知识，用空行分隔）</label>
                <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)}
                  placeholder={`示例：

番茄晚疫病防治
症状：叶片出现水渍状暗绿色斑点
防治：用甲霜灵喷雾

番茄早疫病症状
叶片出现褐色圆形斑点，有同心轮纹`}
                  rows={12} className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground mt-1">提示：用空行分隔不同知识点，系统会自动拆分</p>
              </div>
              <div className="flex items-center gap-4">
                <input ref={fileInputRef} type="file" accept=".md,.txt,.text" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />上传文件
                </Button>
                <div className="flex-1" />
                <Button onClick={handleSmartAdd} disabled={!rawText.trim() || smartAddLoading}>
                  {smartAddLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  智能识别
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {smartAddResult.has_any_conflicts && (
                <div className="border border-orange-200 rounded-lg p-3 bg-orange-50 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-700">部分知识存在冲突，请检查</span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">识别到 {smartAddResult.total} 条知识，请选择要保存的内容</div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {smartAddResult.items.map((item, index) => (
                  <div key={index} className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedItems.has(index) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                    onClick={() => toggleItemSelection(index)}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedItems.has(index)} onChange={() => toggleItemSelection(index)} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{item.structured.title}</h4>
                          <Badge className={getCategoryBadgeColor(item.structured.category)}>{item.structured.category}</Badge>
                          {item.has_conflicts && <Badge className="bg-orange-100 text-orange-800">有冲突</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.structured.content}</p>
                        {item.has_conflicts && (
                          <div className="mt-2 space-y-2">
                            {item.conflicts.map((c, i) => (
                              <div key={i} className="border border-orange-200 rounded-lg overflow-hidden">
                                <div className="bg-orange-50 px-3 py-2">
                                  <span className="text-xs font-medium text-orange-700">
                                    ⚠ 与"{c.title}"存在重复内容
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 divide-x text-xs">
                                  <div className="p-2 bg-blue-50/50">
                                    <span className="text-blue-600 font-medium">新内容</span>
                                    <p className="mt-1 line-clamp-4 text-gray-700">{item.structured.content}</p>
                                  </div>
                                  <div className="p-2 bg-gray-50">
                                    <span className="text-gray-500 font-medium">已有知识</span>
                                    <p className="mt-1 line-clamp-4 text-gray-700">{c.existing_content}</p>
                                  </div>
                                </div>
                                <div className="px-2 py-1.5 bg-amber-50 text-xs text-amber-700">
                                  💡 {c.suggestion}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {smartAddResult ? (
              <>
                <Button variant="outline" onClick={() => setSmartAddResult(null)}>返回修改</Button>
                <Button onClick={handleSaveSelected} disabled={selectedItems.size === 0}>
                  <Check className="h-4 w-4 mr-1" />保存选中的 {selectedItems.size} 条
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowSmartAdd(false)}>取消</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * 高亮显示重复文字组件
 */
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight || highlight.length < 4) {
    return <span className="text-gray-700 line-clamp-4">{text}</span>
  }

  // 清理高亮文本用于匹配
  const cleanHighlight = highlight.replace(/\s+/g, '')

  // 找到高亮文本在原文中的位置
  const cleanText = text.replace(/\s+/g, '')
  const pos = cleanText.indexOf(cleanHighlight)

  if (pos === -1) {
    return <span className="text-gray-700 line-clamp-4">{text}</span>
  }

  // 计算在原始文本中的大致位置（考虑空格）
  let origStart = 0
  let cleanCount = 0
  for (let i = 0; i < text.length; i++) {
    if (cleanCount === pos) {
      origStart = i
      break
    }
    if (/\S/.test(text[i])) cleanCount++
  }

  // 找到结束位置
  let origEnd = origStart
  cleanCount = 0
  for (let i = origStart; i < text.length; i++) {
    if (cleanCount >= cleanHighlight.length) {
      origEnd = i
      break
    }
    if (/\S/.test(text[i])) cleanCount++
  }
  if (cleanCount >= cleanHighlight.length) origEnd = text.length

  const before = text.substring(0, origStart)
  const highlighted = text.substring(origStart, origEnd)
  const after = text.substring(origEnd)

  return (
    <span className="text-gray-700">
      {before.length > 50 && <span>...{before.slice(-50)}</span>}
      {before.length <= 50 && before}
      <mark className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{highlighted}</mark>
      {after.length > 50 && <span>{after.slice(0, 50)}...</span>}
      {after.length <= 50 && after}
    </span>
  )
}
