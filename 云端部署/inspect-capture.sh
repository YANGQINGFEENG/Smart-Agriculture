#!/bin/bash
F=/root/cap3-backup.txt
echo "=== gateway_ip 取值分布 ==="
grep -aoE 'gateway_ip..[: ]*[0-9.]+' $F | sort | uniq -c
echo "=== mac 取值分布 ==="
grep -aoE 'mac...[: ]*[0-9A-Fa-f:]{17}' $F | sort | uniq -c
echo "=== 节点特征计数 ==="
echo -n "T-7-171C: "; grep -ac 'T-7-171C' $F
echo -n "T-2-R001: "; grep -ac 'T-2-R001' $F
echo -n "192.168.1.63: "; grep -ac '192.168.1.63' $F
echo -n "10.248.88.186: "; grep -ac '10.248.88.186' $F
echo "=== report 请求的完整 body 行(截前300字符) ==="
grep -a -A6 'POST /api/device/report' $F | grep -a 'gateway_ip' | cut -c1-300
