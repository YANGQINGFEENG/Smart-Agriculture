"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { DeviceStatus } from "@/components/dashboard/device-status"

export default function DevicesPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="devices" onTabChange={() => {}} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="devices" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <DeviceStatus />
        </main>
      </div>
    </div>
  )
}
