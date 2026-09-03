#!/bin/bash
# 清理误建目录：/home/pi/C:Userslenovo
# 该目录由本机 PowerShell 提前展开 $HOME 导致，内含 ultralytics 自动下载的
# yolov8n.pt，与 ~/smart-farm/models/yolov8n.pt 的 md5 完全一致（纯重复副本）
JUNK='/home/pi/C:Userslenovo'
KEEP="$HOME/smart-farm/models/yolov8n.pt"

if [ ! -d "$JUNK" ]; then
  echo "JUNK_NOT_FOUND（已清理或从未创建）"
  exit 0
fi

echo "=== 清理前核对 ==="
find "$JUNK" -type f -printf '%10s %p\n'
DUP=$(find "$JUNK" -type f -name 'yolov8n.pt' -printf '%p\n' | head -1)
if [ -n "$DUP" ] && [ -f "$KEEP" ]; then
  A=$(md5sum "$DUP" | awk '{print $1}')
  B=$(md5sum "$KEEP" | awk '{print $1}')
  echo "md5 junk=$A keep=$B"
  if [ "$A" != "$B" ]; then
    echo "ABORT: 内容与保留副本不一致，未删除，请人工确认"
    exit 1
  fi
fi

# 只允许删除这一个确知的误建目录
case "$JUNK" in
  '/home/pi/C:Userslenovo') rm -rf "$JUNK" ;;
  *) echo "ABORT: 目标路径不在白名单"; exit 1 ;;
esac

echo "=== 清理后 ==="
[ -d "$JUNK" ] && echo "STILL_EXISTS" || echo "JUNK_GONE"
df -h / | tail -1
ls -lh "$HOME/smart-farm/models/"
echo "CLEAN_JUNK_DONE"
