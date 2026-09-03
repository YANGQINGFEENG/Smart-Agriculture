#!/bin/bash
IF=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<NF;i++) if($i=="dev"){print $(i+1); exit}}')
echo "抓包接口: $IF, 时长 70 秒..."
timeout 70 tcpdump -i "$IF" -s 0 -A 'tcp port 3000 and tcp[tcpflags] & tcp-push != 0' > /tmp/cap3.txt 2>/dev/null
echo "总行数: $(wc -l < /tmp/cap3.txt)"
echo "=== 含 192.168.1.63 的报文及其来源(取报文头) ==="
grep -a -B2 '192.168.1.63' /tmp/cap3.txt | grep -aoE '[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+ IP [0-9.]+\.[0-9]+ > [0-9.]+\.[0-9]+' | sort | uniq -c
echo "=== 对照：所有 /api/device/report 请求来源分布 ==="
grep -a -B3 'api/device/report' /tmp/cap3.txt | grep -aoE 'IP [0-9.]+\.[0-9]+ > [0-9.]+\.[0-9]+' | sort | uniq -c | head -10
cp /tmp/cap3.txt /root/cap3-backup.txt
rm -f /tmp/cap3.txt
