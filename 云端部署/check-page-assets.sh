#!/bin/bash
# 检查页面 HTML 引用的静态资源是否真实存在（排查 chunk 改名后引用未同步）
APP=/opt/Smart-Agriculture/smart-agriculture
echo "=== [1] 页面 HTTP 状态 ==="
for p in / /yolo-models /model-management /agent-diagnosis /ai-monitor /knowledge; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{time_total}s %{size_download}B' -m 25 "http://127.0.0.1:3000$p")
  echo "  $p -> $out"
done

echo "=== [2] /model-management 引用的静态资源逐个探测 ==="
curl -s -m 25 http://127.0.0.1:3000/model-management > /tmp/mm.html
echo "  HTML size: $(wc -c < /tmp/mm.html)"
grep -o '/_next/static/[^"'"'"' ]*' /tmp/mm.html | sort -u > /tmp/mm-assets.txt
echo "  引用资源数: $(wc -l < /tmp/mm-assets.txt)"
MISS=0
while read -r a; do
  [ -z "$a" ] && continue
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:3000$a")
  if [ "$code" != "200" ]; then
    echo "  BROKEN $code $a"
    MISS=$((MISS+1))
  fi
done < /tmp/mm-assets.txt
echo "  失效资源数: $MISS"

echo "=== [3] 对照 /yolo-models ==="
curl -s -m 25 http://127.0.0.1:3000/yolo-models > /tmp/ym.html
grep -o '/_next/static/[^"'"'"' ]*' /tmp/ym.html | sort -u > /tmp/ym-assets.txt
MISS3=0
while read -r a; do
  [ -z "$a" ] && continue
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:3000$a")
  if [ "$code" != "200" ]; then echo "  BROKEN $code $a"; MISS3=$((MISS3+1)); fi
done < /tmp/ym-assets.txt
echo "  引用 $(wc -l < /tmp/ym-assets.txt) 个，失效 $MISS3 个"

echo "=== [5] 产物内是否残留连续点文件名 ==="
find $APP/.next -name '*..*' | head -10
echo "  count: $(find $APP/.next -name '*..*' | wc -l)"
echo "=== [6] 产物内是否残留旧引用（含 .rsc/.html/.meta）==="
grep -rl '\.\.js' $APP/.next/server/app --include='*.rsc' --include='*.html' --include='*.meta' 2>/dev/null | head -5
echo "ASSET_CHECK_DONE"
