# 天工慧眼 - 无 Docker 云端部署操作手册

本方案不使用 Docker，在云服务器（Ubuntu 22.04）上直接运行三个核心服务：

| 服务 | 端口 | 对外暴露 |
|------|------|----------|
| Next.js 主应用 | 3000 | 是（网页 + API） |
| WebSocket 服务器 | 8080 (WS) | 是（前端直连 `ws://IP:8080`） |
| WebSocket 命令中继 | 8081 (HTTP) | 否（仅本机） |
| MySQL 8.0 | 3306 | 否（仅本机） |

AI 相关服务（Ollama / YOLO / RAG）本次不部署。

---

## 目录

1. [准备文件清单](#1-准备文件清单)
2. [本地准备（Windows）](#2-本地准备windows)
3. [服务器环境安装](#3-服务器环境安装)
4. [数据导入与应用部署](#4-数据导入与应用部署)
5. [验证清单](#5-验证清单)
6. [常见问题](#6-常见问题)
7. [日常运维](#7-日常运维)

---

## 1. 准备文件清单

本目录（`云端部署/`）下的文件：

| 文件 | 用途 | 上传位置 |
|------|------|----------|
| `server-init.sh` | 服务器环境一键安装 | 服务器 `/opt/` |
| `env.production.template` | 生产环境变量模板 | 复制为项目根目录 `.env.local` |
| `ecosystem.config.js` | PM2 进程配置（web + ws） | 复制到项目根目录 |
| `smart_agriculture_full.sql` | 本地导出的数据库数据 | 服务器 `/opt/` |

---

## 2. 本地准备（Windows）

### 2.1 导出本地 MySQL 数据

本地项目使用 MySQL（`.env.local` 中 `DATABASE_TYPE=mysql`），导出全部结构和数据：

```powershell
mysqldump -u root -p --databases smart_agriculture > e:\tghy\云端部署\smart_agriculture_full.sql
```

> 若提示 `mysqldump` 不是命令，需将 MySQL `bin` 目录加入 PATH，或进入安装目录执行。
> 导出后检查文件大小，`sensor_data` 表数据量大属正常。

### 2.2 本地构建验证（推荐）

```powershell
cd e:\tghy\smart-agriculture
npm run build
```

构建成功后直接把 `.next` 产物一并上传，云端可免构建启动。

### 2.3 上传到服务器

**需要上传的内容**：
- 项目目录 `smart-agriculture/`（**排除** `node_modules`、`.git`、`models\*.pt`、`inference-service`、`public\uploads\camera`）
- `smart_agriculture_full.sql`
- 本目录的 3 个配置文件

**方式一：WinSCP（图形界面）**，直接拖拽上传到 `/opt/smart-agriculture`。

**方式二：scp 命令**（PowerShell）：

```powershell
# 先在本地打包（排除大目录），或使用 WinSCP 拖拽
scp -r e:\tghy\smart-agriculture root@服务器IP:/opt/smart-agriculture
scp e:\tghy\云端部署\smart_agriculture_full.sql root@服务器IP:/opt/
scp e:\tghy\云端部署\server-init.sh e:\tghy\云端部署\env.production.template e:\tghy\云端部署\ecosystem.config.js root@服务器IP:/opt/
```

> 若项目整体过大（`public/uploads/camera` 有约 1 万张图片），建议用 WinSCP 过滤或先压缩排除后再传。

---

## 3. 服务器环境安装

### 3.1 前置：云厂商安全组

在云控制台的安全组中放行（与服务器 ufw 是两层，缺一不可）：

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH |
| 3000 | TCP | Next.js 网页/API |
| 8080 | TCP | 设备/前端 WebSocket |

**3306、8081 一律不开放。**

### 3.2 执行安装脚本

```bash
ssh root@服务器IP
bash /opt/server-init.sh
```

脚本自动完成：系统更新 → Node.js 20 → PM2 → MySQL 8.0 → ufw 防火墙（仅放行 22/3000/8080）。

### 3.3 修改 MySQL root 密码（可选但推荐）

```bash
mysql -u root -p
```

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY '你的强密码';
FLUSH PRIVILEGES;
```

> 修改后需同步更新 `.env.local` 中的 `DB_PASSWORD`。

---

## 4. 数据导入与应用部署

### 4.1 导入数据库

```bash
mysql -u root -p < /opt/smart_agriculture_full.sql

# 验证数据已导入
mysql -u root -p -e "USE smart_agriculture; SELECT COUNT(*) FROM sensor_data; SELECT COUNT(*) FROM sensors; SELECT COUNT(*) FROM actuators;"
```

### 4.2 配置环境变量

```bash
cp /opt/env.production.template /opt/smart-agriculture/.env.local
nano /opt/smart-agriculture/.env.local   # 确认 DB_PASSWORD 与实际一致
```

### 4.3 安装依赖并构建

```bash
cd /opt/smart-agriculture
npm ci --registry=https://registry.npmmirror.com

# 若已上传本地 .next 构建产物可跳过下一步
npm run build
```

### 4.4 PM2 启动服务

```bash
cp /opt/ecosystem.config.js /opt/smart-agriculture/
cd /opt/smart-agriculture

pm2 start ecosystem.config.js
pm2 status          # 两个进程均应为 online
pm2 logs            # 检查启动日志无报错

# 配置开机自启
pm2 startup && pm2 save
```

---

## 5. 验证清单

| 验证项 | 方法 | 预期 |
|--------|------|------|
| 网页访问 | 浏览器打开 `http://服务器IP:3000` | 首页加载，仪表盘显示本地迁来的传感器数据 |
| API 响应 | `curl http://服务器IP:3000/api/sensors` | 返回 JSON 数据 |
| WebSocket | 打开 /areas 页面，F12 → Network → WS | `ws://服务器IP:8080` 状态为 101/已连接 |
| 执行器下发 | 页面操作水泵开关 | 命令经 8081 中继正常返回 |
| 数据持久化 | `pm2 restart all` 后刷新页面 | 数据仍在（MySQL 落盘） |
| 开机自启 | 重启服务器后再访问 | PM2 自动拉起两个进程 |

---

## 6. 常见问题

### 页面能打开但无数据
- 检查环境变量：`cat /opt/smart-agriculture/.env.local`
- 查看应用日志：`pm2 logs smart-agri-web --lines 100`
- 手动验证数据库：`mysql -u root -p -e "SELECT COUNT(*) FROM smart_agriculture.sensors;"`

### WebSocket 连不上（/areas 页面显示离线）
- 确认云安全组已放行 **TCP 8080**
- 确认服务器 ufw 已放行：`ufw status`
- 查看 WS 日志：`pm2 logs smart-agri-ws`
- 本地端口监听确认：`ss -tlnp | grep -E "8080|8081|3000"`

### 执行器命令不生效
- 8081 无需对外，但 Next.js 必须能访问它：`curl http://localhost:8081/status`
- 确认 `.env.local` 中 `WS_RELAY_URL=http://localhost:8081`
- 两个 PM2 进程都必须在线：`pm2 status`

### npm ci 失败
```bash
npm cache clean --force
npm ci --registry=https://registry.npmmirror.com
```

### 端口被占用
```bash
ss -tlnp | grep :3000
# 找到占用进程后 kill，或修改 PM2 配置中的端口
```

---

## 7. 日常运维

### 常用命令

```bash
pm2 status                     # 进程状态
pm2 logs smart-agri-web        # 应用日志
pm2 logs smart-agri-ws         # WebSocket 日志
pm2 restart all                # 重启全部
pm2 monit                      # 资源监控面板
```

### 更新代码

```bash
# 本地重新构建后上传覆盖（排除 node_modules/.next 由云端 npm ci 重建）
cd /opt/smart-agriculture
npm ci --registry=https://registry.npmmirror.com
npm run build
pm2 restart all
```

### 数据备份

```bash
# 手动备份
mysqldump -u root -p --databases smart_agriculture > /opt/backup_$(date +%Y%m%d).sql

# 定时备份（每日 3:00，保留 7 天）
crontab -e
# 添加一行：
0 3 * * * mysqldump -u root -p'你的密码' --databases smart_agriculture > /opt/backup_$(date +\%Y\%m\%d).sql && find /opt -name "backup_*.sql" -mtime +7 -delete
```

### 回滚

应用回滚：重新上传旧版本代码 + `pm2 restart all`（数据库不回滚）。
数据回滚：先导入备份 `mysql -u root -p smart_agriculture < /opt/backup_YYYYMMDD.sql`（覆盖前先备份当前数据）。

---

## 后续可选增强

- Nginx 反代 80/443 + HTTPS + 域名备案（消除混合内容限制，支持 wss）
- AI 服务（Ollama / YOLO / RAG）按需上云，或改用通义千问等云端 API
- 接入 UptimeRobot 等外部可用性监控
