# 测试激光控制器自动恢复功能
# 步骤：
# 1. 删除现有的激光控制器（如果存在）
# 2. 上报包含激光控制器的硬件数据
# 3. 检查激光控制器是否被自动重建

$baseUrl = "http://localhost:3000"

Write-Host "=== 测试激光控制器自动恢复功能 ===" -ForegroundColor Cyan

# 步骤1: 查询现有的激光控制器
Write-Host "`n[步骤1] 查询现有的激光控制器..." -ForegroundColor Yellow
try {
    $actuators = Invoke-RestMethod -Uri "$baseUrl/api/actuators" -Method GET
    $laserActuators = $actuators.data | Where-Object { $_.type -eq "laser" }
    
    if ($laserActuators) {
        Write-Host "找到现有激光控制器:" -ForegroundColor Green
        $laserActuators | ForEach-Object {
            Write-Host "  ID: $($_.id), 名称: $($_.name), 状态: $($_.state)"
        }
        
        # 删除所有激光控制器
        Write-Host "`n删除所有激光控制器..." -ForegroundColor Red
        foreach ($actuator in $laserActuators) {
            Invoke-RestMethod -Uri "$baseUrl/api/actuators/$($actuator.id)" -Method DELETE
            Write-Host "  已删除: $($actuator.id)"
        }
    } else {
        Write-Host "没有现有的激光控制器" -ForegroundColor Gray
    }
} catch {
    Write-Host "查询失败: $_" -ForegroundColor Red
}

# 步骤2: 上报包含激光控制器的硬件数据
Write-Host "`n[步骤2] 上报包含激光控制器的硬件数据..." -ForegroundColor Yellow
$body = @{
    gateway_ip = "192.168.1.100"
    gateway_type = "lorawan_gateway"
    mac = "AA:BB:CC:DD:EE:FF"
    farm_id = 1
    nodes = @(
        @{
            node_id = "LS-001"
            type = "laser"
            state = "off"
            mode = "auto"
            control_value = 0
            control_type = "boolean"
            location = "激光器-测试"
            area = "测试区域"
        }
    )
}

$jsonBody = $body | ConvertTo-Json -Depth 5
try {
    $reportResult = Invoke-RestMethod -Uri "$baseUrl/api/device/report" -Method POST -ContentType "application/json" -Body $jsonBody
    Write-Host "上报结果:" -ForegroundColor Green
    Write-Host "  成功: $($reportResult.success)"
    Write-Host "  消息: $($reportResult.message)"
    Write-Host "  处理节点数: $($reportResult.total_nodes)"
    Write-Host "  成功数: $($reportResult.success_count)"
} catch {
    Write-Host "上报失败: $_" -ForegroundColor Red
    Write-Host "请确认服务器正在运行: $baseUrl" -ForegroundColor Yellow
    exit 1
}

# 步骤3: 检查激光控制器是否被自动重建
Write-Host "`n[步骤3] 检查激光控制器是否被自动重建..." -ForegroundColor Yellow
Start-Sleep -Seconds 1  # 等待1秒让数据同步

try {
    $actuators = Invoke-RestMethod -Uri "$baseUrl/api/actuators" -Method GET
    $laserActuators = $actuators.data | Where-Object { $_.type -eq "laser" }
    
    if ($laserActuators -and $laserActuators.Count -gt 0) {
        Write-Host "`n✓ 测试通过！激光控制器已被自动重建" -ForegroundColor Green
        Write-Host "找到 $($laserActuators.Count) 个激光控制器:" -ForegroundColor Green
        $laserActuators | ForEach-Object {
            Write-Host "  ID: $($_.id), 名称: $($_.name), 状态: $($_.state), 控制类型: $($_.control_type)"
        }
    } else {
        Write-Host "`n✗ 测试失败！激光控制器未被重建" -ForegroundColor Red
        Write-Host "可能的原因:" -ForegroundColor Yellow
        Write-Host "  1. actuator_types 表中缺少 laser 类型记录"
        Write-Host "  2. device-sync.ts 同步逻辑有问题"
        Write-Host "  3. 硬件上报数据格式不正确"
    }
} catch {
    Write-Host "查询失败: $_" -ForegroundColor Red
}

# 步骤4: 检查数据库中的执行器类型
Write-Host "`n[步骤4] 检查执行器类型表..." -ForegroundColor Yellow
try {
    $allActuators = Invoke-RestMethod -Uri "$baseUrl/api/actuators" -Method GET
    Write-Host "当前所有执行器类型:" -ForegroundColor Cyan
    $types = $allActuators.data | Select-Object -ExpandProperty type -Unique
    if ($types) {
        $types | ForEach-Object { Write-Host "  - $_" }
    } else {
        Write-Host "  (无执行器)" -ForegroundColor Gray
    }
} catch {
    Write-Host "查询失败: $_" -ForegroundColor Red
}

Write-Host "`n=== 测试完成 ===" -ForegroundColor Cyan