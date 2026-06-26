"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { AIVideoDetection } from "@/components/dashboard/ai-video-detection"

export default function AIVideoPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="ai-video" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="ai-video" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AIVideoDetection />
        </main>
      </div>
    </div>
  )
}
