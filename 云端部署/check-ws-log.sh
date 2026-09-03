#!/bin/bash
echo "=== WS 日志中的注册/连接记录 ==="
grep -aiE "register|gateway|connect" /root/.pm2/logs/smart-agri-ws-out-1.log | tail -20
echo "=== WS 错误日志尾部 ==="
tail -20 /root/.pm2/logs/smart-agri-ws-error-1.log
echo "=== WS 日志大小 ==="
ls -la /root/.pm2/logs/ | grep ws
