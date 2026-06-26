#!/usr/bin/env pwsh

Write-Host "==========================================" -ForegroundColor Green
Write-Host "   Smart Agriculture Platform Service Starter" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Check if Ollama is installed
$ollamaPath = "C:\Users\lenovo\AppData\Local\Programs\Ollama\ollama.exe"
if (Test-Path $ollamaPath) {
    Write-Host "Ollama found, checking if server is already running..." -ForegroundColor Cyan
    
    # Check if Ollama port is in use
    $ollamaPortInUse = $false
    try {
        $socket = New-Object System.Net.Sockets.TcpClient('localhost', 11434)
        $socket.Close()
        $ollamaPortInUse = $true
        Write-Host "Ollama port 11434 is in use, checking for existing Ollama process..." -ForegroundColor Yellow
        
        # Find and kill existing Ollama process
        $ollamaProcesses = Get-Process | Where-Object { $_.ProcessName -eq 'ollama' }
        if ($ollamaProcesses) {
            Write-Host "Found existing Ollama process, stopping it..." -ForegroundColor Yellow
            $ollamaProcesses | ForEach-Object { $_.Kill() }
            Start-Sleep -Seconds 2
        }
    } catch {
        # Port is not in use, continue
    }
    
    # Start Ollama server
    Write-Host "Starting Ollama server..." -ForegroundColor Cyan
    Start-Process -FilePath $ollamaPath -ArgumentList "serve" -NoNewWindow -PassThru
    
    # Wait for Ollama to start
    Write-Host "Waiting for Ollama server to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
} else {
    Write-Host "Ollama not found, skipping Ollama server startup" -ForegroundColor Red
}

# Start inference service
Write-Host ""
Write-Host "Starting inference service..." -ForegroundColor Cyan

# Check if inference service port is in use
$inferencePortInUse = $false
try {
    $socket = New-Object System.Net.Sockets.TcpClient('localhost', 5000)
    $socket.Close()
    $inferencePortInUse = $true
    Write-Host "Inference service port 5000 is in use, checking for existing Python process..." -ForegroundColor Yellow
    
    # Find and kill existing Python process running inference service
    $pythonProcesses = Get-Process | Where-Object { $_.ProcessName -eq 'python' }
    if ($pythonProcesses) {
        Write-Host "Found existing Python processes, stopping them..." -ForegroundColor Yellow
        $pythonProcesses | ForEach-Object { $_.Kill() }
        Start-Sleep -Seconds 2
    }
} catch {
    # Port is not in use, continue
}

$inferenceScript = "$PSScriptRoot\start-inference-service.ps1"

# Create inference service startup script
@'
#!/usr/bin/env pwsh

Write-Host "Starting inference service..." -ForegroundColor Cyan

# Change to inference service directory
Set-Location "$PSScriptRoot\inference-service"

# Start inference service
python app.py
'@ | Out-File -FilePath $inferenceScript -Force

# Start inference service
Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -File $inferenceScript" -NoNewWindow -PassThru

# Wait for inference service to start
Write-Host "Waiting for inference service to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start Next.js development server
Write-Host ""
Write-Host "Starting Next.js development server..." -ForegroundColor Cyan

# Change to project root directory
Set-Location $PSScriptRoot

# Check if port 3000 is in use
$portInUse = $false
try {
    $socket = New-Object System.Net.Sockets.TcpClient("localhost", 3000)
    $socket.Close()
    $portInUse = $true
    Write-Host "Port 3000 is in use, checking for existing Next.js process..." -ForegroundColor Yellow
    
    # Find and kill existing Next.js process
    $nextProcesses = Get-Process | Where-Object { $_.ProcessName -like "node" }
    if ($nextProcesses) {
        Write-Host "Found existing Node.js processes, stopping them..." -ForegroundColor Yellow
        $nextProcesses | ForEach-Object { $_.Kill() }
        Start-Sleep -Seconds 2
    }
} catch {
    # Port is not in use, continue
}

# Start development server
Write-Host "Starting Next.js development server..." -ForegroundColor Cyan
npm run dev
