# Turbopack 构建后修复 chunk 文件名中的连续点（含 ".." 的 URL 会被规范化，云端取资源 308/404）
# 策略：
#   1) 文件名中的 ".." 替换为 "--"，但保留扩展名前的那个点（abc..js -> abc--.js）
#   2) 引用替换覆盖所有非二进制文件（含 .rsc / .html / .js / .map / .json）
#      —— 早期版本只按扩展名白名单处理，漏掉 .rsc 导致客户端导航 404、页面报 "This page couldn't load"
#   3) 结束后务必再跑一次 fix-stale-refs.ps1 做兜底校验（幂等）
$root = "e:\tghy\smart-agriculture\.next"
$binaryExt = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
    '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.zip', '.gz', '.tar',
    '.mp4', '.webm', '.wasm', '.pt', '.bin', '.db', '.sqlite', '.xlsx')

function New-ChunkName([string]$name) {
    $m = [regex]::Match($name, "\.([A-Za-z0-9]+)$")
    if (-not $m.Success) { return $name.Replace("..", "--") }
    $ext = $m.Value
    $base = $name.Substring(0, $name.Length - $ext.Length)
    $base = $base.Replace("..", "--")
    if ($base.EndsWith(".")) { $base = $base.TrimEnd('.') + "--" }
    return "$base$ext"
}

# 1) 重命名（Move-Item -LiteralPath 对含点/方括号的名字更可靠）
$pairs = @()
foreach ($f in (Get-ChildItem $root -Recurse -File | Where-Object { $_.Name -match '\.\.' })) {
    $newName = New-ChunkName $f.Name
    if ($newName -ne $f.Name) {
        $pairs += , @($f.Name, $newName)
        Move-Item -LiteralPath $f.FullName -Destination (Join-Path $f.DirectoryName $newName) -Force
        Write-Host "RENAME: $($f.Name) -> $newName"
    }
}
Write-Host "TOTAL_RENAMED: $($pairs.Count)"

# 2) 全 .next 引用替换：按旧文件名精确替换（长名优先，避免前缀覆盖）
$textFiles = @(Get-ChildItem $root -Recurse -File | Where-Object { $binaryExt -notcontains $_.Extension.ToLower() })
$pairsSorted = $pairs | Sort-Object { $_[0].Length } -Descending
$patched = 0
foreach ($f in $textFiles) {
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($f.FullName))
    $orig = $text
    foreach ($p in $pairsSorted) { $text = $text.Replace($p[0], $p[1]) }
    if ($text -ne $orig) {
        [System.IO.File]::WriteAllBytes($f.FullName, [System.Text.Encoding]::UTF8.GetBytes($text))
        $patched++
    }
}
Write-Host "TOTAL_PATCHED_FILES: $patched (扫描 $($textFiles.Count) 个文本文件)"

# 3) 校验：不应再有含连续点的文件名，也不应再有指向旧名的引用
$remainNames = @(Get-ChildItem $root -Recurse -File | Where-Object { $_.Name -match '\.\.' }).Count
$remainRefs = 0
foreach ($f in (Get-ChildItem $root -Recurse -File | Where-Object { $binaryExt -notcontains $_.Extension.ToLower() })) {
    $t = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($f.FullName))
    foreach ($p in $pairsSorted) { if ($t.Contains($p[0])) { $remainRefs++ } }
}
Write-Host "REMAINING_DOT_NAMES: $remainNames"
Write-Host "REMAINING_DOT_REFS: $remainRefs"
Write-Host "FIX_CHUNK_NAMES_DONE"
