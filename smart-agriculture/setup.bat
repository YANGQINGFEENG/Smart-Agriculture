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
    echo ✗ 未检测到Node.js，正在自动安装...
    echo   正在下载Node.js安装程序...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node-installer.msi'"
    echo   正在安装Node.js...
    msiexec /i "%TEMP%\node-installer.msi" /quiet /norestart
    timeout /t 10 /nobreak >nul
    echo ✓ Node.js安装完成
    echo   请重新运行setup.bat
    pause
    exit /b 0
)
echo ✓ Node.js已安装

:: 检测Python
echo [2/6] 检测Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ✗ 未检测到Python，正在自动安装...
    echo   正在下载Python安装程序...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe' -OutFile '%TEMP%\python-installer.exe'"
    echo   正在安装Python...
    "%TEMP%\python-installer.exe" /quiet InstallAllUsers=1 PrependPath=1
    timeout /t 30 /nobreak >nul
    echo ✓ Python安装完成
    echo   请重新运行setup.bat
    pause
    exit /b 0
)
echo ✓ Python已安装

:: 检测pip
echo [3/6] 检测pip...
pip --version >nul 2>&1
if errorlevel 1 (
    echo ✗ 未检测到pip，正在安装...
    python -m ensurepip --upgrade
    python -m pip install --upgrade pip
)
echo ✓ pip已安装

:: 安装Node.js依赖
echo [4/6] 检测项目依赖...
if not exist "node_modules" (
    echo   正在安装Node.js依赖...
    call npm install
    if errorlevel 1 (
        echo ✗ 依赖安装失败，尝试使用淘宝镜像...
        npm config set registry https://registry.npmmirror.com
        call npm install
    )
)
echo ✓ Node.js依赖已安装

:: 安装Python依赖
echo [5/6] 检测Python依赖...
if not exist "inference-service\venv" (
    echo   正在创建Python虚拟环境...
    cd inference-service
    python -m venv venv
    call venv\Scripts\activate.bat
    echo   正在安装Python依赖（使用清华镜像）...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    pip install -r requirements-rag.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    cd ..
    echo ✓ Python依赖已安装
) else (
    echo ✓ Python依赖已安装
)

:: 初始化数据库
echo [6/6] 初始化数据库...
if not exist "smart_agriculture.db" (
    echo   正在创建数据库...
    node scripts/init-db.js
)
echo ✓ 数据库已就绪

:: 创建环境变量
echo [7/7] 检查环境变量...
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

:: 检测Ollama
echo [8/8] 检测Ollama...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo ○ Ollama未安装，正在安装...
    echo   正在下载Ollama安装程序...
    powershell -Command "Invoke-WebRequest -Uri 'https://ollama.ai/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe'"
    echo   正在安装Ollama...
    start /wait "%TEMP%\OllamaSetup.exe"
    echo ✓ Ollama安装完成
    echo   正在拉取AI模型...
    ollama pull qwen3:1.7b-q4_K_M
) else (
    echo ✓ Ollama已安装
)

echo.
echo ======================================
echo   启动服务
echo ======================================
echo.

:: 启动AI服务
echo 正在启动AI服务...
start "Ollama" cmd /c "ollama serve"
timeout /t 2 /nobreak >nul
start "YOLO推理" cmd /c "cd inference-service && venv\Scripts\activate.bat && python app.py"
start "RAG服务" cmd /c "cd inference-service && venv\Scripts\activate.bat && python rag_app.py"

:: 等待AI服务启动
timeout /t 5 /nobreak >nul

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
