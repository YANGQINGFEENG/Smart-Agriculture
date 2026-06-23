"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { useFarm } from "@/lib/farm-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LayoutDashboard,
  BarChart3,
  Database,
  Download,
  Wifi,
  Settings,
  Leaf,
  Droplets,
  Thermometer,
  Sun,
  TrendingUp,
  Power,
  Camera,
  MessageSquare,
  Layers,
  Activity,
  BookOpen,
  FileText,
  Bell,
  MapPin,
} from "lucide-react"

interface SidebarNavProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

const navItems = [
  { id: "overview", label: "数据概览", icon: LayoutDashboard, href: "/" },
  { id: "farms", label: "基地管理", icon: MapPin, href: "/farms" },
  { id: "detailed", label: "精细数据", icon: Database, href: "/detailed" },
  { id: "analysis", label: "数据分析", icon: BarChart3, href: "/analysis" },
  { id: "export", label: "数据导出", icon: Download, href: "/export" },
  { id: "devices", label: "设备连接", icon: Wifi, href: "/devices" },
  { id: "actuators", label: "执行器控制", icon: Power, href: "/actuators" },
  { id: "compare", label: "数据对比", icon: TrendingUp, href: "/compare" },
  { id: "alarms", label: "报警管理", icon: Bell, href: "/alarms" },
  { id: "ai-video", label: "AI视频检测", icon: Camera, href: "/ai-video" },
  { id: "ai-command", label: "AI文字控制", icon: MessageSquare, href: "/ai-command" },
  { id: "ai-monitor", label: "AI实时监测", icon: Activity, href: "/ai-monitor" },
  { id: "model-management", label: "模型管理", icon: Layers, href: "/model-management" },
  { id: "knowledge", label: "知识库管理", icon: BookOpen, href: "/knowledge" },
  { id: "prompts", label: "提示词模板", icon: FileText, href: "/prompts" },
]

const sensorTypes = [
  { icon: Thermometer, label: "温度传感器" },
  { icon: Droplets, label: "湿度传感器" },
  { icon: Sun, label: "光照传感器" },
  { icon: Leaf, label: "土壤传感器" },
]

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  const { farms, selectedFarmId, setSelectedFarmId, loading } = useFarm()

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">智慧农业</h1>
            <p className="text-xs text-muted-foreground">物联网监控平台</p>
          </div>
        </div>
        
        {/* 基地选择器 */}
        {farms.length > 0 && (
          <div className="mt-2">
            <label className="text-xs text-muted-foreground mb-1 block">当前基地</label>
            <Select
              value={selectedFarmId?.toString() || ""}
              onValueChange={(v) => setSelectedFarmId(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="选择基地" />
              </SelectTrigger>
              <SelectContent>
                {farms.map((farm) => (
                  <SelectItem key={farm.id} value={farm.id.toString()}>
                    {farm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4">
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-3 px-3">主功能</p>
          <ul className="space-y-1" role="navigation" aria-label="主功能导航">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                    "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  aria-label={item.label}
                >
                  <item.icon className="w-4 h-4" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3 px-3">传感器类型</p>
          <ul className="space-y-1" role="list" aria-label="传感器类型列表">
            {sensorTypes.map((sensor, index) => (
              <li key={index} role="listitem">
                <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                  <sensor.icon className="w-4 h-4" aria-hidden="true" />
                  {sensor.label}
                  <span className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" aria-label="在线" />
                </div>
              </li>
            ))}
          </ul>
        </div>

      </nav>

      <div className="p-4 border-t border-border">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200" aria-label="系统设置">
          <Settings className="w-4 h-4" aria-hidden="true" />
          系统设置
        </button>
      </div>
    </aside>
  )
}
