#!/bin/bash
# 在树莓派上抓自己发出的 report 报文，看 stream_url 实际值
timeout 70 tcpdump -i wlan0 -s 0 -A 'dst port 3000 and tcp[tcpflags] & tcp-push != 0' > /tmp/pi-cap.txt 2>/dev/null
echo -n "10.248.88.186 出现: "; grep -ac '10.248.88.186' /tmp/pi-cap.txt
echo -n "192.168.1.63 出现: "; grep -ac '192.168.1.63' /tmp/pi-cap.txt
echo -n "stream_url 出现: "; grep -ac 'stream_url' /tmp/pi-cap.txt
echo "=== stream_url 实际值 ==="
grep -a -o 'stream_url[^,]*' /tmp/pi-cap.txt | head -5
echo "=== POST 路径统计 ==="
grep -aoE 'POST /[a-z/-]+' /tmp/pi-cap.txt | sort | uniq -c
cp /tmp/pi-cap.txt /tmp/pi-cap-backup.txt; rm -f /tmp/pi-cap.txt
