#!/bin/bash
# 云端部署：识别模型切换功能（.next 产物 + websocket-server.js）
set -e
APP=/opt/Smart-Agriculture/smart-agriculture
TS=$(date +%Y%m%d-%H%M%S)
cd $APP

echo "=== [1/6] 备份现有产物 ==="
mv .next .next.bak-$TS
cp -f websocket-server.js websocket-server.js.bak-$TS
echo "backup -> .next.bak-$TS / websocket-server.js.bak-$TS"

echo "=== [2/6] 解压新构建 ==="
tar -xzf /tmp/next-build-yolo.tar.gz -C $APP
echo "BUILD_ID: $(cat $APP/.next/BUILD_ID)"

echo "=== [3/6] 更新 websocket-server.js ==="
cp -f /tmp/websocket-server.js $APP/websocket-server.js
node --check $APP/websocket-server.js && echo "WS_SYNTAX_OK"

echo "=== [4/6] 重启 PM2 ==="
pm2 restart smart-agri-web --update-env >/dev/null
pm2 restart smart-agri-ws --update-env >/dev/null
sleep 10

echo "=== [5/6] 端口与进程 ==="
pm2 status | head -10
ss -tlnp | grep -E ':3000 |:8080 |:8081 ' || echo "WARN: 端口未监听"

echo "=== [6/6] 接口自检 ==="
curl -s -o /dev/null -w "HOME %{http_code} %{time_total}s\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "PAGE /yolo-models %{http_code} %{time_total}s\n" http://127.0.0.1:3000/yolo-models
echo "--- GET /api/device/yolo-models ---"
curl -s -w "\nHTTP %{http_code}\n" "http://127.0.0.1:3000/api/device/yolo-models?gateway_ip=10.248.88.186" | head -c 800
echo
echo "--- GET /api/device/yolo-models/status ---"
curl -s -w "\nHTTP %{http_code}\n" "http://127.0.0.1:3000/api/device/yolo-models/status?gateway_ip=10.248.88.186" | head -c 400
echo
echo "--- WS relay /status ---"
curl -s http://127.0.0.1:8081/status
echo
echo "DEPLOY_DONE"
