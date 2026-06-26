"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import zhCN from "date-fns/locale/zh-CN"
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  CalendarIcon,
  CheckCircle,
  Clock,
  HardDrive,
} from "lucide-react"

const exportHistory = [
  {
    id: 1,
    name: "sensor_data_2024-01-15.csv",
    type: "CSV",
    size: "2.4 MB",
    date: "2024-01-15 14:30",
    status: "completed",
  },
  {
    id: 2,
    name: "analysis_report_2024-01-14.xlsx",
    type: "Excel",
    size: "5.1 MB",
    date: "2024-01-14 09:15",
    status: "completed",
  },
  {
    id: 3,
    name: "weekly_summary_w2.json",
    type: "JSON",
    size: "1.8 MB",
    date: "2024-01-13 18:45",
    status: "completed",
  },
  {
    id: 4,
    name: "device_logs_2024-01.csv",
    type: "CSV",
    size: "8.2 MB",
    date: "2024-01-12 11:20",
    status: "processing",
  },
]

const dataTypes = [
  { id: "temperature", label: "温度数据", checked: true },
  { id: "humidity", label: "湿度数据", checked: true },
  { id: "soil", label: "土壤数据", checked: false },
  { id: "light", label: "光照数据", checked: false },
  { id: "device", label: "设备状态", checked: true },
  { id: "alerts", label: "告警记录", checked: false },
]

export function DataExport() {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedTypes, setSelectedTypes] = useState(dataTypes)
  const [exportFormat, setExportFormat] = useState("csv")

  useEffect(() => {
    setDate(new Date())
  }, [])

  const toggleDataType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.map((type) =>
        type.id === id ? { ...type, checked: !type.checked } : type
      )
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="bg-card border-border lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-foreground">数据导出配置</CardTitle>
          <CardDescription className="text-muted-foreground">
            选择需要导出的数据类型、时间范围和文件格式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">选择数据类型</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <Checkbox
                    id={type.id}
                    checked={type.checked}
                    onCheckedChange={() => toggleDataType(type.id)}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label
                    htmlFor={type.id}
                    className="text-sm text-foreground cursor-pointer"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">选择日期</h4>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-secondary border-border"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">导出格式</h4>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="w-full bg-secondary border-border">
                  <SelectValue placeholder="选择格式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      CSV 格式
                    </div>
                  </SelectItem>
                  <SelectItem value="excel">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel 格式
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      JSON 格式
                    </div>
                  </SelectItem>
                  <SelectItem value="txt">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      文本格式
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              已选择 {selectedTypes.filter((t) => t.checked).length} 种数据类型
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Download className="w-4 h-4 mr-2" />
              开始导出
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">导出历史</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportHistory.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg bg-secondary/50 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {item.type === "CSV" && (
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                  )}
                  {item.type === "Excel" && (
                    <FileSpreadsheet className="w-4 h-4 text-chart-2" />
                  )}
                  {item.type === "JSON" && (
                    <FileJson className="w-4 h-4 text-chart-3" />
                  )}
                  <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                    {item.name}
                  </span>
                </div>
                <Badge
                  className={
                    item.status === "completed"
                      ? "bg-primary/20 text-primary"
                      : "bg-chart-3/20 text-chart-3"
                  }
                >
                  {item.status === "completed" ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <Clock className="w-3 h-3 mr-1" />
                  )}
                  {item.status === "completed" ? "完成" : "处理中"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {item.size}
                </span>
                <span>{item.date}</span>
              </div>
              {item.status === "completed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-primary hover:bg-primary/10"
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
