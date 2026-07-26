# 测试设备上报API
$reportData = @{
    gateway_ip = "192.168.1.100"
    gateway_name = "温室1号网关"
    area = "温室1号区域"
    nodes = @(
        @{
            node_id = "T-1-001"
            name = "空气温度传感器"
            type = "temperature"
            value = 25.5
            unit = "℃"
            location = "温室中部"
        },
        @{
            node_id = "H-1-001"
            name = "空气湿度传感器"
            type = "humidity"
            value = 65.2
            unit = "%"
            location = "温室中部"
        },
        @{
            node_id = "M-1-001"
            name = "通风电机"
            type = "motor"
            state = "on"
            mode = "manual"
            control_value = 60
            control_type = "integer"
            control_range = @{
                min = 0
                max = 100
                step = 1
                default = 0
            }
            location = "温室顶部"
        },
        @{
            node_id = "S-1-001"
            name = "遮阳舵机"
            type = "servo"
            state = "on"
            mode = "auto"
            control_value = 90
            control_type = "angle"
            control_range = @{
                min = 0
                max = 180
                step = 1
                default = 90
            }
            location = "温室顶部"
        },
        @{
            node_id = "L-1-001"
            name = "LED补光灯"
            type = "light"
            state = "off"
            mode = "manual"
            control_type = "boolean"
            location = "温室内部"
        }
    )
}

Write-Host "=== 测试设备上报API ==="
$jsonData = $reportData | ConvertTo-Json -Depth 10
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/device/report" -Method POST -Body $jsonData -ContentType "application/json"
Write-Host "响应状态: $($response.success)"
Write-Host "响应消息: $($response.message)"
Write-Host "同步设备: $($response.synced_nodes.Count) 个"
$response.synced_nodes | ForEach-Object {
    Write-Host "  - $($_.type) [$($_.id)]: $($_.name) -> $($_.category)"
}

Write-Host ""
Write-Host "=== 测试执行器列表API ==="
$actuators = Invoke-RestMethod -Uri "http://localhost:3000/api/actuators" -Method GET
Write-Host "执行器总数: $($actuators.total)"
$actuators.data | ForEach-Object {
    Write-Host "  - $($_.name) [$($_.id)]"
    Write-Host "    类型: $($_.type) | 控制类型: $($_.control_type)"
    Write-Host "    状态: $($_.state) | 控制值: $($_.control_value)"
    Write-Host "    区域: $($_.area) | 位置: $($_.location)"
}

Write-Host ""
Write-Host "=== 测试传感器列表API ==="
$sensors = Invoke-RestMethod -Uri "http://localhost:3000/api/sensors" -Method GET
Write-Host "传感器总数: $($sensors.total)"
$sensors.data | ForEach-Object {
    Write-Host "  - $($_.name) [$($_.id)]"
    Write-Host "    类型: $($_.type) | 值: $($_.value) $($_.unit)"
    Write-Host "    区域: $($_.area) | 位置: $($_.location)"
}

Write-Host ""
Write-Host "=== 测试完成 ==="