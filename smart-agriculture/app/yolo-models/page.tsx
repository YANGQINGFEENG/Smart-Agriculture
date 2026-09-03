"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { YoloModelSwitch } from "@/components/dashboard/yolo-model-switch"

export default function YoloModelsPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="yolo-models" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="yolo-models" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <YoloModelSwitch />
        </main>
      </div>
    </div>
  )
}
