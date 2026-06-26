"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { DataExport } from "@/components/dashboard/data-export"

export default function ExportPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="export" onTabChange={() => {}} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="export" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <DataExport />
        </main>
      </div>
    </div>
  )
}
