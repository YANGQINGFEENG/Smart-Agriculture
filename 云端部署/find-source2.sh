#!/bin/bash
timeout 60 tcpdump -i any -s 0 -w /tmp/cap.pcap 'tcp port 3000 or tcp port 8080' 2>/dev/null
python3 - <<'EOF'
import re
data = open('/tmp/cap.pcap','rb').read()
# 在原始字节中找 192.168.1.63 特征，回溯找最近的 IP 头
target = b'192.168.1.63'
idx = 0
found = 0
seen = set()
while found < 20:
    i = data.find(target, idx)
    if i == -1: break
    idx = i + 1
    # 往前找 "IP x.x.x.x.port > y.y.y.y.port" 文本不太可行(二进制pcap)，改用tcpdump文本重读
    found += 1
print("hits:", found)
EOF
# 改用文本模式重抓一次内容摘要
timeout 55 tcpdump -i any -s 0 -A 'tcp port 3000 or tcp port 8080' 2>/dev/null > /tmp/cap2.txt
echo "=== 含 192.168.1.63 的包与其源IP ==="
python3 - <<'EOF'
import re
txt = open('/tmp/cap2.txt', encoding='utf-8', errors='ignore').read()
pkts = re.split(r'(?m)^(?=\d{2}:\d{2}:\d{2}\.\d+ IP )', txt)
for p in pkts:
    if '192.168.1.63' in p:
        first = p.split('\n')[0]
        m = re.match(r'(\S+ \S+) IP (\S+) > (\S+)', first)
        if m:
            print(f"src={m.group(2)} dst={m.group(3)}  时间={m.group(1)}")
EOF
rm -f /tmp/cap.pcap /tmp/cap2.txt
