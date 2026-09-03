#!/bin/bash
# 确认 RSC 载荷中残留的旧 chunk 名（改名脚本未覆盖 .rsc 扩展名）
APP=/opt/Smart-Agriculture/smart-agriculture/.next
echo "=== [1] 产物内含 '..js' 的文件清单（按扩展名统计）==="
grep -rl '\.\.js' $APP 2>/dev/null | sed 's/.*\.\([a-z]*\)$/\1/' | sort | uniq -c | sort -rn | head -10

echo "=== [2] model-management 的 RSC 中旧名样例 ==="
F=$APP/server/app/model-management.segments/model-management/__PAGE__.segment.rsc
grep -o '[A-Za-z0-9_~-]*\.\.[A-Za-z0-9_.-]*' "$F" 2>/dev/null | sort -u | sort -u | head -8
grep -o '[A-Za-z0-9_~-]*\.\.[A-Za-z0-9_.-]*' "$F" 2>/dev/null | sort -u | head -8

echo "=== [3] 浏览器实际拿到的 RSC（客户端导航请求）==="
curl -s -m 20 -H 'RSC: 1' 'http://127.0.0.1:3000/model-management' -o /tmp/mm.rsc -w 'HTTP %{http_code} %{size_download}B\n'
grep -o '[A-Za-z0-9_~-]*\.\.[A-Za-z0-9_.-]*' /tmp/mm.rsc 2>/dev/null | sort -u | head -8
echo "  RSC 内旧名个数: $(grep -o '[A-Za-z0-9_~-]*\.\.[A-Za-z0-9_.-]*' /tmp/mm.rsc 2>/dev/null | sort -u | wc -l)"

echo "=== [4] 这些旧名对应的 HTTP 探测 ==="
for n in $(grep -o 'static/chunks/[A-Za-z0-9_.~-]*' /tmp/mm.rsc 2>/dev/null | sort -u | head -6); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:3000/_next/$n")
  echo "  $code /_next/$n"
done

echo "=== [5] 磁盘上是否存在同名文件 ==="
for n in $(grep -o 'static/chunks/[A-Za-z0-9_.~-]*' /tmp/mm.rsc 2>/dev/null | sort -u | head -6); do
  p="$APP/../../.next/$n"
  [ -f "/opt/Smart-Agriculture/smart-agriculture/.next/$n" ] && echo "  EXISTS $n" || echo "  MISSING $n"
done
echo "RSC_CHECK_DONE"
