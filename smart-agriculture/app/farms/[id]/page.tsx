"use client"

import { useState, useEffect, use } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Layers,
  Thermometer,
  Power,
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  TreePine,
  Building2,
  Warehouse,
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
  zones: Zone[]
  stats: { zones: number; sensors: number; actuators: number }
}

interface Zone {
  id: number
  name: string
  code: string
  zone_type: string
  area: number | null
  description: string | null
  status: string
}

const zoneTypeLabels: Record<string, string> = {
  greenhouse: '温室大棚',
  field: '露天田地',
  warehouse: '仓库',
}

export default function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [farm, setFarm] = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)
  const [showZoneDialog, setShowZoneDialog] = useState(false)
  const [zoneForm, setZoneForm] = useState({ name: "", code: "", zone_type: "greenhouse", area: "", description: "" })

  const fetchFarm = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/farms/${id}`)
      const result = await response.json()
      if (result.success) setFarm(result.data)
    } catch (error) {
      console.error("获取基地详情失败:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFarm() }, [id])

  const handleCreateZone = async () => {
    try {
      const response = await fetch(`/api/farms/${id}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...zoneForm,
          area: zoneForm.area ? parseFloat(zoneForm.area) : null,
        }),
      })
      if (response.ok) {
        setShowZoneDialog(false)
        fetchFarm()
        setZoneForm({ name: "", code: "", zone_type: "greenhouse", area: "", description: "" })
      }
    } catch (error) {
      console.error("创建区域失败:", error)
    }
  }

  const handleDeleteZone = async (zoneId: number) => {
    if (!confirm("确定要删除这个区域吗？")) return
    try {
      await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' })
      fetchFarm()
    } catch (error) {
      console.error("删除区域失败:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="hidden md:block"><SidebarNav activeTab="farms" onTabChange={() => {}} /></div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!farm) {
    return (
      <div className="flex h-screen bg-background">
        <div className="hidden md:block"><SidebarNav activeTab="farms" onTabChange={() => {}} /></div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">基地不存在</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block"><SidebarNav activeTab="farms" onTabChange={() => {}} /></div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="farms" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 返回按钮和标题 */}
            <div className="flex items-center gap-4">
              <Link href="/farms" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="h-6 w-6" />
                  {farm.name}
                </h1>
                <p className="text-muted-foreground">{farm.code} · {farm.address || '未设置地址'}</p>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{farm.stats.zones}</div>
                  <div className="text-xs text-muted-foreground">区域数量</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{farm.stats.sensors}</div>
                  <div className="text-xs text-muted-foreground">传感器</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{farm.stats.actuators}</div>
                  <div className="text-xs text-muted-foreground">执行器</div>
                </CardContent>
              </Card>
            </div>

            {/* 区域管理 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  区域管理
                </CardTitle>
                <Button size="sm" onClick={() => setShowZoneDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  新增区域
                </Button>
              </CardHeader>
              <CardContent>
                {farm.zones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>暂无区域</p>
                    <p className="text-sm">点击"新增区域"开始创建</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {farm.zones.map((zone) => (
                      <div key={zone.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{zone.name}</h3>
                            <p className="text-xs text-muted-foreground">{zone.code}</p>
                          </div>
                          <Badge variant="outline">{zoneTypeLabels[zone.zone_type] || zone.zone_type}</Badge>
                        </div>
                        {zone.area && <p className="text-sm text-muted-foreground mt-2">面积：{zone.area} 亩</p>}
                        {zone.description && <p className="text-sm text-muted-foreground mt-1">{zone.description}</p>}
                        <div className="flex justify-end mt-3">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteZone(zone.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增区域</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">区域名称 *</label>
              <Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="如：1号大棚" />
            </div>
            <div>
              <label className="text-sm font-medium">区域编码 *</label>
              <Input value={zoneForm.code} onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })} placeholder="如：GH1" />
            </div>
            <div>
              <label className="text-sm font-medium">区域类型</label>
              <Select value={zoneForm.zone_type} onValueChange={(v) => setZoneForm({ ...zoneForm, zone_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="greenhouse">温室大棚</SelectItem>
                  <SelectItem value="field">露天田地</SelectItem>
                  <SelectItem value="warehouse">仓库</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">面积（亩）</label>
              <Input type="number" value={zoneForm.area} onChange={(e) => setZoneForm({ ...zoneForm, area: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="text-sm font-medium">描述</label>
              <Textarea value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} placeholder="区域描述" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZoneDialog(false)}>取消</Button>
            <Button onClick={handleCreateZone} disabled={!zoneForm.name || !zoneForm.code}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
