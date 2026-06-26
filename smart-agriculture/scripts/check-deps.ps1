# scripts/check-deps.ps1
# 智慧农业平台 - 依赖检测脚本

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  智慧农业物联网平台 - 依赖检测" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 检测Node.js
Write-Host "[1/7] 检测Node.js..." -NoNewline
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host " ✓ $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host " ✗ 未安装" -ForegroundColor Red
    Write-Host "  请访问 https://nodejs.org/ 下载安装Node.js 20+" -ForegroundColor Yellow
    $allGood = $false
}

# 检测npm
Write-Host "[2/7] 检测npm..." -NoNewline
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host " ✓ v$npmVersion" -ForegroundColor Green
    } else {
        throw "npm not found"
    }
} catch {
    Write-Host " ✗ 未安装" -ForegroundColor Red
    $allGood = $false
}

# 检测Python（必需）
Write-Host "[3/7] 检测Python..." -NoNewline
try {
    $pythonVersion = python --version 2>$null
    if ($pythonVersion) {
        Write-Host " ✓ $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host " ✗ 未安装" -ForegroundColor Red
    Write-Host "  AI服务需要Python 3.11+，访问 https://www.python.org/" -ForegroundColor Yellow
    $allGood = $false
}

# 检测pip
Write-Host "[4/7] 检测pip..." -NoNewline
try {
    $pipVersion = pip --version 2>$null
    if ($pipVersion) {
        Write-Host " ✓ $pipVersion" -ForegroundColor Green
    } else {
        throw "pip not found"
    }
} catch {
    Write-Host " ✗ 未安装" -ForegroundColor Red
    $allGood = $false
}

# 检测Git
Write-Host "[5/7] 检测Git..." -NoNewline
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Host " ✓ $gitVersion" -ForegroundColor Green
    } else {
        throw "Git not found"
    }
} catch {
    Write-Host " ✗ 未安装" -ForegroundColor Red
    $allGood = $false
}

# 检测Ollama（AI服务）
Write-Host "[6/7] 检测Ollama..." -NoNewline
try {
    $ollamaVersion = ollama --version 2>$null
    if ($ollamaVersion) {
        Write-Host " ✓ $ollamaVersion" -ForegroundColor Green
    } else {
        throw "Ollama not found"
    }
} catch {
    Write-Host " ○ 未安装" -ForegroundColor Yellow
    Write-Host "  本地AI需要Ollama，访问 https://ollama.ai/" -ForegroundColor Yellow
    Write-Host "  或配置网络API（见.env.example）" -ForegroundColor Yellow
}

# 检测Docker（可选）
Write-Host "[7/7] 检测Docker（可选）..." -NoNewline
try {
    $dockerVersion = docker --version 2>$null
    if ($dockerVersion) {
        Write-Host " ✓ $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker not found"
    }
} catch {
    Write-Host " ○ 未安装（可选）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "✓ 所有必需依赖已安装" -ForegroundColor Green
    Write-Host "  运行 setup.bat 启动项目" -ForegroundColor Green
} else {
    Write-Host "✗ 缺少必需依赖，请先安装" -ForegroundColor Red
}

Write-Host "======================================" -ForegroundColor Cyan
