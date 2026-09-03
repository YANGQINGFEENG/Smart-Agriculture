#!/bin/bash
echo "=== 首页引用的 chunks ==="
curl -s http://localhost:3000/ | grep -o '/_next/static/chunks/[^"]*' | sort -u | head -25
echo ""
echo "=== 服务器上实际存在的 chunks ==="
ls -la /opt/Smart-Agriculture/smart-agriculture/.next/static/chunks/ | head -30
echo ""
echo "=== 测试一个含省略号的文件名请求 ==="
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/_next/static/chunks/0qmt1460ai8...js"
