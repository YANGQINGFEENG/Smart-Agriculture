#!/bin/bash
# 云端部署辅助步骤：swap + 校验 + MySQL root 密码设置
set -e

echo "=== node/pm2 版本 ==="
node -v
pm2 -v

echo "=== 配置 2G swap ==="
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | grep -i swap

echo "=== 设置 MySQL root 密码（兼容 auth_socket） ==="
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'CloudMysql@2026'; FLUSH PRIVILEGES;"
mysql -u root -p'CloudMysql@2026' -e "SELECT 'mysql-root-auth-ok';"

echo "=== 完成 ==="
