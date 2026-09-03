"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ScanEye,
  RefreshCw,
  ArrowRightLeft,
  Upload,
  Plus,
  Trash2,
  Layers,
  Timer,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDrive,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface YoloModel {
  id: number
  gateway_ip: string
  name: string
  filename: string
  description: string
  source: string
  file_url: string | null
  file_size: number
  size_mb: number
  class_count: number
  classes: string[]
  is_active: boolean
  status: string
  last_message: string
  model_modified_at: string | null
  on_device: boolean
  is_current: boolean
}

interface YoloStatus {
  current_model: string | null
  loaded: boolean
  class_count: number
  classes: string[]
  img_size: number | null
  conf_threshold: number | null
  avg_inference_time_ms: number | null
  total_inferences: number
  switch_count: number
  last_switch_at: string | null
  last_error: string | null
  switching: boolean
  local_models: string[]
  reported_at: string | null
}

interface SwitchLog {
  id: number
  gateway_ip: string
  filename: string
  from_model: string | null
  status: string
  message: string
  pushed_at: string | null
  acked_at: string | null
}

interface GatewayOption {
  id: number
  name: string
  ip_address: string
  status: string
}

const SOURCE_LABEL: Record<string, string> = {
  official: "官方通用",
  trained: "自训练",
  custom: "自定义上传",
}

const LOG_STATUS_LABEL: Record<string, string> = {
  pending: "待下发",
  pushed: "已下发",
  success: "切换成功",
  failed: "切换失败",
  timeout: "超时未回执",
}

export function YoloModelSwitch() {
  const [gateways, setGateways] = useState<GatewayOption[]>([])
  const [selectedIp, setSelectedIp] = useState("")
  const [models, setModels] = useState<YoloModel[]>([])
  const [status, setStatus] = useState<YoloStatus | null>(null)
  const [officialNames, setOfficialNames] = useState<string[]>([])
  const [logs, setLogs] = useState<SwitchLog[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingOfficial, setPendingOfficial] = useState("")
  const [notice, setNotice] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null)
  const activeRequestId = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchModels = useCallback(async (ip: string) => {
    const res = await fetch(`/api/device/yolo-models?gateway_ip=${encodeURIComponent(ip)}`, {
      cache: "no-store",
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || "获取模型清单失败")
    return json.data
  }, [])

  const fetchLogs = useCallback(async (ip: string) => {
    try {
      const res = await fetch(
        `/api/device/yolo-models/switch?gateway_ip=${encodeURIComponent(ip)}&limit=10`,
        { cache: "no-store" }
      )
      const json = await res.json()
      return json.success ? (json.data as SwitchLog[]) : []
    } catch {
      return [] as SwitchLog[]
    }
  }, [])

  const refresh = useCallback(
    async (ip: string, silent = true) => {
      if (!ip) return
      try {
        const data = await fetchModels(ip)
        setModels(data.models || [])
        setStatus(data.status || null)
        const freshLogs = await fetchLogs(ip)
        setLogs(freshLogs)

        // 切换请求已回执：结束等待并提示结果
        const reqId = activeRequestId.current
        if (reqId) {
          const log = freshLogs.find((l) => l.id === reqId)
          if (log && ["success", "failed", "timeout"].includes(log.status)) {
            activeRequestId.current = null
            setSwitching(false)
            setNotice({
              tone: log.status === "success" ? "ok" : "err",
              text: `${LOG_STATUS_LABEL[log.status] || log.status}：${log.message || log.filename}`,
            })
          }
        }
      } catch (error) {
        if (!silent) {
          setNotice({
            tone: "err",
            text: error instanceof Error ? error.message : "刷新失败",
          })
        }
      }
    },
    [fetchModels, fetchLogs]
  )

  // 首次加载：先取网关列表，默认选中在线网关
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await fetchModels("")
        if (!alive) return
        const list: GatewayOption[] = data.gateways || []
        setGateways(list)
        setOfficialNames(data.official_model_names || [])
        const preferred =
          list.find((g) => g.ip_address === data.default_gateway_ip) ||
          list.find((g) => g.status === "online") ||
          list[0]
        const ip = preferred?.ip_address || ""
        setSelectedIp(ip)
        if (ip) {
          const scoped = await fetchModels(ip)
          if (!alive) return
          setModels(scoped.models || [])
          setStatus(scoped.status || null)
          setLogs(await fetchLogs(ip))
        } else {
          setModels(data.models || [])
          setStatus(data.status || null)
        }
      } catch (error) {
        if (alive) {
          setNotice({
            tone: "err",
            text: error instanceof Error ? error.message : "加载失败",
          })
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [fetchModels, fetchLogs])

  // 轮询：切换进行中 3 秒，平时 15 秒
  useEffect(() => {
    if (!selectedIp) return
    const timer = setInterval(() => refresh(selectedIp), switching ? 3000 : 15000)
    return () => clearInterval(timer)
  }, [selectedIp, switching, refresh])

  const handleSelectGateway = (ip: string) => {
    setSelectedIp(ip)
    activeRequestId.current = null
    setSwitching(false)
    setModels([])
    setStatus(null)
    setLogs([])
    setLoading(true)
    refresh(ip, false).finally(() => setLoading(false))
  }

  const handleSwitch = async (model: YoloModel) => {
    if (!selectedIp) {
      setNotice({ tone: "err", text: "请先选择网关" })
      return
    }
    setSwitching(true)
    setNotice({ tone: "info", text: `正在下发切换指令：${model.filename}` })
    try {
      const res = await fetch("/api/device/yolo-models/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway_ip: selectedIp, model_id: model.id }),
      })
      const json = await res.json()
      if (!json.success) {
        setSwitching(false)
        setNotice({ tone: "err", text: json.error || "切换请求失败" })
        return
      }
      activeRequestId.current = json.request_id
      if (!json.sent) {
        setSwitching(false)
        activeRequestId.current = null
        setNotice({ tone: "err", text: json.message || "网关未连接，指令未送达" })
      } else {
        setNotice({
          tone: "info",
          text: `指令已下发（请求 #${json.request_id}），硬件端加载模型中...`,
        })
      }
      await refresh(selectedIp)
    } catch (error) {
      setSwitching(false)
      setNotice({
        tone: "err",
        text: error instanceof Error ? error.message : "切换请求异常",
      })
    }
  }

  const handleAddOfficial = async () => {
    if (!selectedIp || !pendingOfficial) return
    try {
      const res = await fetch("/api/device/yolo-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway_ip: selectedIp,
          filename: pendingOfficial,
          source: "official",
          description: "YOLO 官方通用模型（COCO 80 类）",
        }),
      })
      const json = await res.json()
      setNotice({
        tone: json.success ? "ok" : "err",
        text: json.success ? `已登记 ${pendingOfficial}，可点击切换（设备将自动下载）` : json.error,
      })
      setPendingOfficial("")
      await refresh(selectedIp)
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "登记失败" })
    }
  }

  const handleUpload = async (file: File) => {
    if (!selectedIp) {
      setNotice({ tone: "err", text: "请先选择网关" })
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("gateway_ip", selectedIp)
      form.append("file", file)
      form.append("name", file.name)
      form.append("source", "custom")
      form.append("description", `网页端上传：${file.name}`)
      const res = await fetch("/api/device/yolo-models", { method: "POST", body: form })
      const json = await res.json()
      setNotice({
        tone: json.success ? "ok" : "err",
        text: json.success ? `${file.name} 上传成功，可切换到该模型` : json.error,
      })
      await refresh(selectedIp)
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "上传失败" })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (model: YoloModel) => {
    if (!window.confirm(`确认删除模型登记「${model.name}」？（不会删除设备本地文件）`)) return
    try {
      await fetch(`/api/device/yolo-models?id=${model.id}`, { method: "DELETE" })
      setNotice({ tone: "ok", text: `已删除登记：${model.filename}` })
      await refresh(selectedIp)
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "删除失败" })
    }
  }

  const registeredFilenames = models.map((m) => m.filename)
  const addableOfficials = officialNames.filter((n) => !registeredFilenames.includes(n))
  const currentGateway = gateways.find((g) => g.ip_address === selectedIp)

  return (
    <div className="space-y-4">
      {/* 网关选择 + 提示 */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ScanEye className="w-5 h-5 text-primary" />
            </div>
            <div className="mr-auto">
              <p className="text-sm font-medium text-foreground">识别模型切换</p>
              <p className="text-xs text-muted-foreground">
                网页端下发指令，树莓派热切换 YOLO 识别模型（无需重启服务）
              </p>
            </div>
            <Select value={selectedIp} onValueChange={handleSelectGateway}>
              <SelectTrigger className="w-[240px] h-8 text-xs bg-secondary border-border">
                <SelectValue placeholder="选择网关（树莓派）" />
              </SelectTrigger>
              <SelectContent>
                {gateways.map((g) => (
                  <SelectItem key={g.id} value={g.ip_address}>
                    {g.name}（{g.ip_address}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                currentGateway?.status === "online"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {currentGateway?.status === "online" ? "网关在线" : "网关离线"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 bg-secondary border-border"
              onClick={() => {
                setLoading(true)
                refresh(selectedIp, false).finally(() => setLoading(false))
              }}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              刷新
            </Button>
          </div>

          {notice && (
            <div
              className={cn(
                "flex items-start gap-2 text-xs rounded-md border px-3 py-2",
                notice.tone === "ok" && "border-primary/30 bg-primary/5 text-primary",
                notice.tone === "err" && "border-destructive/30 bg-destructive/5 text-destructive",
                notice.tone === "info" && "border-border bg-secondary text-muted-foreground"
              )}
            >
              {notice.tone === "info" ? (
                <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin shrink-0" />
              ) : notice.tone === "ok" ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 硬件端当前识别状态 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <ScanEye className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground text-right max-w-[60%] truncate">
                {status?.current_model || "未上报"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              当前识别模型
              {status?.loaded ? (
                <span className="text-primary ml-1">已加载</span>
              ) : (
                <span className="text-muted-foreground ml-1">未加载</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">{status?.class_count ?? 0}</span>
            </div>
            <p
              className="text-sm text-muted-foreground truncate"
              title={(status?.classes || []).join(", ")}
            >
              可识别类别
              {(status?.classes || []).length > 0 && (
                <span className="text-foreground/70">
                  {" · "}
                  {(status?.classes || []).slice(0, 3).join(", ")}
                  {(status?.classes || []).length > 3 ? " …" : ""}
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Timer className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">
                {status?.avg_inference_time_ms != null
                  ? Number(status.avg_inference_time_ms).toFixed(0)
                  : "-"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              平均推理耗时 (ms)
              {status?.img_size ? ` · ${status.img_size}px` : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl font-bold text-foreground">
                {status?.total_inferences ?? 0}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              累计推理次数 · 切换 {status?.switch_count ?? 0} 次
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 模型清单 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 mr-auto">
              <HardDrive className="w-4 h-4 text-primary" />
              可用识别模型（{models.length}）
            </span>
            {addableOfficials.length > 0 && (
              <span className="flex items-center gap-1">
                <Select value={pendingOfficial} onValueChange={setPendingOfficial}>
                  <SelectTrigger className="w-[150px] h-7 text-xs bg-secondary border-border">
                    <SelectValue placeholder="添加官方模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {addableOfficials.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 bg-secondary border-border"
                  disabled={!pendingOfficial}
                  onClick={handleAddOfficial}
                >
                  <Plus className="w-3.5 h-3.5" />
                  登记
                </Button>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 bg-secondary border-border"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              上传 .pt 模型
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && models.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
          ) : models.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              暂无模型登记。可添加官方通用模型（如 yolo11n.pt），设备端会自动下载
            </div>
          ) : (
            <div className="space-y-3">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={cn(
                    "border rounded-lg p-4 transition-colors",
                    model.is_current
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background/50 hover:bg-secondary/30"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ScanEye
                      className={cn(
                        "w-4 h-4",
                        model.is_current ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="font-medium text-foreground">{model.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {model.filename}
                    </span>
                    <Badge variant="secondary" className="bg-secondary text-xs">
                      {SOURCE_LABEL[model.source] || model.source}
                    </Badge>
                    {model.is_current && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                        使用中
                      </Badge>
                    )}
                    {model.is_active && !model.is_current && (
                      <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 text-xs">
                        云端期望
                      </Badge>
                    )}
                    {model.on_device ? (
                      <Badge variant="secondary" className="bg-secondary text-xs">
                        设备已就绪
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-chart-3/10 text-chart-3 text-xs">
                        需下载
                      </Badge>
                    )}
                    {model.status === "failed" && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                        上次失败
                      </Badge>
                    )}
                    <span className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 bg-secondary border-border text-destructive"
                        onClick={() => handleDelete(model)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1"
                        disabled={model.is_current || switching}
                        onClick={() => handleSwitch(model)}
                      >
                        {switching && !model.is_current ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        )}
                        {model.is_current ? "当前模型" : "切换到此模型"}
                      </Button>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground mt-2">
                    <span>
                      大小：
                      {model.size_mb
                        ? `${Number(model.size_mb).toFixed(2)} MB`
                        : model.file_size
                          ? `${(model.file_size / 1024 / 1024).toFixed(2)} MB`
                          : "-"}
                    </span>
                    <span>类别数：{model.class_count || "-"}</span>
                    {model.model_modified_at && <span>设备文件：{model.model_modified_at}</span>}
                    {status?.reported_at && <span>状态上报：{status.reported_at}</span>}
                  </div>
                  {(model.description || model.last_message) && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {model.last_message || model.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 切换记录 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            切换记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">暂无切换记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">请求</TableHead>
                  <TableHead className="text-xs">目标模型</TableHead>
                  <TableHead className="text-xs">原模型</TableHead>
                  <TableHead className="text-xs">结果</TableHead>
                  <TableHead className="text-xs">说明</TableHead>
                  <TableHead className="text-xs">下发时间</TableHead>
                  <TableHead className="text-xs">回执时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="border-border">
                    <TableCell className="text-xs text-muted-foreground">#{log.id}</TableCell>
                    <TableCell className="text-xs text-foreground font-mono">
                      {log.filename}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.from_model || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          log.status === "success" && "bg-primary/10 text-primary",
                          (log.status === "failed" || log.status === "timeout") &&
                            "bg-destructive/10 text-destructive",
                          (log.status === "pending" || log.status === "pushed") &&
                            "bg-chart-2/10 text-chart-2"
                        )}
                      >
                        {LOG_STATUS_LABEL[log.status] || log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                      {log.message || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.pushed_at ? new Date(log.pushed_at).toLocaleString("zh-CN", { hour12: false }) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.acked_at ? new Date(log.acked_at).toLocaleString("zh-CN", { hour12: false }) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
