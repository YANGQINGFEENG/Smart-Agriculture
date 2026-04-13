"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bell, RefreshCw, Calendar, ChevronDown } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface HeaderProps {
  activeTab: string
}

const tabTitles: Record<string, string> = {
  overview: "数据概览",
  detailed: "精细数据",
  analysis: "数据分析",
  export: "数据导出",
  devices: "设备连接",
}

export function Header({ activeTab }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-foreground">
            {tabTitles[activeTab]}
          </h2>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            实时更新
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Select defaultValue="today">
            <SelectTrigger className="w-[140px] bg-secondary border-border">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="year">本年</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" className="bg-secondary border-border relative">
            <RefreshCw className="w-4 h-4" />
          </Button>

          <ThemeToggle />

          <Button variant="outline" size="icon" className="bg-secondary border-border relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center">
              3
            </span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    管
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">管理员</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>个人设置</DropdownMenuItem>
              <DropdownMenuItem>系统配置</DropdownMenuItem>
              <DropdownMenuItem>退出登录</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
