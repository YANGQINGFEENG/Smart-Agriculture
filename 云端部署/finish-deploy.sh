#!/bin/bash
# 服务器端收尾：清理残留构建进程 + 校验本地上传的 .next 产物 + PM2 启动
set -e
APP=/opt/Smart-Agriculture/smart-agriculture
LOG=/opt/finish-deploy.log
exec > >(tee -a $LOG) 2>&1

echo "=== [1/4] 清理可能残留的构建/部署进程 ==="
pkill -f "next build" 2>/dev/null || true
pkill -f "npm run build" 2>/dev/null || true
pkill -f "deploy-app.sh" 2>/dev/null || true
sleep 2

echo "=== [2/4] 校验上传产物 ==="
test -f $APP/.next/BUILD_ID && echo "BUILD_ID: $(cat $APP/.next/BUILD_ID)"
test -f $APP/package.json && echo "package.json ok"
test -d $APP/node_modules && echo "node_modules ok"
test -f $APP/.env.local && echo ".env.local ok"

echo "=== [3/4] PM2 启动 ==="
cd $APP
pm2 delete smart-agri-web 2>/dev/null || true
pm2 delete smart-agri-ws 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "=== [4/4] 端口监听检查 ==="
sleep 8
ss -tlnp | grep -E ':3000 |:8080 |:8081 ' || echo "WARN: 端口尚未监听，稍后用 pm2 status / pm2 logs 检查"
pm2 status
echo "=== 完成 ==="
