#!/bin/bash
# ============================================================
# 天工慧眼 - 云服务器环境一键安装脚本
# 适用系统: Ubuntu 22.04 LTS (阿里云 ECS / 腾讯云 CVM)
# 用法: 在服务器上执行  bash server-init.sh
# ============================================================
set -e

echo "===== [1/5] 系统基础更新 ====="
apt update && apt upgrade -y
apt install -y curl git ufw

echo "===== [2/5] 安装 Node.js 20 ====="
if command -v node >/dev/null 2>&1; then
  echo "Node.js 已安装: $(node -v)"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
node -v
npm -v

echo "===== [3/5] 安装 PM2 进程守护 ====="
npm config set registry https://registry.npmmirror.com
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
pm2 -v

echo "===== [4/5] 安装 MySQL 8.0 ====="
if command -v mysql >/dev/null 2>&1; then
  echo "MySQL 已安装: $(mysql --version)"
else
  # 非交互式设置 root 密码（部署后请按 README 指引改为强密码）
  debconf-set-selections <<< "mysql-server mysql-server/root_password password CloudMysql@2026"
  debconf-set-selections <<< "mysql-server mysql-server/root_password_again password CloudMysql@2026"
  apt install -y mysql-server
fi
systemctl enable mysql
systemctl start mysql
mysql --version

echo "===== [5/5] 配置防火墙（仅放行 SSH/3000/8080） ====="
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 8080/tcp
ufw --force enable
ufw status verbose

echo ""
echo "=========================================="
echo "  环境安装完成！"
echo "  注意：云厂商安全组需另行开放 22/3000/8080"
echo "  下一步：按 README.md 执行数据导入与应用部署"
echo "=========================================="
