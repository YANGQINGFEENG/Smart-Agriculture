"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { DetailedData } from "@/components/dashboard/detailed-data"

export default function DetailedPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="detailed" onTabChange={() => {}} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="detailed" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <DetailedData />
        </main>
      </div>
    </div>
  )
}
