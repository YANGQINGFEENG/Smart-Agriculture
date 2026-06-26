"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { TrendingUp, AlertTriangle, CheckCircle, Activity } from "lucide-react"

const predictionData = [
  { date: "01/10", actual: 24.2, predicted: 24.5 },
  { date: "01/11", actual: 25.1, predicted: 24.8 },
  { date: "01/12", actual: 23.8, predicted: 24.2 },
  { date: "01/13", actual: 26.5, predicted: 25.9 },
  { date: "01/14", actual: 25.8, predicted: 26.1 },
  { date: "01/15", actual: 24.5, predicted: null },
  { date: "01/16", actual: null, predicted: 25.2 },
  { date: "01/17", actual: null, predicted: 24.8 },
]

const distributionData = [
  { name: "温度传感器", value: 35, color: "var(--color-chart-4)" },
  { name: "湿度传感器", value: 28, color: "var(--color-chart-2)" },
  { name: "土壤传感器", value: 22, color: "var(--color-primary)" },
  { name: "光照传感器", value: 15, color: "var(--color-chart-3)" },
]

const healthData = [
  { name: "大棚1区", health: 92, fill: "var(--color-primary)" },
  { name: "大棚2区", health: 85, fill: "var(--color-chart-2)" },
  { name: "大棚3区", health: 78, fill: "var(--color-chart-3)" },
  { name: "大棚4区", health: 88, fill: "var(--color-chart-4)" },
]

const analysisMetrics = [
  {
    label: "数据采集率",
    value: 98.5,
    icon: Activity,
    color: "text-primary",
    bgColor: "bg-primary",
  },
  {
    label: "异常检测率",
    value: 2.3,
    icon: AlertTriangle,
    color: "text-chart-3",
    bgColor: "bg-chart-3",
  },
  {
    label: "预测准确率",
    value: 94.2,
    icon: TrendingUp,
    color: "text-chart-2",
    bgColor: "bg-chart-2",
  },
  {
    label: "系统健康度",
    value: 96.8,
    icon: CheckCircle,
    color: "text-primary",
    bgColor: "bg-primary",
  },
]

export function AnalysisClient() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analysisMetrics.map((metric, index) => (
          <Card key={index} className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${metric.bgColor}/10`}>
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <span className="text-2xl font-bold text-foreground">{metric.value}%</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
              <Progress value={metric.value} className="h-1.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
              温度预测分析
              <div className="flex items-center gap-4 text-xs font-normal">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-chart-4" />
                  实际值
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-chart-2" style={{ opacity: 0.5 }} />
                  预测值
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                actual: { label: "实际温度", color: "var(--color-chart-4)" },
                predicted: { label: "预测温度", color: "var(--color-chart-2)" },
              }}
              className="h-[250px] w-full"
            >
              <AreaChart data={predictionData} width={500} height={250}>
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="predictGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  domain={[20, 30]}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--color-chart-4)"
                  strokeWidth={2}
                  fill="url(#actualGradient)"
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="url(#predictGradient)"
                  connectNulls={false}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground">
              传感器分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                temperature: { label: "温度传感器", color: "var(--color-chart-4)" },
                humidity: { label: "湿度传感器", color: "var(--color-chart-2)" },
                soil: { label: "土壤传感器", color: "var(--color-primary)" },
                light: { label: "光照传感器", color: "var(--color-chart-3)" },
              }}
              className="h-[250px] w-full"
            >
              <PieChart width={500} height={250}>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "占比"]}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ChartContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {distributionData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                  <span className="text-sm font-medium text-foreground ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">各区域健康度评估</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {healthData.map((area, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{area.name}</span>
                  <span className="text-lg font-bold text-foreground">{area.health}%</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${area.health}%`,
                      backgroundColor: area.fill,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {area.health >= 90
                    ? "优秀 - 环境条件最佳"
                    : area.health >= 80
                    ? "良好 - 轻微调整建议"
                    : "注意 - 需要关注调整"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
