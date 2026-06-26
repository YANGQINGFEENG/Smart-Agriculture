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
