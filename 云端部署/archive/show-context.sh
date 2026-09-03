#!/bin/bash
F=/root/cap3-backup.txt
echo "=== 192.168.1.63 前后各 12 行 ==="
grep -an '192.168.1.63' $F | while IFS=: read ln rest; do
  start=$((ln-12)); [ $start -lt 1 ] && start=1
  sed -n "${start},$((ln+12))p" $F | cat -v | cut -c1-200
  echo "----------"
done
