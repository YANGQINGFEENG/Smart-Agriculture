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
  BookOpen,
  ChevronRight,
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
  structured: {
    title: string
    content: string
    category: string
    tags: string
  }
  conflicts: Array<{
    id: number
    title: string
    similarity: number
    type: string
    suggestion: string
  }>
  has_conflicts: boolean
}

interface SmartAddResult {
  items: SmartAddItem[]
  total: number
  has_any_conflicts: boolean
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

export default function KnowledgePage() {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

  // 智能添加状态
  const [showSmartAdd, setShowSmartAdd] = useState(false)
  const [rawText, setRawText] = useState("")
  const [smartAddLoading, setSmartAddLoading] = useState(false)
  const [smartAddResult, setSmartAddResult] = useState<SmartAddResult | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 查看详情状态
  const [viewingItem, setViewingItem] = useState<KnowledgeItem | null>(null)

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

  useEffect(() => {
    fetchKnowledge(1)
  }, [filterCategory])

  const handleSearch = () => fetchKnowledge(1)

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
        // 默认全选
        setSelectedItems(new Set(result.data.items.map((_: any, i: number) => i)))
      }
    } catch (error) {
      console.error("智能添加失败:", error)
    } finally {
      setSmartAddLoading(false)
    }
  }

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      setRawText(text)
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 保存选中的知识
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

  // 删除知识
  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条知识吗？")) return
    try {
      const response = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      if (response.ok) fetchKnowledge(pagination.page)
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  // 切换选中状态
  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  // 获取分类颜色
  const getCategoryColor = (category: string) => {
    return categoryColors[category] || 'from-gray-500 to-gray-600'
  }

  // 获取分类标签颜色
  const getCategoryBadgeColor = (category: string) => {
    const found = categoryOptions.find(c => c.value === category)
    return found?.color || 'bg-gray-100 text-gray-800'
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="h-6 w-6" />
                  知识库
                </h1>
                <p className="text-muted-foreground">共 {pagination.total} 条知识</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchKnowledge(pagination.page)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setShowSmartAdd(true); setSmartAddResult(null); setRawText(""); setSelectedItems(new Set()) }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  智能添加
                </Button>
              </div>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex flex-col md:flex-row gap-4">
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
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
            </div>

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
                  <div
                    key={item.id}
                    className="group cursor-pointer"
                    onClick={() => setViewingItem(item)}
                  >
                    {/* 书本封面 */}
                    <div className={`relative h-44 rounded-lg bg-gradient-to-br ${getCategoryColor(item.category)} p-5 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}>
                      {/* 书脊效果 */}
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/5 rounded-l-lg" />

                      {/* 内容 */}
                      <div className="relative h-full flex flex-col justify-between text-white/90">
                        <div>
                          <Badge className="bg-white/15 text-white/80 border-0 text-xs mb-2">
                            {item.category}
                          </Badge>
                          <h3 className="font-semibold text-base line-clamp-2 drop-shadow-sm">{item.title}</h3>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs opacity-60">
                            {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                          </span>
                          <ChevronRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* 状态标签 */}
                      <div className="absolute top-2 right-2">
                        <Badge className={`${statusColors[item.status]} text-xs`}>
                          {item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '归档'}
                        </Badge>
                      </div>
                    </div>

                    {/* 书本底部 */}
                    <div className="mt-2 px-1">
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                      {item.tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.split(',').slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag.trim()}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 分页 */}
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
          </div>
        </main>
      </div>

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
                <label className="text-sm font-medium mb-2 block">
                  粘贴文字内容（支持多条知识，用空行分隔）
                </label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`示例：

番茄晚疫病防治
症状：叶片出现水渍状暗绿色斑点
防治：用甲霜灵喷雾

番茄早疫病症状
叶片出现褐色圆形斑点，有同心轮纹
用代森锰锌防治

也可以上传 .md 或 .txt 文件`}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  提示：用空行分隔不同知识点，系统会自动拆分
                </p>
              </div>

              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.text"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
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
                  智能识别
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 冲突提示 */}
              {smartAddResult.has_any_conflicts && (
                <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">
                      部分知识存在冲突，请检查
                    </span>
                  </div>
                </div>
              )}

              {/* 拆分结果 */}
              <div className="text-sm text-muted-foreground mb-2">
                识别到 {smartAddResult.total} 条知识，请选择要保存的内容
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {smartAddResult.items.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedItems.has(index)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => toggleItemSelection(index)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(index)}
                        onChange={() => toggleItemSelection(index)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{item.structured.title}</h4>
                          <Badge className={getCategoryBadgeColor(item.structured.category)}>
                            {item.structured.category}
                          </Badge>
                          {item.has_conflicts && (
                            <Badge className="bg-orange-100 text-orange-800">
                              有冲突
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.structured.content}
                        </p>
                        {item.structured.tags && (
                          <div className="flex gap-1 mt-1">
                            {item.structured.tags.split(',').map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag.trim()}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {/* 冲突详情 */}
                        {item.has_conflicts && (
                          <div className="mt-2 p-2 bg-orange-50 rounded text-xs">
                            {item.conflicts.map((c, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-orange-600">⚠</span>
                                <span>与"{c.title}"相似 {c.similarity}%</span>
                                <span className="text-muted-foreground">- {c.suggestion}</span>
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
                <Button variant="outline" onClick={() => setSmartAddResult(null)}>
                  返回修改
                </Button>
                <Button onClick={handleSaveSelected} disabled={selectedItems.size === 0}>
                  <Check className="h-4 w-4 mr-2" />
                  保存选中的 {selectedItems.size} 条
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

      {/* 查看详情对话框 */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewingItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {viewingItem.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getCategoryBadgeColor(viewingItem.category)}>
                    {viewingItem.category}
                  </Badge>
                  <Badge className={statusColors[viewingItem.status]}>
                    {viewingItem.status === 'draft' ? '草稿' : viewingItem.status === 'published' ? '已发布' : '归档'}
                  </Badge>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{viewingItem.content}</p>
                </div>
                {viewingItem.tags && (
                  <div className="flex flex-wrap gap-1">
                    {viewingItem.tags.split(',').map((tag, i) => (
                      <Badge key={i} variant="outline">{tag.trim()}</Badge>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  更新时间: {new Date(viewingItem.updated_at).toLocaleString('zh-CN')}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingItem(null)}>关闭</Button>
                <Button
                  variant="destructive"
                  onClick={() => { handleDelete(viewingItem.id); setViewingItem(null) }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
