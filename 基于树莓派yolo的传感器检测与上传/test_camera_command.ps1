# Camera Control Command Test Script
# Send commands to hardware (CAM-1-001) via server API
# Usage:
#   .\test_camera_command.ps1                 # Interactive menu
#   .\test_camera_command.ps1 -Action on      # Single action
#   .\test_camera_command.ps1 -RunAll         # Run all test cases

param(
    [string]$Server = "http://192.168.1.22:3000",
    [string]$NodeId  = "CAM-1-001",
    [string]$Action,
    [string]$Value,
    [string]$Color = "red",
    [string]$Pan  = "90",
    [string]$Tilt = "90",
    [int]   $WaitSec = 3,
    [switch]$RunAll
)

function Write-Info($msg) { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[ OK ]  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[FAIL]  $msg" -ForegroundColor Red }

function Send-CameraCommand {
    param(
        [string]$Command,
        $Value = $null
    )
    $body = @{
        control_type = "string"
        command      = $Command
    }
    if ($null -ne $Value) { $body["value"] = $Value }

    $json = $body | ConvertTo-Json -Compress
    Write-Info "POST $Server/api/actuators/$NodeId/commands  body=$json"

    try {
        $resp = Invoke-RestMethod -Uri "$Server/api/actuators/$NodeId/commands" `
                                  -Method Post `
                                  -ContentType "application/json" `
                                  -Body $json `
                                  -TimeoutSec 5
        if ($resp.success) {
            Write-Ok "Server accepted: id=$($resp.data.id), status=$($resp.data.status)"
            return $true
        } else {
            Write-Err "Server returned failure: $($resp | ConvertTo-Json -Compress)"
            return $false
        }
    } catch {
        Write-Err "Request error: $($_.Exception.Message)"
        return $false
    }
}

function Get-LastCommandStatus {
    Write-Info "Query last command status for $NodeId ..."
    try {
        $resp = Invoke-RestMethod -Uri "$Server/api/actuators/$NodeId/commands" `
                                  -Method Get `
                                  -TimeoutSec 5
        if ($resp.success -and $resp.data) {
            Write-Host ("       latest: id={0}, command={1}, control_value={2}, status={3}" `
                        -f $resp.data.id, $resp.data.command, $resp.data.control_value, $resp.data.status) `
                        -ForegroundColor Gray
        } else {
            Write-Warn "No pending command"
        }
    } catch {
        Write-Warn "Query failed: $($_.Exception.Message)"
    }
}

function Get-TestCases {
    return @(
        @{ Name = "Camera ON";                 Command = "on";    Value = $null }
        @{ Name = "Pan-tilt reset";            Command = "reset"; Value = $null }
        @{ Name = "Move absolute (90,90)";     Command = "value"; Value = "pan=90,tilt=90" }
        @{ Name = "Move absolute (45,60)";     Command = "value"; Value = "pan=45,tilt=60" }
        @{ Name = "Move absolute (135,120)";   Command = "value"; Value = "pan=135,tilt=120" }
        @{ Name = "Move delta (-10,+5)";       Command = "value"; Value = "pan_delta=-10,tilt_delta=5" }
        @{ Name = "Tracking ON";               Command = "track"; Value = "on" }
        @{ Name = "Color blue";                Command = "color"; Value = "blue" }
        @{ Name = "Color red";                 Command = "color"; Value = "red" }
        @{ Name = "Color green";               Command = "color"; Value = "green" }
        @{ Name = "Color yellow";              Command = "color"; Value = "yellow" }
        @{ Name = "Color orange";              Command = "color"; Value = "orange" }
        @{ Name = "Tracking OFF";              Command = "track"; Value = "off" }
        @{ Name = "Camera OFF";                Command = "off";   Value = $null }
    )
}

function Invoke-Action {
    param([string]$Act, [string]$Val)

    switch ($Act.ToLower()) {
        "on"         { Send-CameraCommand -Command "on" }
        "off"        { Send-CameraCommand -Command "off" }
        "reset"      { Send-CameraCommand -Command "reset" }
        "track_on"   { Send-CameraCommand -Command "track" -Value "on" }
        "track_off"  { Send-CameraCommand -Command "track" -Value "off" }
        "color"      { Send-CameraCommand -Command "color" -Value $Val }
        "value"      { Send-CameraCommand -Command "value" -Value $Val }
        "move"       { Send-CameraCommand -Command "value" -Value "pan=$Val,tilt=$Tilt" }
        "move_delta" { Send-CameraCommand -Command "value" -Value "pan_delta=$Val,tilt_delta=$Tilt" }
        default      { Write-Err "Unknown action: $Act"; return $false }
    }
}

function Show-Menu {
    while ($true) {
        Write-Host ""
        Write-Host "===== Camera Control Test Menu =====" -ForegroundColor Cyan
        Write-Host " 1) Camera ON"
        Write-Host " 2) Camera OFF"
        Write-Host " 3) Pan-tilt reset (90,90)"
        Write-Host " 4) Move absolute (pan=,tilt=)"
        Write-Host " 5) Move delta (pan_delta=,tilt_delta=)"
        Write-Host " 6) Tracking ON"
        Write-Host " 7) Tracking OFF"
        Write-Host " 8) Switch color (red/blue/green/yellow/orange)"
        Write-Host " 9) Query last command status"
        Write-Host " A) Run all test cases"
        Write-Host " Q) Quit"
        $choice = Read-Host "Select"

        switch ($choice.ToUpper()) {
            "1" { Send-CameraCommand -Command "on";    Start-Sleep -Seconds $WaitSec }
            "2" { Send-CameraCommand -Command "off";   Start-Sleep -Seconds $WaitSec }
            "3" { Send-CameraCommand -Command "reset"; Start-Sleep -Seconds $WaitSec }
            "4" {
                $p = Read-Host "pan  (default 90)"
                $t = Read-Host "tilt (default 90)"
                if (-not $p) { $p = "90" }
                if (-not $t) { $t = "90" }
                Send-CameraCommand -Command "value" -Value "pan=$p,tilt=$t"
                Start-Sleep -Seconds $WaitSec
            }
            "5" {
                $p = Read-Host "pan_delta  (default 0)"
                $t = Read-Host "tilt_delta (default 0)"
                if (-not $p) { $p = "0" }
                if (-not $t) { $t = "0" }
                Send-CameraCommand -Command "value" -Value "pan_delta=$p,tilt_delta=$t"
                Start-Sleep -Seconds $WaitSec
            }
            "6" { Send-CameraCommand -Command "track" -Value "on";  Start-Sleep -Seconds $WaitSec }
            "7" { Send-CameraCommand -Command "track" -Value "off"; Start-Sleep -Seconds $WaitSec }
            "8" {
                $c = Read-Host "color (red/blue/green/yellow/orange)"
                if (-not $c) { $c = "red" }
                Send-CameraCommand -Command "color" -Value $c
                Start-Sleep -Seconds $WaitSec
            }
            "9" { Get-LastCommandStatus }
            "A" { Invoke-AllTests }
            "Q" { return }
            default { Write-Warn "Invalid choice" }
        }
    }
}

function Invoke-AllTests {
    $cases = Get-TestCases
    Write-Host ""
    Write-Info "Running $($cases.Count) test cases sequentially..."
    $i = 0
    foreach ($case in $cases) {
        $i++
        Write-Host ""
        Write-Host "[$i/$($cases.Count)] $($case.Name)" -ForegroundColor Cyan
        Send-CameraCommand -Command $case.Command -Value $case.Value | Out-Null
        Start-Sleep -Seconds $WaitSec
    }
    Write-Host ""
    Write-Ok "All test cases completed"
}

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " Camera Control Command Test" -ForegroundColor Cyan
Write-Host "   Server: $Server" -ForegroundColor Gray
Write-Host "   NodeId: $NodeId" -ForegroundColor Gray
Write-Host "===========================================" -ForegroundColor Cyan

if ($Action) {
    Invoke-Action -Act $Action -Val $Value
    Start-Sleep -Seconds $WaitSec
    Get-LastCommandStatus
    return
}

if ($RunAll) {
    Invoke-AllTests
    return
}

Show-Menu
