"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { AIRealtimeMonitor } from "@/components/dashboard/ai-realtime-monitor"

export default function AIMonitorPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="ai-monitor" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="ai-monitor" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AIRealtimeMonitor />
        </main>
      </div>
    </div>
  )
}
