"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { AgentDiagnosis } from "@/components/dashboard/agent-diagnosis"

export default function AgentDiagnosisPage() {
  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <SidebarNav activeTab="agent-diagnosis" onTabChange={() => {}} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeTab="agent-diagnosis" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AgentDiagnosis />
        </main>
      </div>
    </div>
  )
}
