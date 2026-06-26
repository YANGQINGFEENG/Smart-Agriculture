@echo off
chcp 65001 >nul

echo ==========================================
echo    Smart Agriculture Platform Service Starter
echo ==========================================
echo.

rem 启动 PowerShell 脚本
powershell -ExecutionPolicy Bypass -File "%~dp0start-all-services.ps1"

pause
