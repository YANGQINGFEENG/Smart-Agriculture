# Bonsai Agent 迁移集成开发计划

> 目标：将 `e:\tghy\bonsai_agent`（川派盆景智能养护 Agent）的核心逻辑迁移到树莓派项目
> `基于树莓派yolo的传感器检测与上传`，用真实硬件替换模拟接口，并将判断/诊疗结果通过 API
> 上传到云端 `smart-agriculture` 服务器（47.108.163.78:3000）。
>
> 本轮仅产出计划，下一轮对话开始实施。

---

## 一、现状分析

### 1.1 bonsai_agent 现有逻辑（待迁移资产）

| 模块 | 文件 | 现状 | 迁移价值 |
|---|---|---|---|
| 主循环 | `main.py` | 环境监测 + AI 视觉两条流水线，5 秒一轮 | 流程框架 ✅ |
| 规则决策 | `control/decision_engine.py` | 阈值规则：土壤湿度<25%→水泵、温度>35℃→风扇、光照<10000lux→补光灯 | ✅ 核心 |
| 设备执行 | `tools/device_tool.py` | **模拟**（仅 print） | ❌ 替换为树莓派真实驱动 |
| 传感器 | `tools/sensor_tool.py` | **模拟**（写死 4 个值） | ❌ 替换为树莓派真实传感器 |
| YOLO | `tools/yolo_tool.py` | **模拟**（写死"红蜘蛛 0.87"） | ❌ 替换为树莓派真实 YOLO |
| 专家知识库 | `tools/knowledge_tool.py` + `data/专家数据库.xlsx` + `data/pest_database.json` | pandas+calamine 读取 Excel，按"问题标准名称"模糊匹配 | ✅ 核心资产 |
| LLM 诊疗 | `tools/llm_tool.py` + `prompts/system_prompt.txt` | 本地 Ollama `deepseek-r1:1.5b`，命中专家库/未命中两套 prompt | ✅ 核心资产 |
| 本地记录 | `database/`（SQLite 四张表） | sensor_records / detection_records / diagnosis_records / device_logs | ⚠️ 可选保留 |
| 节流机制 | `main.py` | 检测记录 60s 间隔、诊疗 600s 间隔、设备冷却（水泵 600s/风扇 60s/灯 60s） | ✅ 保留 |

### 1.2 树莓派项目已有能力（迁移落点）

- **传感器**：`drivers/sensors/`（dht/bmp280/light/mpu6050/vibration），`system.sensors` 统一持有
- **YOLO**：`drivers/yolo_detector.py`（ultralytics，`models/last.pt`，`get_detections()` 返回
  `[{class_name, confidence, bbox}]`），已绑定摄像头逐帧推理
- **执行器**：`drivers/actuators/`（relay/fan/rgb_led/laser/buzzer/servo），`system.actuators` 统一持有，
  命令执行入口 `system._execute_commands()`
- **上传服务**：`services/upload_service.py`
  - `POST /api/device/report`（传感器/执行器上报，已带离线缓存）
  - `POST /api/device/upload-image`（帧上传，detection 元数据已含 YOLO 结果）
  - `GET /api/actuators/{id}/commands` + `PATCH .../commands`（云端命令拉取与回执）
- **服务编排**：`app/system.py` 后台线程模式（上传/心跳/命令轮询/手势控制均为 daemon 线程）

### 1.3 云端 smart-agriculture 现有通道

| 数据 | 通道 | 状态 |
|---|---|---|
| 传感器/执行器数据 | `POST /api/device/report` | ✅ 已有 |
| YOLO 检测元数据（随帧） | `POST /api/device/upload-image` 的 `detection` 字段 | ✅ 已有 |
| Agent 自动控制动作 | 执行器上报（`state` + `mode=auto`）+ 命令回执 | ✅ 已有 |
| **Agent 诊疗结果**（病虫害+诊断+建议） | 无接收 API（`/api/ai/diagnosis` 是云端自己调 Ollama，非接收口） | ❌ **需新增** |

---

## 二、总体设计

```text
树莓派（边缘端）                              云端 smart-agriculture
┌──────────────────────────────┐
│ agent_service（新，后台线程）  │
│  ├─ 环境监测流:               │
│  │   system.sensors 读取      │──传感器/执行器──→ /api/device/report（已有）
│  │   → decision_engine 决策   │
│  │   → 真实执行器动作          │──自动控制状态──→ report(mode=auto)（已有）
│  ├─ 视觉诊疗流:               │
│  │   yolo_detector 检测结果   │──检测帧+元数据──→ /api/device/upload-image（已有）
│  │   → knowledge_tool 专家库  │
│  │   → llm_tool DeepSeek     │──诊疗结果──────→ /api/device/agent-diagnosis（新增）
│  └─ 本地 SQLite 记录（可选）   │
└──────────────────────────────┘
```

设计原则：
1. **不动 bonsai_agent 原目录**，核心模块复制适配后放入树莓派项目 `agent/` 包
2. 断网时自动养护逻辑照常运行，诊疗结果走离线缓存（复用 CacheService）
3. LLM 失败不阻塞主循环（沿用 bonsai_agent 的兜底文案机制）
4. 所有阈值/间隔/映射全部配置化（`config/settings.yaml` 新增 `agent` 段）

---

## 三、树莓派端实施内容

### 3.1 新增 `agent/` 包

| 文件 | 来源 | 改造点 |
|---|---|---|
| `agent/__init__.py` | 新建 | 包声明 |
| `agent/decision_engine.py` | 迁自 `control/decision_engine.py` | 阈值从配置读取（`agent.thresholds`），不再写死 |
| `agent/knowledge_tool.py` | 迁自 `tools/knowledge_tool.py` | 数据路径可配置；优先用 `data/pest_database.json`，回退 Excel |
| `agent/llm_tool.py` | 迁自 `tools/llm_tool.py` | Ollama host/model 可配置（`agent.llm.host/model`），默认 `deepseek-r1:1.5b` |
| `agent/device_tool.py` | **重写**（原为模拟） | 调用 `system.actuators` 真实驱动；设备名映射见 3.3 |
| `agent/agent_service.py` | **重写**（改编自 `main.py`） | 后台线程 + 两条流水线 + 节流 + 上传回调 |
| `agent/data/pest_database.json`、`agent/data/专家数据库.xlsx` | 复制自 bonsai_agent | 随包携带 |
| `agent/prompts/system_prompt.txt` | 复制自 bonsai_agent | 不变 |

### 3.2 `agent_service.py` 主循环设计

```python
class AgentService:
    def __init__(self, system, config, upload_service, cache_service=None)
    def start(self)   # 启动 daemon 线程
    def stop(self)
    def _environment_loop(self):
        # 1. 从 system.sensors 读取 temperature / humidity / soil_moisture(ADC) / light
        # 2. make_control_decision(sensor_data)  ← agent/decision_engine.py
        # 3. 冷却检查（water_pump 600s / fan 60s / light 60s）
        # 4. device_tool.execute_action() 驱动真实执行器
        # 5. upload_service.upload_actuator_state(mode="auto") 上报自动控制状态
    def _vision_loop(self):
        # 1. system.yolo_detector.get_detections() 取最高置信度结果
        # 2. 节流：同名 600s 内不重复诊疗（DIAGNOSIS_INTERVAL）
        # 3. knowledge_tool.search_expert(pest_name)
        # 4. 命中 → call_llm_with_expert；未命中 → call_llm_without_expert
        # 5. upload_service.upload_agent_diagnosis(diagnosis_data)
        # 6. 失败 → cache_service 缓存（复用 upload_retry_interval 重传）
```

两个循环拆为独立线程（环境 5s 一轮较频繁，视觉诊疗含 LLM 调用耗时可达数十秒，
共用一个循环会阻塞环境控制）。

### 3.3 执行器映射（`agent.actuator_mapping`）

| bonsai_agent 设备名 | 树莓派执行器（settings.yaml device_mapping） | node_id |
|---|---|---|
| `water_pump` | `relay`（继电器接水泵，type=valve） | VL-1-001 |
| `fan` | `fan` | FN-1-001 |
| `light` | `rgb_led`（补光） | LT-1-002 |

### 3.4 现有文件修改

| 文件 | 修改 |
|---|---|
| `config/settings.yaml` | 新增 `agent:` 配置段（见 3.5） |
| `app/system.py` | `start()` 时初始化并启动 AgentService；`stop()` 时停止；`get_status()` 增加 agent 状态 |
| `services/upload_service.py` | 新增 `upload_agent_diagnosis(data) -> Dict` 方法（POST `/api/device/agent-diagnosis`，失败可缓存） |
| `requirements.txt` | 增加 `pandas`、`python-calamine`、`ollama`（YOLO/requests 已有） |

### 3.5 `settings.yaml` 新增配置段

```yaml
agent:
  enabled: true
  loop_interval: 5          # 环境监测轮询间隔（秒）
  vision_interval: 10       # 视觉检查轮询间隔（秒）
  detection_log_interval: 60
  diagnosis_interval: 600   # 同名病虫害重复诊疗间隔（秒）
  device_cooldown:
    water_pump: 600
    fan: 60
    light: 60
  thresholds:               # decision_engine 阈值
    soil_moisture_min: 25
    temperature_max: 35
    light_min: 10000
  actuator_mapping:
    water_pump: relay
    fan: fan
    light: rgb_led
  actuator_cooldown_node_ids: true   # 冷却按 node_id 记录
  knowledge:
    data_path: agent/data/pest_database.json   # 回退: 专家数据库.xlsx
  llm:
    enabled: true
    host: http://127.0.0.1:11434   # 树莓派本地 Ollama；可改为云端地址
    model: deepseek-r1:1.5b
  upload_diagnosis: true   # 诊疗结果是否上传云端
```

---

## 四、云端 smart-agriculture 实施内容

### 4.1 新增 API：`app/api/device/agent-diagnosis/route.ts`

**POST /api/device/agent-diagnosis**

```jsonc
// 请求体
{
  "gateway_ip": "10.248.88.186",
  "farm_id": 1,
  "node_id": "CAM-1-001",
  "records": [                     // 支持批量
    {
      "pest_name": "红蜘蛛",
      "confidence": 0.87,
      "expert_id": "E-012",        // 专家库条目ID，未命中为 null
      "risk_level": "中",
      "diagnosis": "疑似红蜘蛛危害…",
      "advice": "立即措施：…\n养护措施：…",
      "knowledge_source": "expert_database",   // expert_database | deepseek_general
      "detected_at": "2026-09-02 10:00:00"
    }
  ]
}
// 响应
{ "success": true, "message": "...", "saved": 1 }
```

实现要点：复用 `lib/db`、`getBeijingTimeForDB()`；按 gateway_ip 关联 gateways 表（找不到不拦截，
gateway_id 存 null）；参数校验 pest_name 必填。

### 4.2 新增 MySQL 表（部署时在云端 MySQL 执行）

```sql
CREATE TABLE agent_diagnosis_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_id INT NULL,
  farm_id INT NULL,
  node_id VARCHAR(64) DEFAULT '',
  pest_name VARCHAR(128) NOT NULL,
  confidence FLOAT DEFAULT 0,
  expert_id VARCHAR(64) DEFAULT NULL,
  risk_level VARCHAR(32) DEFAULT '待评估',
  diagnosis TEXT,
  advice TEXT,
  knowledge_source VARCHAR(32) DEFAULT '',
  detected_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pest (pest_name),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 注意（项目教训）：云端建表 SQL 必须是 MySQL 语法、**不使用 `IF NOT EXISTS`**。

### 4.3 可选项（本轮默认不做，列为后续迭代）

- 前端页面展示诊疗历史（如 `ai-monitor` 页增加"边缘 Agent 诊疗"标签页，GET 接口同 route 文件）
- 环境越限事件对接 `/api/alarms/records`（决策触发时同步生成告警）

---

## 五、实施步骤（下一轮执行顺序）

| 阶段 | 内容 | 产出 |
|---|---|---|
| 1. 模块迁移 | 创建 `agent/` 包，迁移 decision_engine / knowledge_tool / llm_tool，复制数据与 prompt | agent/ 完整可独立单测 |
| 2. 接入真实硬件 | 重写 device_tool（对接 system.actuators）、sensor 读取（对接 system.sensors）、YOLO 取数 | 单元自测通过 |
| 3. 服务编排 | settings.yaml 配置段；system.py 启停集成；upload_service 增加 upload_agent_diagnosis | `python main.py status` 可见 agent 状态 |
| 4. 云端 API | 新增 route.ts + 建表 SQL；本地 `npm run build` 验证 | API 就绪 |
| 5. 部署 | 树莓派：deploy.ps1 同步 + 重启 smart-farm.service；云端：本地构建 → tar .next（排除 cache）→ scp 解压 → pm2 restart smart-agri-web | 双端上线 |
| 6. 端到端验证 | 云端 curl 验证 agent-diagnosis API；树莓派模拟触发一次诊疗；云端 MySQL 查表确认入库 | 验收记录 |

> 云端部署铁律（项目教训）：禁止在 2 核 2G 云服务器上执行 `npm run build`（曾引发交换风暴假死）。

---

## 六、风险与注意事项

1. **树莓派内存**：ultralytics 推理 + Ollama(1.5b) 同时常驻约需 3-4GB；Pi 5 8GB 可行，若紧张可将
   `agent.llm.host` 指向局域网/云端 Ollama，或 `agent.llm.enabled=false` 仅走专家库+兜底文案
2. **Excel 依赖**：`python-calamine` + `pandas` 需在树莓派安装验证；JSON 数据库优先，Excel 仅回退
3. **诊疗阻塞**：DeepSeek 调用可达数十秒，视觉流必须独立线程，且每次调用带超时保护
4. **设备安全**：自动控制必须保留冷却机制，且手动命令（云端下发）优先级高于 Agent 自动动作，
   冲突时 Agent 跳过执行（实施阶段在 device_tool 中检查最近手动命令时间）
5. **离线降级**：上传失败走 CacheService 重传；LLM/专家库异常时输出固定兜底文案，主循环不死
6. **数据重复**：云端表无唯一约束，靠树莓派端 `diagnosis_interval` 节流防重，不靠云端去重

---

## 七、实施结果记录（2026-09-02 部署完成）

### 已完成

| 阶段 | 结果 |
|---|---|
| 1-3 树莓派端 | `agent/` 包（6 个模块）+ settings.yaml 配置段 + system.py 集成 + upload_service 新增 `upload_agent_diagnosis()` 已部署到 `pi@10.248.88.186:~/smart-farm/`，venv 已安装 pandas/python-calamine/ollama |
| 4 云端 | `POST/GET /api/device/agent-diagnosis` 已上线（47.108.163.78:3000），MySQL 表 `agent_diagnosis_records` 已创建 |
| 5 部署 | 本地构建 → chunk 名安全修复（3 个含连续点文件、94 处引用）→ tar 上传解压 → pm2 restart，首页 HTTP 200 无白屏 |
| 6 验证 | 云端 API POST 实测 saved=1 入库正常（中文无乱码）；树莓派 Agent 双流水线启动成功：真实传感器采集（温度 27.4℃/湿度 37%/光照 79lux）→ 补光灯自动开启 + 状态上报成功 + 60s 自动关闭冷却机制正常 |

### 额外修复

- **YOLO 模型加载失败（既有问题）**：Pi 上 ultralytics 版本过旧缺 `C3k2` 属性，已在 venv 升级至 8.4.138，`models/last.pt`（类别 jing）加载成功（0.1s）

### 当前限制（待后续处理）

1. **DeepSeek 诊疗未激活**：Pi 与云端均无 Ollama 运行环境，LLM 环节自动降级为固定兑底文案（专家库内容正常）；后续可在 Pi 安装 Ollama 并 `ollama pull deepseek-r1:1.5b`，或将 `agent.llm.host` 指向其他可用 Ollama 实例
2. **补光灯动作频次**：当前环境光照 ~80lux 远低于阈值 10000lux，补光灯按 60s 冷却/60s 持续周期性启停（占空比 50%）；实际温室场景可调大 `agent.thresholds.light_min` 以下时的冷却时间或持续时间
3. **视觉诊疗端到端**：需摄像头实际检测到目标（类别 jing）才会触发完整诊疗链路

### 第二轮实施补充（2026-09-02 下午：前端展示 + 线上事故修复）

1. **云端前端新增「智能诊疗记录」页面**（用户需求）：`app/agent-diagnosis/page.tsx` + `components/dashboard/agent-diagnosis.tsx`，侧边栏「AI智能」分组新增入口；调 GET `/api/device/agent-diagnosis?limit=50`，展示统计卡片（总数/专家库命中/最新病虫害）与记录列表（病虫害/置信度/知识来源/专家库编号/诊断/建议），60s 自动刷新 + 手动刷新；已重新构建部署并浏览器实测展示 2 条记录正常
2. **confidence 保真度修复**：`agent_service.py` 两处 `diagnosis_data` 构造补充 `confidence` 字段，同步 Pi 后重跑 E2E，MySQL id=3 入库 confidence=0.91（修复前 id=2 为 0）
3. **线上事故修复（所有页面加载不出来）**：mysqld 持续 175% CPU（负载 3.1）拖垮 2 核服务器——`app/api/ai/diagnosis/route.ts` 的传感器相关子查询在 45 万行 `sensor_data` 上无 timestamp 索引，3 条相同查询僵死 22 小时（InnoDB ~50 万行/秒扫描）。处置：KILL 僵死查询 + 新增复合索引 `idx_sensor_time(sensor_id, timestamp)`（`scripts/add-sensor-data-index.sql`，在线 DDL 3.9s），查询从 22h 无法完成降至 0.87s，负载回落 0.4，页面响应恢复 ~80ms
4. **deploy.ps1 更新**（Spec 阶段 5）：新增 agent/ 包（6 模块 + data + prompts）与 config/settings.yaml 同步
