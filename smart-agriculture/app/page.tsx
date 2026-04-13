"use client"

import { useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { OverviewCards } from "@/components/dashboard/overview-cards"
import { DataCharts } from "@/components/dashboard/data-charts"
import { DetailedData } from "@/components/dashboard/detailed-data"
import { DataAnalysis } from "@/components/dashboard/data-analysis"
import { DataExport } from "@/components/dashboard/data-export"
import { DeviceStatus } from "@/components/dashboard/device-status"
import { ActuatorStatus } from "@/components/dashboard/actuator-status"
import { Menu, X } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [currentTime, setCurrentTime] = useState<string>("")

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString("zh-CN"))
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString("zh-CN"))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      {/* 侧边栏 - 在大屏幕上显示，小屏幕上隐藏 */}
      <div className="hidden lg:flex">
        <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
      <div className="flex-1 flex flex-col min-h-screen">
        {/* 移动端导航按钮 */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg bg-card border border-border shadow-lg">
                <Menu className="w-6 h-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
            </SheetContent>
          </Sheet>
        </div>
        
        <Header activeTab={activeTab} />
        
        <main className="flex-1 p-4 md:p-6">
          {activeTab === "overview" && (
            <div className="space-y-4 md:space-y-6">
              <OverviewCards />
              <ActuatorStatus />
              <DataCharts />
            </div>
          )}
          
          {activeTab === "detailed" && <DetailedData />}
          
          {activeTab === "analysis" && <DataAnalysis />}
          
          {activeTab === "export" && <DataExport />}
          
          {activeTab === "devices" && <DeviceStatus />}
        </main>
        
        <footer className="h-12 border-t border-border bg-card/50 flex items-center justify-center px-4">
          <p className="text-xs text-muted-foreground text-center">
            智慧农业物联网监控平台 v1.0.0 | 数据更新时间: {currentTime || "--"}
          </p>
        </footer>
      </div>
    </div>
  )
}
