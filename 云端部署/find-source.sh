#!/bin/bash
# 抓 45 秒 3000 端口流量，找出上报 192.168.1.63 摄像头数据的来源 IP
timeout 45 tcpdump -i any -A -s 1600 'tcp port 3000' > /tmp/cap.txt 2>/dev/null
echo "=== 含 192.168.1.63 的报文上下文(前 400 字节) ==="
grep -a -B30 "192.168.1.63" /tmp/cap.txt | grep -aE "^([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+) IP " | tail -20
echo "=== 直接找含特征字符串的 IP 行 ==="
python3 - <<'EOF'
import re
data = open('/tmp/cap.txt','rb').read().decode('utf-8','ignore')
# 按 tcpdump 包分隔符拆
pkts = re.split(r'\n\d{2}:\d{2}:\d{2}\.\d+ IP ', data)
for p in pkts:
    if '192.168.1.63' in p and 'stream_url' in p:
        header = p.split('\n')[0]
        print('PKG:', header[:120])
EOF
rm -f /tmp/cap.txt
