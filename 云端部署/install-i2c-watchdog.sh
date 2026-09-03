#!/bin/bash
set -e
echo "[1/4] 安装脚本和服务单元..."
install -m 755 /tmp/i2c-watchdog.sh /usr/local/bin/i2c-watchdog.sh
install -m 644 /tmp/i2c-watchdog.service /etc/systemd/system/i2c-watchdog.service
echo "[2/4] 重载 systemd 并启动..."
systemctl daemon-reload
systemctl enable --now i2c-watchdog.service
sleep 2
echo "[3/4] 服务状态："
systemctl is-active i2c-watchdog.service
echo "[4/4] 初始日志："
cat /var/log/i2c-watchdog.log
echo "=== 验证：pinctrl/i2cget 路径检查 ==="
ls -la /usr/bin/pinctrl /usr/sbin/i2cget

# 配置日志轮转
cat > /etc/logrotate.d/i2c-watchdog << 'EOF'
/var/log/i2c-watchdog.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF
