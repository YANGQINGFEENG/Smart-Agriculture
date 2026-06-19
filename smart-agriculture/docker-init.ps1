param(
    [switch]$BuildOnly,
    [switch]$StartOnly,
    [switch]$Full
)

$ProjectDir = "e:\tghy\smart-agriculture"

if (-not $StartOnly) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  智慧农业平台 Docker 容器化部署脚本" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "`n[1/4] 更新Docker镜像源..." -ForegroundColor Yellow
    $daemonJson = @"
{
  "experimental": false,
  "features": {
    "buildkit": true
  },
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.m.daocloud.io",
    "https://docker.xuanyuan.me"
  ]
}
"@
    $daemonJson | Set-Content -Path "$env:USERPROFILE\.docker\daemon.json" -Encoding UTF8
    Write-Host "  Docker镜像源已更新，请重启Docker Desktop" -ForegroundColor Green

    Write-Host "`n[2/4] 安装Node.js依赖..." -ForegroundColor Yellow
    Set-Location $ProjectDir
    npm ci
    Write-Host "  依赖安装完成" -ForegroundColor Green

    Write-Host "`n[3/4] 构建Next.js项目..." -ForegroundColor Yellow
    npx next build
    Write-Host "  项目构建完成" -ForegroundColor Green

    Write-Host "`n[4/4] 构建Docker镜像..." -ForegroundColor Yellow
    docker build -t smart-agri-app $ProjectDir
    Write-Host "  Docker镜像构建完成" -ForegroundColor Green
}

if (-not $BuildOnly) {
    Write-Host "`n正在启动所有服务..." -ForegroundColor Yellow
    docker compose -f "$ProjectDir\docker-compose.yml" --env-file "$ProjectDir\.env.docker" up -d
    Write-Host "`n所有服务已启动！" -ForegroundColor Green
    Write-Host "  - 前端应用: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  - MySQL数据库: localhost:3306" -ForegroundColor Cyan
    Write-Host "  - Ollama AI: http://localhost:11434" -ForegroundColor Cyan
    Write-Host "  - 推理服务: http://localhost:5000" -ForegroundColor Cyan
}

Write-Host "`n完成！" -ForegroundColor Green
