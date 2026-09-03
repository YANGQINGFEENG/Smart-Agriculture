#!/bin/bash
# 云端部署：仅更新 .next 产物（修复 .rsc 中残留的旧 chunk 引用导致的客户端导航 404）
set -e
APP=/opt/Smart-Agriculture/smart-agriculture
TS=$(date +%Y%m%d-%H%M%S)
cd $APP

echo "=== [1/5] 备份并解压新产物 ==="
mv .next .next.bak-$TS
tar -xzf /tmp/next-fix.tar.gz -C $APP
echo "backup -> .next.bak-$TS"
echo "BUILD_ID: $(cat $APP/.next/BUILD_ID)"

echo "=== [2/5] 重启 Web ==="
pm2 restart smart-agri-web --update-env >/dev/null
sleep 10
pm2 status | head -6

echo "=== [3/5] 页面状态 ==="
for p in / /model-management /yolo-models /agent-diagnosis /ai-monitor /devices /knowledge; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{time_total}s' -m 25 "http://127.0.0.1:3000$p")
  echo "  $p -> $out"
done

echo "=== [4/5] RSC 客户端导航载荷的资源可达性（关键回归项）==="
TOTAL=0; BAD=0
for p in /model-management /yolo-models /agent-diagnosis /ai-monitor /knowledge /devices; do
  curl -s -m 25 -H 'RSC: 1' "http://127.0.0.1:3000$p" -o /tmp/rsc.txt
  refs=$(grep -o 'static/chunks/[A-Za-z0-9_.~-]*' /tmp/rsc.txt | sort -u)
  n=$(echo "$refs" | grep -c . || true)
  b=0
  for r in $refs; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:3000/_next/$r")
    if [ "$code" != "200" ]; then echo "  BROKEN[$p] $code /_next/$r"; b=$((b+1)); fi
  done
  echo "  $p: 引用 $n 个，失效 $b 个"
  TOTAL=$((TOTAL+n)); BAD=$((BAD+b))
done
echo "  合计引用 $TOTAL 个，失效 $BAD 个"

echo "=== [5/5] HTML 资源可达性 ==="
curl -s -m 25 http://127.0.0.1:3000/model-management > /tmp/mm.html
HB=0
for r in $(grep -o 'static/chunks/[A-Za-z0-9_.~-]*' /tmp/mm.html | sort -u); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:3000/_next/$r")
  if [ "$code" != "200" ]; then echo "  BROKEN_HTML $code /_next/$r"; HB=$((HB+1)); fi
done
echo "  HTML 失效资源: $HB"
echo "--- 产物内含 '..js' 的文件数（应为 0）---"
grep -rl '\.\.js' $APP/.next 2>/dev/null | wc -l
echo "DEPLOY_FIX_DONE"
