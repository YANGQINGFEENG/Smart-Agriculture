#!/usr/bin/env powershell
# ===================================================================
# 树莓派部署脚本 - 在 Windows PowerShell 中执行
# ===================================================================
# 用法：
#   1. 在项目根目录运行： .\deploy-to-pi.ps1
#   2. 首次执行会要求输入树莓派密码（用于配置免密登录）
#   3. 之后所有操作自动完成
# ===================================================================

param(
    [string]$PiHost = "192.168.1.63",
    [string]$PiUser = "pi",
    [string]$RemoteDir = "/home/pi/smart-farm"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  智慧农业硬件系统 - 树莓派部署脚本" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  目标主机:   $PiUser@$PiHost" -ForegroundColor Yellow
Write-Host "  部署目录:   $RemoteDir" -ForegroundColor Yellow
Write-Host "  项目路径:   $ProjectRoot" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------- 1. 检查前置条件 -------------------------
Write-Host "[1/6] 检查前置条件..." -ForegroundColor Green

if (-not (Test-Path "$ProjectRoot\deploy.zip")) {
    Write-Host "  错误: 找不到 deploy.zip，请先在项目根目录运行打包" -ForegroundColor Red
    exit 1
}

# 测试网络连通性
$ping = Test-NetConnection -ComputerName $PiHost -Port 22 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $ping) {
    Write-Host "  错误: 无法连接到 $PiHost:22，请检查：" -ForegroundColor Red
    Write-Host "    - 树莓派是否开机" -ForegroundColor Red
    Write-Host "    - IP 地址是否正确（当前: $PiHost）" -ForegroundColor Red
    Write-Host "    - 是否在同一局域网" -ForegroundColor Red
    exit 1
}
Write-Host "  网络连通: OK" -ForegroundColor Green

# 检查本地 SSH 公钥
$pubKey = $null
if (Test-Path "$env:USERPROFILE\.ssh\id_ed25519.pub") {
    $pubKey = Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
} elseif (Test-Path "$env:USERPROFILE\.ssh\id_rsa.pub") {
    $pubKey = Get-Content "$env:USERPROFILE\.ssh\id_rsa.pub"
}

if (-not $pubKey) {
    Write-Host "  未找到 SSH 公钥，正在生成..." -ForegroundColor Yellow
    ssh-keygen -t ed25519 -C "smart-farm-deploy" -f "$env:USERPROFILE\.ssh\id_ed25519" -N '""'
    $pubKey = Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
}

# ------------------------- 2. 配置免密登录 -------------------------
Write-Host ""
Write-Host "[2/6] 配置 SSH 免密登录..." -ForegroundColor Green

# 测试是否已可免密登录
$testLogin = ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no $PiUser@$PiHost "echo OK" 2>&1
if ($testLogin -match "OK") {
    Write-Host "  免密登录已配置: OK" -ForegroundColor Green
} else {
    Write-Host "  需要输入一次树莓派密码以配置免密登录..." -ForegroundColor Yellow
    Write-Host "  提示: 输入密码时屏幕不会显示任何字符，这是正常的" -ForegroundColor Yellow

    # 上传公钥到树莓派
    $pubKey | ssh -o StrictHostKeyChecking=no $PiUser@$PiHost "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

    # 再次测试
    $testLogin = ssh -o BatchMode=yes -o ConnectTimeout=5 $PiUser@$PiHost "echo OK" 2>&1
    if ($testLogin -match "OK") {
        Write-Host "  免密登录配置成功！" -ForegroundColor Green
    } else {
        Write-Host "  错误: 免密登录配置失败，请手动执行: ssh-copy-id $PiUser@$PiHost" -ForegroundColor Red
        exit 1
    }
}

# ------------------------- 3. 上传项目包 -------------------------
Write-Host ""
Write-Host "[3/6] 上传项目包到树莓派..." -ForegroundColor Green

# 在树莓派上创建部署目录
ssh $PiUser@$PiHost "mkdir -p $RemoteDir && rm -rf $RemoteDir/* $RemoteDir/.* 2>/dev/null; true"
Write-Host "  部署目录已清空: $RemoteDir" -ForegroundColor Green

# 上传 zip 包
Write-Host "  正在上传 deploy.zip (0.16 MB)..." -ForegroundColor Yellow
scp "$ProjectRoot\deploy.zip" "${PiUser}@${PiHost}:/tmp/smart-farm-deploy.zip"
Write-Host "  上传完成" -ForegroundColor Green

# ------------------------- 4. 在树莓派上解压 -------------------------
Write-Host ""
Write-Host "[4/6] 在树莓派上解压项目..." -ForegroundColor Green

ssh $PiUser@$PiHost "cd $RemoteDir && unzip -q /tmp/smart-farm-deploy.zip && rm /tmp/smart-farm-deploy.zip && ls -la $RemoteDir"
Write-Host "  解压完成" -ForegroundColor Green

# ------------------------- 5. 安装系统依赖和 Python 依赖 -------------------------
Write-Host ""
Write-Host "[5/6] 安装系统依赖和 Python 依赖..." -ForegroundColor Green
Write-Host "  这一步可能需要 5-10 分钟，请耐心等待..." -ForegroundColor Yellow

ssh $PiUser@$PiHost "sudo apt-get update -qq && sudo apt-get install -y -qq python3-pip python3-tk python3-dev python3-venv libgpiod2 i2c-tools spi-tools unzip 2>&1 | tail -5"

# 启用 I2C/SPI/1-Wire 接口
Write-Host "  启用 I2C/SPI/1-Wire 接口..." -ForegroundColor Yellow
ssh $PiUser@$PiHost "sudo raspi-config nonint do_i2c 0; sudo raspi-config nonint do_spi 0; sudo raspi-config nonint do_onewire 0; echo 'Interfaces enabled'"

# 创建虚拟环境并安装 Python 依赖
Write-Host "  创建 Python 虚拟环境并安装依赖..." -ForegroundColor Yellow
ssh $PiUser@$PiHost "cd $RemoteDir && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip -q && pip install -r requirements.txt 2>&1 | tail -10"

Write-Host "  Python 依赖安装完成" -ForegroundColor Green

# ------------------------- 6. 验证运行 -------------------------
Write-Host ""
Write-Host "[6/6] 验证项目运行..." -ForegroundColor Green

Write-Host ""
Write-Host "  系统版本信息:" -ForegroundColor Cyan
ssh $PiUser@$PiHost "cd $RemoteDir && source venv/bin/activate && python main.py version"

Write-Host ""
Write-Host "  系统状态检查:" -ForegroundColor Cyan
ssh $PiUser@$PiHost "cd $RemoteDir && source venv/bin/activate && python main.py status 2>&1 | head -50"

# ------------------------- 完成 -------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "后续操作：" -ForegroundColor Yellow
Write-Host "  1. SSH 登录树莓派:" -ForegroundColor White
Write-Host "       ssh $PiUser@$PiHost" -ForegroundColor Gray
Write-Host "  2. 进入项目目录:" -ForegroundColor White
Write-Host "       cd $RemoteDir" -ForegroundColor Gray
Write-Host "  3. 激活虚拟环境:" -ForegroundColor White
Write-Host "       source venv/bin/activate" -ForegroundColor Gray
Write-Host "  4. 启动系统（仅命令行模式）:" -ForegroundColor White
Write-Host "       python main.py start --no-ui" -ForegroundColor Gray
Write-Host "  5. 启动系统（带触摸屏 UI）:" -ForegroundColor White
Write-Host "       python main.py start" -ForegroundColor Gray
Write-Host "  6. 扫描设备:" -ForegroundColor White
Write-Host "       python main.py scan --save" -ForegroundColor Gray
Write-Host ""
Write-Host "  7. 修改服务器地址（在树莓派上）:" -ForegroundColor White
Write-Host "       python main.py config upload.server_url http://your-server:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  8. 配置 systemd 开机自启（可选）:" -ForegroundColor White
Write-Host "       sudo nano /etc/systemd/system/smart-farm.service" -ForegroundColor Gray
Write-Host "       （参考 开发计划.md 中的 systemd 配置示例）" -ForegroundColor Gray
Write-Host ""
