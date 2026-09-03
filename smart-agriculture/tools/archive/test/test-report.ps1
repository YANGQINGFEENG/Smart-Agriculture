$body = @{
    gateway_ip = "192.168.1.100"
    gateway_type = "lorawan_gateway"
    mac = "AA:BB:CC:DD:EE:FF"
    farm_id = 1
    nodes = @(
        @{
            node_id = "VL-1-001"
            type = "relay"
            state = "off"
            mode = "auto"
            control_value = 0
            control_type = "boolean"
            location = "继电器"
            area = "区域-192.168.1.100"
        },
        @{
            node_id = "LT-1-001"
            type = "laser"
            state = "off"
            mode = "auto"
            control_value = 0
            control_type = "integer"
            control_range = @{ min = 0; max = 100; step = 10; default = 0 }
            location = "激光器"
            area = "区域-192.168.1.100"
        },
        @{
            node_id = "LT-1-002"
            type = "rgb_led"
            state = "off"
            mode = "auto"
            control_value = 0
            control_type = "integer"
            control_range = @{ min = 0; max = 16777215; step = 1; default = 0 }
            location = "RGB-LED"
            area = "区域-192.168.1.100"
        }
    )
}

$jsonBody = $body | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "http://localhost:3000/api/device/report" -Method POST -ContentType "application/json" -Body $jsonBody | ConvertTo-Json