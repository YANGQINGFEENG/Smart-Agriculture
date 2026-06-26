"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { DataAnalysis } from "@/components/dashboard/data-analysis"

export default function AnalysisPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="analysis" onTabChange={() => {}} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="analysis" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <DataAnalysis />
        </main>
      </div>
    </div>
  )
}
