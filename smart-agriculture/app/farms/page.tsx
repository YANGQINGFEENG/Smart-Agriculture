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
  MapPin,
  Edit,
  Trash2,
  Loader2,
  Warehouse,
  TreePine,
  Building2,
} from "lucide-react"
import Link from "next/link"

interface Farm {
  id: number
  name: string
  code: string
  address: string | null
  area: number | null
  farm_type: string
  status: string
  created_at: string
}

const farmTypeLabels: Record<string, string> = {
  greenhouse: '温室大棚',
  field: '露天田地',
  mixed: '综合基地',
}

const farmTypeIcons: Record<string, typeof Warehouse> = {
  greenhouse: TreePine,
  field: Building2,
  mixed: Warehouse,
}

export default function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null)
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    area: "",
    farm_type: "mixed",
  })

  const fetchFarms = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/farms')
      const result = await response.json()
      if (result.success) setFarms(result.data)
    } catch (error) {
      console.error("获取基地列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFarms() }, [])

  const handleCreate = () => {
    setEditingFarm(null)
    setForm({ name: "", code: "", address: "", area: "", farm_type: "mixed" })
    setShowDialog(true)
  }

  const handleEdit = (farm: Farm) => {
    setEditingFarm(farm)
    setForm({
      name: farm.name,
      code: farm.code,
      address: farm.address || "",
      area: farm.area?.toString() || "",
      farm_type: farm.farm_type,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    try {
      const url = editingFarm ? `/api/farms/${editingFarm.id}` : '/api/farms'
      const method = editingFarm ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          area: form.area ? parseFloat(form.area) : null,
        }),
      })
      if (response.ok) {
        setShowDialog(false)
        fetchFarms()
      }
    } catch (error) {
      console.error("保存失败:", error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个基地吗？删除后该基地下的所有区域和设备数据将被删除。")) return
    try {
      await fetch(`/api/farms/${id}`, { method: 'DELETE' })
      fetchFarms()
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="farms" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="farms" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="h-6 w-6" />
                  基地管理
                </h1>
                <p className="text-muted-foreground">共 {farms.length} 个基地</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchFarms}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增基地
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : farms.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Warehouse className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">暂无基地</p>
                <p className="text-sm">点击"新增基地"开始创建</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {farms.map((farm) => {
                  const TypeIcon = farmTypeIcons[farm.farm_type] || Warehouse
                  return (
                    <Link key={farm.id} href={`/farms/${farm.id}`}>
                      <div className="border rounded-lg p-5 hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <TypeIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{farm.name}</h3>
                              <p className="text-xs text-muted-foreground">{farm.code}</p>
                            </div>
                          </div>
                          <Badge className={farm.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                            {farm.status === 'active' ? '运营中' : '已停用'}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>类型：{farmTypeLabels[farm.farm_type]}</p>
                          {farm.address && <p>地址：{farm.address}</p>}
                          {farm.area && <p>面积：{farm.area} 亩</p>}
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t">
                          <span className="text-xs text-muted-foreground">
                            创建于 {new Date(farm.created_at).toLocaleDateString('zh-CN')}
                          </span>
                          <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(farm)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(farm.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFarm ? '编辑基地' : '新增基地'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">基地名称 *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：北京一号基地" />
            </div>
            <div>
              <label className="text-sm font-medium">基地编码 *</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如：BJ-001" disabled={!!editingFarm} />
            </div>
            <div>
              <label className="text-sm font-medium">基地类型</label>
              <Select value={form.farm_type} onValueChange={(v) => setForm({ ...form, farm_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="greenhouse">温室大棚</SelectItem>
                  <SelectItem value="field">露天田地</SelectItem>
                  <SelectItem value="mixed">综合基地</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">地址</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="详细地址" />
            </div>
            <div>
              <label className="text-sm font-medium">面积（亩）</label>
              <Input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.code}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
