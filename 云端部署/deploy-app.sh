#!/bin/bash
# 云端部署：数据导入 + 拉取代码 + 依赖 + 构建 + PM2 启动
set -e
LOG=/opt/deploy.log
exec > >(tee -a $LOG) 2>&1

echo "===== [1/6] 导入数据库 ====="
mysql -u root -p'CloudMysql@2026' < /opt/smart_agriculture_full.sql
mysql -u root -p'CloudMysql@2026' -e "SELECT COUNT(*) AS sensors FROM smart_agriculture.sensors; SELECT COUNT(*) AS sensor_data FROM smart_agriculture.sensor_data;"

echo "===== [2/6] 拉取最新代码 ====="
cd /opt/Smart-Agriculture
git pull origin main
git log --oneline -1

echo "===== [3/6] 安装依赖 ====="
cd /opt/Smart-Agriculture/smart-agriculture
npm ci --registry=https://registry.npmmirror.com 2>&1 | tail -3

echo "===== [4/6] 配置环境变量 ====="
if [ ! -f .env.local ]; then
  cp /opt/env.production.template .env.local
  echo ".env.local created from template"
else
  echo ".env.local already exists, skip"
fi

echo "===== [5/6] 构建 Next.js ====="
npm run build 2>&1 | tail -20

echo "===== [6/6] PM2 启动 ====="
cp /opt/ecosystem.config.js ./
pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 status
pm2 save

echo "===== 部署完成 ====="
