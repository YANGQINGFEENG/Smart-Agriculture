"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { AICommandControl } from "@/components/dashboard/ai-command-control"

export default function AICommandPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="ai-command" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="ai-command" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AICommandControl />
        </main>
      </div>
    </div>
  )
}
