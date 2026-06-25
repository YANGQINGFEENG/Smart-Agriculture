# scripts/setup-ai.ps1
# 智慧农业平台 - AI服务安装脚本

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  智慧农业物联网平台 - AI服务安装" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 安装Ollama
Write-Host "[1/3] 安装Ollama..." -ForegroundColor Yellow
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "  ✓ Ollama已安装" -ForegroundColor Green
} else {
    Write-Host "  正在下载Ollama..." -ForegroundColor Yellow
    $ollamaUrl = "https://ollama.ai/download/OllamaSetup.exe"
    $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"
    Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaInstaller
    Write-Host "  正在安装Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath $ollamaInstaller -Wait
    Write-Host "  ✓ Ollama安装完成" -ForegroundColor Green
}

# 拉取模型
Write-Host "[2/3] 拉取AI模型..." -ForegroundColor Yellow
ollama pull qwen3:1.7b-q4_K_M
Write-Host "  ✓ 模型拉取完成" -ForegroundColor Green

# 安装Python依赖
Write-Host "[3/3] 安装Python依赖..." -ForegroundColor Yellow
cd inference-service
if (-not (Test-Path "venv")) {
    python -m venv venv
}
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-rag.txt
cd ..
Write-Host "  ✓ Python依赖安装完成" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✓ AI服务安装完成" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
