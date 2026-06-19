@echo off
echo ==========================================
echo    Ollama 服务自动启动配置脚本
echo ==========================================
echo.
echo 正在检查 Ollama 安装路径...
if exist "C:\Users\lenovo\AppData\Local\Programs\Ollama\ollama.exe" (
    echo 找到 Ollama 安装
    echo.
    echo 正在创建任务计划程序...
    schtasks /create /tn "Ollama Auto Start" /tr "\"C:\Users\lenovo\AppData\Local\Programs\Ollama\ollama.exe\" serve" /sc onlogon /rl limited /f
    echo.
    if %errorlevel% equ 0 (
        echo 配置成功！Ollama 将在登录时自动启动。
    ) else (
        echo 配置失败，请尝试手动以管理员身份运行此脚本。
    )
) else (
    echo 未找到 Ollama，请确认已安装 Ollama。
)
echo.
pause