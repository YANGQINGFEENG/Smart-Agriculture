"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
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
} from "lucide-react"

interface SidebarNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "overview", label: "数据概览", icon: LayoutDashboard },
  { id: "detailed", label: "精细数据", icon: Database },
  { id: "analysis", label: "数据分析", icon: BarChart3 },
  { id: "export", label: "数据导出", icon: Download },
  { id: "devices", label: "设备连接", icon: Wifi },
  { id: "actuators", label: "执行器控制", icon: Power },
  { id: "compare", label: "数据对比", icon: TrendingUp },
]

const sensorTypes = [
  { icon: Thermometer, label: "温度传感器" },
  { icon: Droplets, label: "湿度传感器" },
  { icon: Sun, label: "光照传感器" },
  { icon: Leaf, label: "土壤传感器" },
]

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">智慧农业</h1>
            <p className="text-xs text-muted-foreground">物联网监控平台</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-3 px-3">主功能</p>
          <ul className="space-y-1" role="navigation" aria-label="主功能导航">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                    activeTab === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  aria-current={activeTab === item.id ? "page" : undefined}
                  aria-label={item.label}
                >
                  <item.icon className="w-4 h-4" aria-hidden="true" />
                  {item.label}
                </button>
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
