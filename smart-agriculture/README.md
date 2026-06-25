# 智慧农业物联网监控平台

基于Next.js + React + TypeScript + SQLite的智慧农业物联网监控平台，支持传感器数据采集、执行器控制、AI智能诊断、知识库管理等功能。

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

## 常见问题

### Q: 启动时提示"数据库连接失败"
A: 默认使用SQLite，无需安装MySQL。如需使用MySQL，请在.env.local中配置数据库信息。

### Q: AI功能不可用
A: 检查以下几点：
1. 本地AI服务是否启动（Ollama、YOLO推理、RAG服务）
2. 网络API密钥是否配置正确
3. 运行依赖检测脚本检查环境

### Q: Windows上执行策略被禁止
A: 运行以下命令允许脚本执行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q: Python依赖安装失败
A: 确保Python版本 >= 3.11，并尝试以下命令：
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 项目结构

```
smart-agriculture/
├── app/                    # Next.js应用目录
├── components/             # React组件
├── lib/                    # 核心库
├── scripts/                # 脚本工具
├── inference-service/      # AI推理服务
├── setup.bat               # Windows一键启动
├── setup.sh                # Linux/macOS一键启动
├── .env.example            # 环境变量模板
└── README.md               # 项目文档
```

## 技术栈

- **前端**: Next.js 16.2.0 + React 19 + TypeScript + shadcn/ui + Tailwind CSS
- **后端**: Next.js API Routes + WebSocket
- **数据库**: SQLite (开发) / MySQL (生产)
- **AI服务**: Ollama + YOLOv5 + RAG (FAISS + BGE)
- **图表**: Recharts

## 许可证

MIT License
