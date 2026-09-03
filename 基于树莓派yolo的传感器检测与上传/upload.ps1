# 上传修改后的文件到树莓派
# 使用方法: 直接运行此脚本，或在命令行指定文件路径
# 示例: .\upload.ps1
#       .\upload.ps1 -FilePath "app\system.py"

param(
    [string]$FilePath = "app\system.py"
)

$scpExe = "C:\Windows\System32\OpenSSH\scp.exe"
$sourceBase = "e:\tghy\基于树莓派yolo的传感器检测与上传"
$destBase = "pi@raspberrypi:/home/pi/smart-farm"

$source = Join-Path $sourceBase $FilePath
$dest = "$destBase/$FilePath"

if (-not (Test-Path $source)) {
    Write-Error "源文件不存在: $source"
    exit 1
}

Write-Host "正在上传: $source -> $dest"
& $scpExe $source $dest

if ($LASTEXITCODE -eq 0) {
    Write-Host "上传成功: $FilePath" -ForegroundColor Green
} else {
    Write-Error "上传失败: $FilePath (exit code: $LASTEXITCODE)"
}
