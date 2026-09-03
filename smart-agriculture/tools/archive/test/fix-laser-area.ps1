# 修复激光控制器区域编码问题
$body = @'
{
    "gateway_ip": "192.168.1.200",
    "gateway_type": "lorawan_gateway",
    "mac": "AA:BB:CC:DD:EE:FF",
    "farm_id": 1,
    "area": "温室1号区域",
    "nodes": [
        {
            "node_id": "LS-3-T001",
            "type": "laser",
            "state": "off",
            "mode": "auto",
            "control_value": 0,
            "control_type": "boolean",
            "control_range": {"min": 0, "max": 100, "step": 1, "default": 0},
            "location": "激光器-测试",
            "area": "温室1号区域"
        }
    ]
}
'@

try {
    # 使用UTF-8编码发送请求
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/device/report" -Method Post -Body $body -ContentType "application/json; charset=utf-8"
    Write-Host "上报成功:"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}

# 验证数据是否正确保存
Start-Sleep -Seconds 1
Write-Host "`n验证执行器数据:"
$verify = Invoke-RestMethod -Uri "http://localhost:3000/api/actuators" -Method Get
$verify.data | ForEach-Object {
    Write-Host "ID: $($_.id), Name: $($_.name), Area: $($_.area), Type: $($_.type)"
}