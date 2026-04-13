"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

const AnalysisClient = dynamic(
  () => import("./analysis-client").then((mod) => mod.AnalysisClient),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="pt-6 h-[120px] flex items-center justify-center">
                <Spinner className="text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">温度预测分析</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] flex items-center justify-center">
              <Spinner className="text-primary" />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">传感器分布</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] flex items-center justify-center">
              <Spinner className="text-primary" />
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  }
)

export function DataAnalysis() {
  return <AnalysisClient />
}
