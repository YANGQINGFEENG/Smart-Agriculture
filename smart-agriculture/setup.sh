#!/bin/bash
# setup.sh - 天工慧眼智慧农业物联网平台一键启动脚本

set -e

echo "======================================"
echo "  天工慧眼 - 智慧农业物联网平台"
echo "  一键启动"
echo "======================================"
echo ""

# 检测并安装Node.js
echo "[1/8] 检测Node.js..."
if ! command -v node &> /dev/null; then
    echo "✗ 未检测到Node.js，正在自动安装..."
    
    # 检测操作系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install node@20
        else
            echo "  正在安装Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            brew install node@20
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Ubuntu/Debian
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        else
            echo "  请手动安装Node.js: https://nodejs.org/"
            exit 1
        fi
    fi
    
    echo "✓ Node.js安装完成"
else
    echo "✓ Node.js已安装"
fi

# 检测并安装Python
echo "[2/8] 检测Python..."
if ! command -v python3 &> /dev/null; then
    echo "✗ 未检测到Python，正在自动安装..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install python@3.11
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y python3.11 python3.11-venv python3-pip
        elif command -v yum &> /dev/null; then
            sudo yum install -y python3
        fi
    fi
    
    echo "✓ Python安装完成"
else
    echo "✓ Python已安装"
fi

# 检测pip
echo "[3/8] 检测pip..."
if ! command -v pip3 &> /dev/null; then
    echo "✗ 未检测到pip，正在安装..."
    python3 -m ensurepip --upgrade
    python3 -m pip install --upgrade pip
fi
echo "✓ pip已安装"

# 安装Node.js依赖
echo "[4/8] 检测项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "  正在安装Node.js依赖..."
    npm install || {
        echo "  使用淘宝镜像重试..."
        npm config set registry https://registry.npmmirror.com
        npm install
    }
fi
echo "✓ Node.js依赖已安装"

# 安装Python依赖
echo "[5/8] 检测Python依赖..."
if [ ! -d "inference-service/venv" ]; then
    echo "  正在创建Python虚拟环境..."
    cd inference-service
    python3 -m venv venv
    source venv/bin/activate
    echo "  正在安装Python依赖（使用清华镜像）..."
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    pip install -r requirements-rag.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    cd ..
    echo "✓ Python依赖已安装"
else
    echo "✓ Python依赖已安装"
fi

# 初始化数据库
echo "[6/8] 初始化数据库..."
if [ ! -f "smart_agriculture.db" ]; then
    echo "  正在创建数据库..."
    node scripts/init-db.js
fi
echo "✓ 数据库已就绪"

# 创建环境变量
echo "[7/8] 检查环境变量..."
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

# 检测并安装Ollama
echo "[8/8] 检测Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "○ Ollama未安装，正在安装..."
    curl -fsSL https://ollama.ai/install.sh | sh
    echo "✓ Ollama安装完成"
    echo "  正在拉取AI模型..."
    ollama pull qwen3:1.7b-q4_K_M
    echo "  正在拉取视觉模型..."
    ollama pull llava:7b
else
    echo "✓ Ollama已安装"
fi

echo ""
echo "======================================"
echo "  启动服务"
echo "======================================"
echo ""

# 启动AI服务
echo "正在启动AI服务..."

# 启动Ollama（后台）
ollama serve &
OLLAMA_PID=$!
echo "✓ Ollama已启动 (PID: $OLLAMA_PID)"

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
sleep 5

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
