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
