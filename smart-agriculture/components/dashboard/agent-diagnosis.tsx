"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Bug,
  RefreshCw,
  Activity,
  Database,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentDiagnosisRecord {
  id: number
  gateway_id: number | null
  farm_id: number | null
  node_id: string
  pest_name: string
  confidence: number
  expert_id: string | null
  risk_level: string
  diagnosis: string
  advice: string
  knowledge_source: string
  detected_at: string
  created_at: string
}

function sourceLabel(source: string): string {
  switch (source) {
    case "expert_database":
      return "专家知识库"
    case "deepseek_general":
      return "DeepSeek 通用"
    default:
      return source || "未知"
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-primary"
  if (confidence >= 0.5) return "text-chart-2"
  return "text-muted-foreground"
}

export function AgentDiagnosis() {
  const [records, setRecords] = useState<AgentDiagnosisRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string>("")

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch("/api/device/agent-diagnosis?limit=50", {
        cache: "no-store",
      })
      const json = await res.json()
      if (json.success) {
        setRecords(json.data.records || [])
        setUpdatedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }))
      } else {
        setError(json.error || "获取数据失败")
      }
    } catch {
      setError("网络请求失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [load])

  const expertHits = records.filter(r => r.knowledge_source === "expert_database").length

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bug className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">{records.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">诊疗记录总数</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">{expertHits}</span>
            </div>
            <p className="text-sm text-muted-foreground">专家知识库命中</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">
                {records.length > 0 ? records[0].pest_name : "-"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">最新检测病虫害</p>
          </CardContent>
        </Card>
      </div>

      {/* 记录列表 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Agent 智能诊疗记录
            </span>
            <span className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
              {updatedAt && <span>更新于 {updatedAt}</span>}
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 bg-secondary border-border"
                onClick={() => { setLoading(true); load() }}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                刷新
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-4">{error}</div>
          )}

          {loading && records.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              暂无诊疗记录，等待树莓派 Agent 上报
            </div>
          ) : (
            <div className="space-y-3">
              {records.map(record => (
                <div
                  key={record.id}
                  className="border border-border rounded-lg p-4 bg-background/50 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Bug className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{record.pest_name}</span>
                    {record.expert_id && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                        专家库 {record.expert_id}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="bg-secondary text-xs">
                      {sourceLabel(record.knowledge_source)}
                    </Badge>
                    {record.risk_level && (
                      <Badge variant="secondary" className="bg-chart-3/10 text-chart-3 text-xs">
                        {record.risk_level}
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {record.detected_at || record.created_at}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground mb-2">
                    <span>
                      置信度：
                      <span className={cn("font-medium", confidenceColor(record.confidence))}>
                        {(record.confidence * 100).toFixed(1)}%
                      </span>
                    </span>
                    <span>节点：{record.node_id || "-"}</span>
                    <span>网关ID：{record.gateway_id ?? "-"}</span>
                  </div>
                  {record.diagnosis && (
                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                      <span className="text-muted-foreground">诊断：</span>
                      {record.diagnosis}
                    </p>
                  )}
                  {record.advice && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-1">
                      <span>建议：</span>
                      {record.advice}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
