# Test Device Report API
$reportData = @{
    gateway_ip = "192.168.1.100"
    gateway_name = "Greenhouse-Gateway-001"
    gateway_type = "wifi_sensor"
    farm_id = 1
    area = "Greenhouse-Zone-A"
    nodes = @(
        @{
            node_id = "T-1-001"
            name = "Air-Temp-Sensor"
            type = "temperature"
            value = 25.5
            unit = "C"
            location = "Center"
        },
        @{
            node_id = "H-1-001"
            name = "Air-Humidity-Sensor"
            type = "humidity"
            value = 65.2
            unit = "%"
            location = "Center"
        },
        @{
            node_id = "M-1-001"
            name = "Vent-Motor"
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
            location = "Top"
        },
        @{
            node_id = "S-1-001"
            name = "Sun-Shield-Servo"
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
            location = "Top"
        },
        @{
            node_id = "L-1-001"
            name = "LED-Light"
            type = "light"
            state = "off"
            mode = "manual"
            control_type = "boolean"
            location = "Inside"
        }
    )
}

Write-Host "=== Test Device Report API ==="
$jsonData = $reportData | ConvertTo-Json -Depth 10
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/device/report" -Method POST -Body $jsonData -ContentType "application/json"
Write-Host "Success: $($response.success)"
Write-Host "Message: $($response.message)"
Write-Host "Synced Nodes: $($response.synced_nodes.Count)"
$response.synced_nodes | ForEach-Object {
    Write-Host "  - $($_.type) [$($_.id)]: $($_.name) -> $($_.category)"
}

Write-Host ""
Write-Host "=== Test Actuators API ==="
$actuators = Invoke-RestMethod -Uri "http://localhost:3000/api/actuators" -Method GET
Write-Host "Total Actuators: $($actuators.total)"
$actuators.data | ForEach-Object {
    Write-Host "  - $($_.name) [$($_.id)]"
    Write-Host "    Type: $($_.type) | ControlType: $($_.control_type)"
    Write-Host "    State: $($_.state) | ControlValue: $($_.control_value)"
    Write-Host "    Area: $($_.area) | Location: $($_.location)"
}

Write-Host ""
Write-Host "=== Test Sensors API ==="
$sensors = Invoke-RestMethod -Uri "http://localhost:3000/api/sensors" -Method GET
Write-Host "Total Sensors: $($sensors.total)"
$sensors.data | ForEach-Object {
    Write-Host "  - $($_.name) [$($_.id)]"
    Write-Host "    Type: $($_.type) | Value: $($_.value) $($_.unit)"
    Write-Host "    Area: $($_.area) | Location: $($_.location)"
}

Write-Host ""
Write-Host "=== Test Complete ==="