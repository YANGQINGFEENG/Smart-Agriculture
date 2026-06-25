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
