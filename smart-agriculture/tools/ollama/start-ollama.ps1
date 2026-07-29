# Ollama 自动启动配置脚本
# 需要以管理员身份运行

Write-Host "==========================================" -ForegroundColor Green
Write-Host "   Ollama 服务自动启动配置脚本" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# 检查管理员权限
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "错误: 此脚本需要管理员权限。" -ForegroundColor Red
    Write-Host "请右键选择'以管理员身份运行' PowerShell，然后重新执行此脚本。" -ForegroundColor Yellow
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "检查 Ollama 安装..." -ForegroundColor Cyan

$ollamaPath = "C:\Users\lenovo\AppData\Local\Programs\Ollama\ollama.exe"

if (Test-Path $ollamaPath) {
    Write-Host "找到 Ollama 安装" -ForegroundColor Green
    Write-Host ""

    # 创建任务计划程序
    $taskName = "Ollama Auto Start"
    $taskDescription = "Ollama AI 模型服务开机自动启动"

    # 移除已存在的任务（如果存在）
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "移除旧的任务配置..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    # 创建新的任务计划
    $action = New-ScheduledTaskAction -Execute $ollamaPath -Argument "serve"
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Write-Host "创建任务计划程序..." -ForegroundColor Cyan
    Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Settings $settings -RunLevel Limited

    if ($?) {
        Write-Host ""
        Write-Host "配置成功！Ollama 将在登录时自动启动。" -ForegroundColor Green
        Write-Host ""
        Write-Host "任务信息:" -ForegroundColor Cyan
        Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State, TaskPath
    } else {
        Write-Host ""
        Write-Host "配置失败，请重试。" -ForegroundColor Red
    }
} else {
    Write-Host "未找到 Ollama 安装，请确认已正确安装 Ollama。" -ForegroundColor Red
    Write-Host " Ollama 下载地址: https://ollama.com/download" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "按 Enter 键退出"