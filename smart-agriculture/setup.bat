@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ======================================
echo   智慧农业物联网平台 - 一键启动
echo ======================================
echo.

:: 检测Node.js
echo [1/6] 检测Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ✗ 未检测到Node.js，请先安装Node.js 20+
    echo   访问: https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js已安装

:: 检测Python
echo [2/6] 检测Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ✗ 未检测到Python，请先安装Python 3.11+
    echo   访问: https://www.python.org/
    pause
    exit /b 1
)
echo ✓ Python已安装

:: 检测依赖
echo [3/6] 检测项目依赖...
if not exist "node_modules" (
    echo   正在安装Node.js依赖...
    call npm install
    if errorlevel 1 (
        echo ✗ 依赖安装失败
        pause
        exit /b 1
    )
)
echo ✓ Node.js依赖已安装

:: 安装Python依赖
echo [4/6] 检测Python依赖...
if not exist "inference-service\venv" (
    echo   正在创建Python虚拟环境...
    cd inference-service
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    pip install -r requirements-rag.txt
    cd ..
    echo ✓ Python依赖已安装
) else (
    echo ✓ Python依赖已安装
)

:: 初始化数据库
echo [5/6] 初始化数据库...
if not exist "smart_agriculture.db" (
    echo   正在创建数据库...
    node scripts/init-db.js
)
echo ✓ 数据库已就绪

:: 创建环境变量
echo [6/6] 检查环境变量...
if not exist ".env.local" (
    echo   正在创建环境变量文件...
    copy .env.example .env.local >nul
    echo ✓ 环境变量已创建
    echo.
    echo   ⚠ 请编辑 .env.local 配置AI服务：
    echo     - 本地AI：确保Ollama已安装
    echo     - 网络API：配置API密钥
) else (
    echo ✓ 环境变量已存在
)

echo.
echo ======================================
echo   启动服务
echo ======================================
echo.

:: 启动AI服务
echo 正在启动AI服务...
start "Ollama" cmd /c "ollama serve 2>nul || echo Ollama未安装，跳过"
start "YOLO推理" cmd /c "cd inference-service && venv\Scripts\activate.bat && python app.py"
start "RAG服务" cmd /c "cd inference-service && venv\Scripts\activate.bat && python rag_app.py"

:: 等待AI服务启动
timeout /t 3 /nobreak >nul

echo.
echo ======================================
echo   启动Web服务
echo ======================================
echo.
echo   访问地址: http://localhost:3000
echo   按 Ctrl+C 停止服务器
echo ======================================
echo.

:: 启动开发服务器
npm run dev
