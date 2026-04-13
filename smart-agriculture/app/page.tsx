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
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-h-screen">
        <Header activeTab={activeTab} />
        
        <main className="flex-1 p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
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
        
        <footer className="h-12 border-t border-border bg-card/50 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            智慧农业物联网监控平台 v1.0.0 | 数据更新时间: {currentTime || "--"}
          </p>
        </footer>
      </div>
    </div>
  )
}
