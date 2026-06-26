"use client"

import Link from "next/link"
import { useState } from "react"
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
  ChevronDown,
  ChevronRight,
  Monitor,
  Settings,
  Cpu,
  Brain,
} from "lucide-react"

interface SidebarNavProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

interface NavGroup {
  id: string
  label: string
  icon: typeof LayoutDashboard
  items: { id: string; label: string; icon: typeof LayoutDashboard; href: string }[]
}

const navGroups: NavGroup[] = [
  {
    id: "monitor",
    label: "监控中心",
    icon: Monitor,
    items: [
      { id: "overview", label: "数据概览", icon: LayoutDashboard, href: "/" },
      { id: "detailed", label: "精细数据", icon: Database, href: "/detailed" },
      { id: "compare", label: "数据对比", icon: TrendingUp, href: "/compare" },
      { id: "alarms", label: "报警管理", icon: Bell, href: "/alarms" },
    ],
  },
  {
    id: "devices",
    label: "设备管理",
    icon: Settings,
    items: [
      { id: "farms", label: "基地管理", icon: MapPin, href: "/farms" },
      { id: "devices", label: "设备连接", icon: Wifi, href: "/devices" },
      { id: "actuators", label: "执行器控制", icon: Power, href: "/actuators" },
    ],
  },
  {
    id: "analytics",
    label: "数据分析",
    icon: BarChart3,
    items: [
      { id: "analysis", label: "数据分析", icon: BarChart3, href: "/analysis" },
      { id: "export", label: "数据导出", icon: Download, href: "/export" },
    ],
  },
  {
    id: "ai",
    label: "AI智能",
    icon: Brain,
    items: [
      { id: "ai-video", label: "AI视频检测", icon: Camera, href: "/ai-video" },
      { id: "ai-command", label: "AI文字控制", icon: MessageSquare, href: "/ai-command" },
      { id: "ai-monitor", label: "AI实时监测", icon: Activity, href: "/ai-monitor" },
      { id: "model-management", label: "模型管理", icon: Layers, href: "/model-management" },
    ],
  },
  {
    id: "knowledge",
    label: "知识管理",
    icon: BookOpen,
    items: [
      { id: "knowledge", label: "知识库管理", icon: BookOpen, href: "/knowledge" },
      { id: "prompts", label: "提示词模板", icon: FileText, href: "/prompts" },
    ],
  },
]

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  const { farms, selectedFarmId, setSelectedFarmId, loading } = useFarm()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["monitor", "devices", "ai"])
  )

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      {/* 头部：Logo + 基地选择 */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-sm">天工慧眼</h1>
            <p className="text-xs text-muted-foreground">智慧农业物联网平台</p>
          </div>
        </div>
        
        {/* 基地选择器 */}
        {farms.length > 0 && (
          <Select
            value={selectedFarmId?.toString() || ""}
            onValueChange={(v) => setSelectedFarmId(v ? parseInt(v) : null)}
          >
            <SelectTrigger className="h-8 text-xs">
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
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const hasActiveItem = group.items.some(item => item.id === activeTab)

          return (
            <div key={group.id}>
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                  hasActiveItem
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <group.icon className="w-4 h-4" />
                  <span className="font-medium">{group.label}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {/* 子菜单 */}
              {isExpanded && (
                <ul className="mt-1 ml-4 space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                          activeTab === item.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {/* 底部：版本信息 */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
