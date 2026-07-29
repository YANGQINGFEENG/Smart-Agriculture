@echo off

REM 自动编译项目的批处理脚本
REM 每次执行完命令后自动运行

REM 切换到脚本所在目录
cd /d %~dp0

REM 运行PowerShell脚本
powershell.exe -ExecutionPolicy Bypass -File "auto_build.ps1"

REM 暂停以便查看结果
pause
