#!/bin/bash
cd /opt/Smart-Agriculture/smart-agriculture
echo "--- public 根目录 ---"; ls public/
echo "--- 构建时存在的文件 ---"
for f in placeholder.jpg icon.svg placeholder-logo.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000/$f")
  echo "$f = $code"
done
echo "--- 运行时新增的帧 ---"
latest=$(ls -t public/uploads/camera/*.jpg | head -1)
echo "latest: $latest"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000/uploads/camera/$(basename $latest)")
echo "frame = $code"
