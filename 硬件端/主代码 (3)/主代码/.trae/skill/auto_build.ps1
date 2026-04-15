#!/usr/bin/env powershell

# 定义项目路径和Keil MDK路径
$ProjectPath = 'C:\Users\CJH\Desktop\主代码'
$UV4Path = 'E:\keil_v5\UV4\UV4.exe'
$ProjectFile = 'Project.uvprojx'

# 检查Keil MDK是否存在
if (-not (Test-Path $UV4Path)) {
    Write-Host '错误: 未找到Keil MDK工具 ($UV4Path)' -ForegroundColor Red
    exit 1
}

# 检查项目文件是否存在
if (-not (Test-Path "$ProjectPath\$ProjectFile")) {
    Write-Host '错误: 未找到项目文件 ($ProjectFile)' -ForegroundColor Red
    exit 1
}

# 切换到项目目录
Set-Location $ProjectPath

# 执行编译
Write-Host '=====================================' -ForegroundColor Green
Write-Host '开始编译项目...' -ForegroundColor Green
Write-Host '项目文件: $ProjectFile' -ForegroundColor Green
Write-Host 'Keil MDK路径: $UV4Path' -ForegroundColor Green
Write-Host '编译时间: $(Get-Date)' -ForegroundColor Green
Write-Host '=====================================' -ForegroundColor Green

# 运行编译命令
try {
    # 使用Start-Process执行编译命令
    $process = Start-Process -FilePath $UV4Path -ArgumentList '-b', $ProjectFile -NoNewWindow -PassThru -Wait
    
    # 检查编译结果
    if ($process.ExitCode -eq 0) {
        Write-Host '=====================================' -ForegroundColor Green
        Write-Host '编译成功！' -ForegroundColor Green
        Write-Host '编译时间: $(Get-Date)' -ForegroundColor Green
        Write-Host '编译结果文件: Objects\Project.axf' -ForegroundColor Green
        Write-Host '=====================================' -ForegroundColor Green
    } else {
        Write-Host '=====================================' -ForegroundColor Red
        Write-Host '编译失败！' -ForegroundColor Red
        Write-Host '错误代码: $($process.ExitCode)' -ForegroundColor Red
        Write-Host '请检查编译日志获取详细信息' -ForegroundColor Red
        Write-Host '=====================================' -ForegroundColor Red
    }
} catch {
    Write-Host '=====================================' -ForegroundColor Red
    Write-Host '编译过程中发生错误: $($_.Exception.Message)' -ForegroundColor Red
    Write-Host '=====================================' -ForegroundColor Red
}

# 切换回原来的目录
Set-Location -Path $PSScriptRoot

# 显示编译日志（如果存在）
if (Test-Path "$ProjectPath\build_log.txt") {
    Write-Host '编译日志:'
    Get-Content "$ProjectPath\build_log.txt" | Select-Object -Last 20
}
