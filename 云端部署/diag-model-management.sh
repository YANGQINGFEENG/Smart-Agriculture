#!/bin/bash
# 诊断 /model-management 页面加载失败
APP=/opt/Smart-Agriculture/smart-agriculture
echo "=== [1] HTTP 状态（直连 3000）==="
for p in / /yolo-models /model-management /agent-diagnosis /ai-monitor; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "http://127.0.0.1:3000$p")
  t=$(curl -s -o /dev/null -w '%{time_total}' -m 20 "http://127.0.0.1:3000$p")
  echo "  $p -> $code  ${t}s"
done

echo "=== [2] 响应体前 300 字节 ==="
curl -s -m 20 http://127.0.0.1:3000/model-management | head -c 300
echo

echo "=== [3] 构建产物中的路由 ==="
ls -d $APP/.next/server/app/model-management 2>/dev/null || echo "  MISSING server/app/model-management"
find $APP/.next/server/app -maxdepth 2 -name 'page.js' 2>/dev/null | grep -E 'model-management|yolo-models' || echo "  no page.js match"
grep -o '/model-management' $APP/.next/BUILD_ID >/dev/null 2>&1
cat $APP/.next/BUILD_ID; echo

echo "=== [4] 组件文件是否存在 ==="
ls -l $APP/components/dashboard/model-management.tsx 2>/dev/null || echo "  MISSING components/dashboard/model-management.tsx"
ls -l $APP/app/model-management/page.tsx 2>/dev/null || echo "  MISSING app/model-management/page.tsx"

echo "=== [5] pm2 web 最近错误日志 ==="
pm2 logs smart-agri-web --lines 40 --nostream --err 2>/dev/null | tail -40
echo "=== [6] pm2 web 最近输出日志 ==="
pm2 logs smart-agri-web --lines 25 --nostream --out 2>/dev/null | tail -25
echo "DIAG_MM_DONE"
