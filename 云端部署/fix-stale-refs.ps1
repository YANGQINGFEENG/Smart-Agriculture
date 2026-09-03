# 修复 chunk 改名后残留的失效引用（fix-chunk-names.ps1 的白名单漏掉 .rsc 等文件，
# 导致客户端导航按旧名请求 /_next/static/chunks/xxx..js 得到 404，页面报 "This page couldn't load"）
# 策略：扫描所有非二进制文件中的 chunk 引用，凡指向磁盘上不存在的名字，按改名规则归一化后替换
$root = "e:\tghy\smart-agriculture\.next"
$binaryExt = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
    '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.zip', '.gz', '.tar',
    '.mp4', '.webm', '.wasm', '.pt', '.bin', '.db', '.sqlite', '.xlsx')
$codeExt = 'js|mjs|cjs|css|json|html|txt|map|rsc|xml'
$tokenRegex = "[A-Za-z0-9_~.-]+\.($codeExt)"

$allFiles = Get-ChildItem $root -Recurse -File
$textFiles = @($allFiles | Where-Object { $binaryExt -notcontains $_.Extension.ToLower() })

# 1) 磁盘上真实存在的文件名集合
$existing = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $allFiles) { [void]$existing.Add($f.Name) }
Write-Host "FILES: $($allFiles.Count)  TEXT_FILES: $($textFiles.Count)"

# 2) 归一化：按改名规则把旧名（含连续点）换算成当前磁盘上的名字
function Normalize-Name([string]$name) {
    $m = [regex]::Match($name, "\.([A-Za-z0-9]+)$")
    if (-not $m.Success) { return $name }
    $ext = $m.Value
    $base = $name.Substring(0, $name.Length - $ext.Length)
    $base = $base.Replace("..", "--")
    if ($base.EndsWith(".")) { $base = $base.TrimEnd('.') + "--" }
    return "$base$ext"
}

# 3) 收集失效引用 -> 正确名 的映射
$fixMap = @{}
$dangling = @{}
foreach ($f in $textFiles) {
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($f.FullName))
    foreach ($m in [regex]::Matches($text, $tokenRegex)) {
        $tok = $m.Value
        if ($existing.Contains($tok)) { continue }
        if ($tok -notmatch '\.\.') { continue }   # 只处理含连续点的旧名
        if (-not $dangling.ContainsKey($tok)) { $dangling[$tok] = 0 }
        $dangling[$tok]++
        if (-not $fixMap.ContainsKey($tok)) {
            $new = Normalize-Name $tok
            if ($existing.Contains($new)) { $fixMap[$tok] = $new }
        }
    }
}
Write-Host "DANGLING_TOKENS: $($dangling.Count)  MAPPED: $($fixMap.Count)"
foreach ($k in $fixMap.Keys) { Write-Host "  MAP: $k -> $($fixMap[$k])  (出现 $($dangling[$k]) 次)" }
$unmapped = @($dangling.Keys | Where-Object { -not $fixMap.ContainsKey($_) })
foreach ($u in $unmapped) { Write-Host "  UNMAPPED: $u (出现 $($dangling[$u]) 次)" }

# 4) 执行替换
$keys = @($fixMap.Keys | Sort-Object { $_.Length } -Descending)
$patched = 0
foreach ($f in $textFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $orig = $text
    foreach ($k in $keys) { $text = $text.Replace($k, $fixMap[$k]) }
    if ($text -ne $orig) {
        [System.IO.File]::WriteAllBytes($f.FullName, [System.Text.Encoding]::UTF8.GetBytes($text))
        $patched++
    }
}
Write-Host "TOTAL_PATCHED_FILES: $patched"

# 5) 复核：再扫一遍，含连续点的失效应为 0
$remain = 0
foreach ($f in (Get-ChildItem $root -Recurse -File | Where-Object { $binaryExt -notcontains $_.Extension.ToLower() })) {
    $t = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($f.FullName))
    foreach ($m in [regex]::Matches($t, $tokenRegex)) {
        $tok = $m.Value
        if (($tok -match '\.\.') -and (-not $existing.Contains($tok))) { $remain++ }
    }
}
Write-Host "REMAINING_STALE_REFS: $remain"
Write-Host "FIX_STALE_REFS_DONE"
