# 项目可移植性改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将智慧农业物联网平台改造为可在任意电脑上一键部署的项目

**Architecture:** 创建统一的启动脚本、环境检测、依赖安装和配置管理，支持Windows/Linux/macOS跨平台部署

**Tech Stack:** Node.js 20+, Python 3.11+, Docker (可选), PowerShell/Bash

## Global Constraints

- 所有脚本必须支持Windows (PowerShell) 和 Linux/macOS (Bash)
- 数据库默认使用SQLite，无需额外安装MySQL
- AI服务（Ollama, YOLOv5, RAG）为必需组件，启动脚本自动安装和配置
- 支持网络API（OpenAI/Claude/通义千问等）作为本地AI的备选方案
- 敏感信息（密码、密钥）不得硬编码，必须从环境变量或配置文件读取
- 启动脚本必须检测依赖是否安装，缺失时自动提示或安装

---

## 项目文件结构

```
smart-agriculture/
├── setup.bat                    # Windows一键启动
├── setup.sh                     # Linux/macOS一键启动
├── .env.example                 # 环境变量模板
├── docker-compose.yml           # Docker部署（已有）
├── scripts/
│   ├── check-deps.ps1           # Windows依赖检测
│   ├── check-deps.sh            # Linux/macOS依赖检测
│   ├── init-db.js               # 数据库初始化
│   └── install-deps.ps1         # 自动安装依赖
├── inference-service/
│   ├── requirements.txt         # Python依赖（已有）
│   └── start.bat                # 推理服务启动
└── README.md                    # 部署文档（更新）
```

---

## Task 1: 创建环境变量模板

**Files:**
- Create: `.env.example`

- [ ] **Step 1: 创建环境变量模板文件**

```env
# 智慧农业物联网平台 - 环境变量配置
# 复制此文件为 .env.local 并修改配置

# ==================== 数据库配置 ====================
# 默认使用SQLite，无需配置MySQL
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=./smart_agriculture.db

# MySQL配置（可选，生产环境使用）
# DATABASE_TYPE=mysql
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password_here
# DB_NAME=smart_agriculture

# ==================== AI服务配置 ====================
# AI模式：local（本地）/ network（网络API）/ auto（自动检测）
AI_MODE=auto

# 本地AI服务配置（优先使用）
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b-q4_K_M
INFERENCE_HOST=http://localhost:5000
RAG_SERVICE_URL=http://localhost:5001

# 网络API配置（本地服务不可用时使用）
# 支持：openai / claude / tongyi / zhipu / custom
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# 通义千问配置
# AI_PROVIDER=tongyi
# DASHSCOPE_API_KEY=sk-your-key-here
# DASHSCOPE_MODEL=qwen-turbo

# 智谱AI配置
# AI_PROVIDER=zhipu
# ZHIPU_API_KEY=your-key-here
# ZHIPU_MODEL=glm-4-flash

# 自定义API配置
# AI_PROVIDER=custom
# CUSTOM_API_URL=https://your-api.com/v1
# CUSTOM_API_KEY=your-key-here
# CUSTOM_API_MODEL=your-model

# ==================== 应用配置 ====================
# Next.js端口
PORT=3000

# 开发/生产模式
NODE_ENV=development
```

- [ ] **Step 2: 验证模板文件**

运行: `cat .env.example` (Linux) 或 `type .env.example` (Windows)
预期: 显示完整的环境变量模板

- [ ] **Step 3: 提交**

```bash
git add .env.example
git commit -m "feat: add environment variable template"
```

---

## Task 2: 创建依赖检测脚本

**Files:**
- Create: `scripts/check-deps.ps1`
- Create: `scripts/check-deps.sh`

- [ ] **Step 1: 创建Windows依赖检测脚本**

```powershell
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
```

- [ ] **Step 2: 创建Linux/macOS依赖检测脚本**

```bash
#!/bin/bash
# scripts/check-deps.sh
# 智慧农业平台 - 依赖检测脚本

echo "======================================"
echo "  智慧农业物联网平台 - 依赖检测"
echo "======================================"
echo ""

ALL_GOOD=true

# 检测Node.js
echo -n "[1/7] 检测Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo " ✓ $NODE_VERSION"
else
    echo " ✗ 未安装"
    echo "  请访问 https://nodejs.org/ 下载安装Node.js 20+"
    ALL_GOOD=false
fi

# 检测npm
echo -n "[2/7] 检测npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo " ✓ v$NPM_VERSION"
else
    echo " ✗ 未安装"
    ALL_GOOD=false
fi

# 检测Python（必需）
echo -n "[3/7] 检测Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo " ✓ $PYTHON_VERSION"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo " ✓ $PYTHON_VERSION"
else
    echo " ✗ 未安装"
    echo "  AI服务需要Python 3.11+"
    ALL_GOOD=false
fi

# 检测pip
echo -n "[4/7] 检测pip..."
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version)
    echo " ✓ $PIP_VERSION"
elif command -v pip &> /dev/null; then
    PIP_VERSION=$(pip --version)
    echo " ✓ $PIP_VERSION"
else
    echo " ✗ 未安装"
    ALL_GOOD=false
fi

# 检测Git
echo -n "[5/7] 检测Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo " ✓ $GIT_VERSION"
else
    echo " ✗ 未安装"
    ALL_GOOD=false
fi

# 检测Ollama（AI服务）
echo -n "[6/7] 检测Ollama..."
if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>&1)
    echo " ✓ $OLLAMA_VERSION"
else
    echo " ○ 未安装"
    echo "  本地AI需要Ollama，访问 https://ollama.ai/"
    echo "  或配置网络API（见.env.example）"
fi

# 检测Docker（可选）
echo -n "[7/7] 检测Docker（可选）..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo " ✓ $DOCKER_VERSION"
else
    echo " ○ 未安装（可选）"
fi

echo ""
echo "======================================"

if [ "$ALL_GOOD" = true ]; then
    echo "✓ 所有必需依赖已安装"
    echo "  运行 ./setup.sh 启动项目"
else
    echo "✗ 缺少必需依赖，请先安装"
fi

echo "======================================"
```
else
    echo " ✗ 未安装"
    ALL_GOOD=false
fi

# 检测Docker（可选）
echo -n "[5/5] 检测Docker（可选）..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo " ✓ $DOCKER_VERSION"
else
    echo " ○ 未安装（可选）"
fi

echo ""
echo "======================================"

if [ "$ALL_GOOD" = true ]; then
    echo "✓ 所有必需依赖已安装"
    echo "  运行 ./setup.sh 启动项目"
else
    echo "✗ 缺少必需依赖，请先安装"
fi

echo "======================================"
```

- [ ] **Step 3: 设置脚本执行权限（Linux/macOS）**

```bash
chmod +x scripts/check-deps.sh
```

- [ ] **Step 4: 测试依赖检测**

Windows: `powershell -ExecutionPolicy Bypass -File scripts/check-deps.ps1`
Linux: `./scripts/check-deps.sh`

- [ ] **Step 5: 提交**

```bash
git add scripts/check-deps.ps1 scripts/check-deps.sh
git commit -m "feat: add dependency check scripts"
```

---

## Task 3: 创建数据库初始化脚本

**Files:**
- Create: `scripts/init-db.js`

- [ ] **Step 1: 创建数据库初始化脚本**

```javascript
// scripts/init-db.js
// 智慧农业平台 - 数据库初始化脚本

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.SQLITE_DB_PATH || './smart_agriculture.db';

async function initDatabase() {
  console.log('======================================');
  console.log('  智慧农业物联网平台 - 数据库初始化');
  console.log('======================================');
  console.log('');
  console.log(`数据库路径: ${path.resolve(DB_PATH)}`);
  console.log('');

  // 检查数据库是否已存在
  if (fs.existsSync(DB_PATH)) {
    console.log('⚠ 数据库文件已存在');
    console.log('  如需重新初始化，请先删除: ' + DB_PATH);
    console.log('');
    return;
  }

  try {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('正在创建数据库表...');

    // 创建传感器类型表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sensor_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ sensor_types');

    // 创建传感器表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sensors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_id INTEGER,
        location TEXT,
        status TEXT DEFAULT 'offline',
        battery INTEGER DEFAULT 100,
        farm_id INTEGER,
        zone_id INTEGER,
        last_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES sensor_types(id)
      )
    `);
    console.log('  ✓ sensors');

    // 创建传感器数据表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES sensors(id)
      )
    `);
    console.log('  ✓ sensor_data');

    // 创建执行器类型表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actuator_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ actuator_types');

    // 创建执行器表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actuators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_id INTEGER,
        location TEXT,
        status TEXT DEFAULT 'offline',
        state TEXT DEFAULT 'off',
        mode TEXT DEFAULT 'auto',
        locked INTEGER DEFAULT 0,
        last_update TIMESTAMP,
        farm_id INTEGER,
        zone_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES actuator_types(id)
      )
    `);
    console.log('  ✓ actuators');

    // 创建执行器指令表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actuator_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actuator_id TEXT NOT NULL,
        command TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP,
        FOREIGN KEY (actuator_id) REFERENCES actuators(id)
      )
    `);
    console.log('  ✓ actuator_commands');

    // 创建网关表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS gateways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farm_id INTEGER,
        name TEXT NOT NULL,
        gateway_type TEXT,
        ip_address TEXT,
        mac_address TEXT,
        status TEXT DEFAULT 'offline',
        last_heartbeat TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ gateways');

    // 创建设备节点表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS device_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway_id INTEGER,
        node_id TEXT NOT NULL,
        name TEXT,
        node_type TEXT,
        sensor_type TEXT,
        location TEXT,
        status TEXT DEFAULT 'offline',
        last_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gateway_id) REFERENCES gateways(id)
      )
    `);
    console.log('  ✓ device_nodes');

    // 创建设备数据表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS device_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway_id INTEGER,
        node_id TEXT NOT NULL,
        sensor_type TEXT,
        value REAL,
        unit TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gateway_id) REFERENCES gateways(id)
      )
    `);
    console.log('  ✓ device_data');

    // 创建策略表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        actuator_id TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        trigger_condition TEXT,
        time_range TEXT,
        action TEXT NOT NULL,
        stop_condition TEXT,
        safety_config TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actuator_id) REFERENCES actuators(id)
      )
    `);
    console.log('  ✓ strategies');

    // 创建知识库表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        source TEXT,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ knowledge_base');

    // 创建提示词模板表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ prompt_templates');

    // 插入默认传感器类型
    await db.exec(`
      INSERT OR IGNORE INTO sensor_types (type, name, unit) VALUES
        ('temperature', '温度', '°C'),
        ('humidity', '湿度', '%'),
        ('light', '光照', 'Lux'),
        ('soil', '土壤湿度', '%'),
        ('soil_temperature', '土壤温度', '°C'),
        ('ec', '电导率', 'μS/cm'),
        ('ph', 'pH值', 'pH')
    `);
    console.log('  ✓ 默认传感器类型');

    // 插入默认执行器类型
    await db.exec(`
      INSERT OR IGNORE INTO actuator_types (type, name, description) VALUES
        ('water_pump', '水泵', '灌溉用水泵'),
        ('fan', '风扇', '通风用风扇'),
        ('heater', '加热器', '温室加热器'),
        ('valve', '电磁阀', '灌溉电磁阀'),
        ('light', '补光灯', '植物补光灯')
    `);
    console.log('  ✓ 默认执行器类型');

    await db.close();

    console.log('');
    console.log('======================================');
    console.log('✓ 数据库初始化完成');
    console.log('======================================');

  } catch (error) {
    console.error('✗ 数据库初始化失败:', error.message);
    process.exit(1);
  }
}

initDatabase();
```

- [ ] **Step 2: 测试数据库初始化**

运行: `node scripts/init-db.js`
预期: 显示创建成功的表名列表

- [ ] **Step 3: 提交**

```bash
git add scripts/init-db.js
git commit -m "feat: add database initialization script"
```

---

## Task 4: 创建一键启动脚本

**Files:**
- Create: `setup.bat`
- Create: `setup.sh`
- Create: `scripts/setup-ai.ps1`
- Create: `scripts/setup-ai.sh`

- [ ] **Step 1: 创建Windows启动脚本**

```batch
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
```

- [ ] **Step 2: 创建Linux/macOS启动脚本**

```bash
#!/bin/bash
# setup.sh - 智慧农业物联网平台一键启动脚本

set -e

echo "======================================"
echo "  智慧农业物联网平台 - 一键启动"
echo "======================================"
echo ""

# 检测Node.js
echo "[1/6] 检测Node.js..."
if ! command -v node &> /dev/null; then
    echo "✗ 未检测到Node.js，请先安装Node.js 20+"
    echo "  访问: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js已安装"

# 检测Python
echo "[2/6] 检测Python..."
if ! command -v python3 &> /dev/null; then
    echo "✗ 未检测到Python，请先安装Python 3.11+"
    echo "  访问: https://www.python.org/"
    exit 1
fi
echo "✓ Python已安装"

# 检测依赖
echo "[3/6] 检测项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "  正在安装Node.js依赖..."
    npm install
fi
echo "✓ Node.js依赖已安装"

# 安装Python依赖
echo "[4/6] 检测Python依赖..."
if [ ! -d "inference-service/venv" ]; then
    echo "  正在创建Python虚拟环境..."
    cd inference-service
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    pip install -r requirements-rag.txt
    cd ..
    echo "✓ Python依赖已安装"
else
    echo "✓ Python依赖已安装"
fi

# 初始化数据库
echo "[5/6] 初始化数据库..."
if [ ! -f "smart_agriculture.db" ]; then
    echo "  正在创建数据库..."
    node scripts/init-db.js
fi
echo "✓ 数据库已就绪"

# 创建环境变量
echo "[6/6] 检查环境变量..."
if [ ! -f ".env.local" ]; then
    echo "  正在创建环境变量文件..."
    cp .env.example .env.local
    echo "✓ 环境变量已创建"
    echo ""
    echo "  ⚠ 请编辑 .env.local 配置AI服务："
    echo "    - 本地AI：确保Ollama已安装"
    echo "    - 网络API：配置API密钥"
else
    echo "✓ 环境变量已存在"
fi

echo ""
echo "======================================"
echo "  启动服务"
echo "======================================"
echo ""

# 启动AI服务
echo "正在启动AI服务..."

# 启动Ollama（后台）
if command -v ollama &> /dev/null; then
    ollama serve &
    OLLAMA_PID=$!
    echo "✓ Ollama已启动 (PID: $OLLAMA_PID)"
else
    echo "○ Ollama未安装，跳过"
fi

# 启动YOLO推理服务（后台）
cd inference-service
source venv/bin/activate
python app.py &
YOLO_PID=$!
echo "✓ YOLO推理服务已启动 (PID: $YOLO_PID)"

# 启动RAG服务（后台）
python rag_app.py &
RAG_PID=$!
echo "✓ RAG服务已启动 (PID: $RAG_PID)"
cd ..

# 等待服务启动
sleep 3

echo ""
echo "======================================"
echo "  启动Web服务"
echo "======================================"
echo ""
echo "  访问地址: http://localhost:3000"
echo "  按 Ctrl+C 停止服务器"
echo "======================================"
echo ""

# 启动开发服务器
npm run dev

# 清理后台进程
kill $OLLAMA_PID $YOLO_PID $RAG_PID 2>/dev/null || true
```

- [ ] **Step 3: 创建AI服务安装脚本（Windows）**

```powershell
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
```

- [ ] **Step 4: 创建AI服务安装脚本（Linux/macOS）**

```bash
#!/bin/bash
# scripts/setup-ai.sh
# 智慧农业平台 - AI服务安装脚本

set -e

echo "======================================"
echo "  智慧农业物联网平台 - AI服务安装"
echo "======================================"
echo ""

# 安装Ollama
echo "[1/3] 安装Ollama..."
if command -v ollama &> /dev/null; then
    echo "  ✓ Ollama已安装"
else
    echo "  正在安装Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    echo "  ✓ Ollama安装完成"
fi

# 拉取模型
echo "[2/3] 拉取AI模型..."
ollama pull qwen3:1.7b-q4_K_M
echo "  ✓ 模型拉取完成"

# 安装Python依赖
echo "[3/3] 安装Python依赖..."
cd inference-service
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-rag.txt
cd ..
echo "  ✓ Python依赖安装完成"

echo ""
echo "======================================"
echo "✓ AI服务安装完成"
echo "======================================"
```

- [ ] **Step 5: 设置脚本执行权限**

```bash
chmod +x setup.sh scripts/setup-ai.sh
```

- [ ] **Step 6: 测试启动脚本**

Windows: `setup.bat`
Linux: `./setup.sh`

- [ ] **Step 7: 提交**

```bash
git add setup.bat setup.sh scripts/setup-ai.ps1 scripts/setup-ai.sh
git commit -m "feat: add one-click setup scripts with AI services"
```
echo "[4/4] 检查环境变量..."
if [ ! -f ".env.local" ]; then
    echo "  正在创建环境变量文件..."
    cp .env.example .env.local
    echo "✓ 环境变量已创建"
else
    echo "✓ 环境变量已存在"
fi

echo ""
echo "======================================"
echo "  启动开发服务器"
echo "======================================"
echo ""
echo "  访问地址: http://localhost:3000"
echo "  按 Ctrl+C 停止服务器"
echo "======================================"
echo ""

# 启动开发服务器
npm run dev
```

- [ ] **Step 3: 设置脚本执行权限**

```bash
chmod +x setup.sh
```

- [ ] **Step 4: 测试启动脚本**

Windows: `setup.bat`
Linux: `./setup.sh`

- [ ] **Step 5: 提交**

```bash
git add setup.bat setup.sh
git commit -m "feat: add one-click setup scripts"
```

---

## Task 5: 更新README文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新README.md**

在README.md中添加以下内容：

```markdown
## 快速开始

### 方式一：一键启动（推荐）

1. 克隆项目
```bash
git clone <repository-url>
cd smart-agriculture
```

2. 运行启动脚本

**Windows:**
```bash
setup.bat
```

**Linux/macOS:**
```bash
chmod +x setup.sh
./setup.sh
```

3. 访问 http://localhost:3000

### 方式二：手动启动

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 修改配置
```

3. 初始化数据库
```bash
node scripts/init-db.js
```

4. 启动开发服务器
```bash
npm run dev
```

### 方式三：Docker部署

```bash
docker-compose up -d
```

## 依赖检测

运行依赖检测脚本检查环境：

**Windows:**
```bash
powershell -ExecutionPolicy Bypass -File scripts/check-deps.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/check-deps.sh
./scripts/check-deps.sh
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| DATABASE_TYPE | 数据库类型 | sqlite |
| SQLITE_DB_PATH | SQLite文件路径 | ./smart_agriculture.db |
| AI_MODE | AI模式 | auto |
| OLLAMA_HOST | Ollama服务地址 | http://localhost:11434 |
| OLLAMA_MODEL | Ollama模型 | qwen3:1.7b-q4_K_M |
| INFERENCE_HOST | 推理服务地址 | http://localhost:5000 |
| RAG_SERVICE_URL | RAG服务地址 | http://localhost:5001 |
| AI_PROVIDER | 网络AI提供商 | openai |
| OPENAI_API_KEY | OpenAI API密钥 | - |
| OPENAI_API_BASE | OpenAI API地址 | https://api.openai.com/v1 |
| OPENAI_MODEL | OpenAI模型 | gpt-4o-mini |
| PORT | Next.js端口 | 3000 |

## AI服务配置

### 本地AI（推荐）

本地AI服务提供最快的响应速度和隐私保护：

1. **安装AI服务**
```bash
# Windows
powershell -ExecutionPolicy Bypass -File scripts/setup-ai.ps1

# Linux/macOS
chmod +x scripts/setup-ai.sh
./scripts/setup-ai.sh
```

2. **启动AI服务**
```bash
# 启动Ollama
ollama serve

# 启动YOLO推理服务
cd inference-service
source venv/bin/activate  # Windows: venv\Scripts\activate
python app.py

# 启动RAG服务
python rag_app.py
```

3. **配置环境变量**
```env
AI_MODE=local
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b-q4_K_M
INFERENCE_HOST=http://localhost:5000
RAG_SERVICE_URL=http://localhost:5001
```

### 网络API（备选）

当本地AI服务不可用时，可使用网络API：

1. **OpenAI**
```env
AI_MODE=network
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

2. **通义千问**
```env
AI_MODE=network
AI_PROVIDER=tongyi
DASHSCOPE_API_KEY=sk-your-key-here
DASHSCOPE_MODEL=qwen-turbo
```

3. **智谱AI**
```env
AI_MODE=network
AI_PROVIDER=zhipu
ZHIPU_API_KEY=your-key-here
ZHIPU_MODEL=glm-4-flash
```

4. **自定义API**
```env
AI_MODE=network
AI_PROVIDER=custom
CUSTOM_API_URL=https://your-api.com/v1
CUSTOM_API_KEY=your-key-here
CUSTOM_API_MODEL=your-model
```

### 自动模式（默认）

自动模式会优先使用本地AI，本地不可用时自动切换到网络API：

```env
AI_MODE=auto
# 本地AI配置
OLLAMA_HOST=http://localhost:11434
# 网络API配置（作为备选）
OPENAI_API_KEY=sk-your-key-here
```
pip install -r requirements-rag.txt
python rag_app.py
```

## 常见问题

### Q: 启动时提示"数据库连接失败"
A: 默认使用SQLite，无需安装MySQL。如需使用MySQL，请在.env.local中配置数据库信息。

### Q: AI功能不可用
A: AI服务为可选组件，不影响基础功能使用。如需AI功能，请启动Ollama和推理服务。

### Q: Windows上执行策略被禁止
A: 运行以下命令允许脚本执行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: update README with quick start guide"
```

---

## Task 6: 更新package.json脚本

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加便捷脚本**

在package.json的scripts部分添加：

```json
{
  "scripts": {
    "dev": "node start-dev.js",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:init": "node scripts/init-db.js",
    "db:check": "node scripts/check-timestamps.js",
    "setup": "npm install && npm run db:init",
    "check:deps": "powershell -ExecutionPolicy Bypass -File scripts/check-deps.ps1"
  }
}
```

- [ ] **Step 2: 测试脚本**

```bash
npm run db:init
npm run check:deps
```

- [ ] **Step 3: 提交**

```bash
git add package.json
git commit -m "feat: add convenience scripts to package.json"
```

---

## Task 7: 创建.gitignore规则

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 确保.gitignore包含以下规则**

```gitignore
# 环境变量
.env
.env.local
.env.*.local

# 数据库文件
*.db
*.db-journal
*.db-wal

# 依赖
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# 构建产物
.next/
out/
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志
*.log
npm-debug.log*

# 模型文件（大文件）
*.pt
*.onnx
*.bin

# 向量索引
*.faiss
*.faiss.meta.json
```

- [ ] **Step 2: 提交**

```bash
git add .gitignore
git commit -m "chore: update .gitignore rules"
```

---

## Task 8: 测试完整移植流程

- [ ] **Step 1: 模拟新环境**

```bash
# 备份当前环境
cp .env.local .env.local.backup
cp smart_agriculture.db smart_agriculture.db.backup

# 清理环境
rm -rf node_modules
rm -f .env.local
rm -f smart_agriculture.db
```

- [ ] **Step 2: 运行一键启动**

Windows: `setup.bat`
Linux: `./setup.sh`

- [ ] **Step 3: 验证功能**

1. 访问 http://localhost:3000
2. 检查数据概览页面
3. 检查传感器数据页面
4. 检查执行器控制页面

- [ ] **Step 4: 恢复环境**

```bash
# 恢复备份
cp .env.local.backup .env.local
cp smart_agriculture.db.backup smart_agriculture.db
npm install
```

- [ ] **Step 5: 提交最终版本**

```bash
git add -A
git commit -m "feat: complete project portability setup"
```

---

## 验证清单

完成所有任务后，验证以下功能：

- [ ] Windows一键启动脚本正常工作
- [ ] Linux/macOS一键启动脚本正常工作
- [ ] 依赖检测脚本正确识别已安装/未安装的依赖
- [ ] 数据库初始化脚本创建完整的表结构
- [ ] 环境变量模板包含所有必要配置
- [ ] README文档包含清晰的部署说明
- [ ] 项目可在全新环境中成功启动
