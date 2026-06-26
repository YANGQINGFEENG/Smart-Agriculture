"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { ModelManagement } from "@/components/dashboard/model-management"

export default function ModelManagementPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="model-management" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="model-management" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ModelManagement />
        </main>
      </div>
    </div>
  )
}
