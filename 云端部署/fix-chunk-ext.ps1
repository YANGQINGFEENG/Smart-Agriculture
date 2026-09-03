# 【历史兜底脚本，正常情况下已不需要执行】
# 修正旧版 fix-chunk-names.ps1 的遗留问题：
# 原名形如 "xxx..js" 被替换成 "xxx--js"（丢了扩展名的点），应为 "xxx--.js"
# 现版 fix-chunk-names.ps1 已在改名时保留扩展名的点，本脚本跑不出任何 pair。
# 若确实执行过本脚本，之后必须再跑 fix-stale-refs.ps1（本脚本的引用替换同样漏了 .rsc）
$root = "e:\tghy\smart-agriculture\.next"
$extToken = 'js|mjs|cjs|css|json|html|txt'

$pairs = @()
Get-ChildItem $root -Recurse -File | ForEach-Object {
    $n = $_.Name
    if ($n -match "--($extToken)(\.map)?$") {
        $new = [regex]::Replace($n, "--($extToken)(\.map)?$", '--.$1$2')
        if ($new -ne $n) { $pairs += , @($n, $new) }
    }
}

foreach ($p in $pairs) {
    $f = Get-ChildItem $root -Recurse -File | Where-Object { $_.Name -eq $p[0] } | Select-Object -First 1
    if ($f) {
        Move-Item -LiteralPath $f.FullName -Destination (Join-Path $f.DirectoryName $p[1]) -Force
        Write-Host "FIX: $($p[0]) -> $($p[1])"
    } else {
        Write-Host "MISS: $($p[0])"
    }
}
Write-Host "TOTAL_FIXED: $($pairs.Count)"

# 同步引用（仅文本类文件）
$textExt = @('.js', '.mjs', '.cjs', '.css', '.json', '.html', '.txt', '.map', '.xml', '')
$pairsSorted = $pairs | Sort-Object { $_[0].Length } -Descending
$patched = 0
Get-ChildItem $root -Recurse -File | Where-Object { $textExt -contains $_.Extension.ToLower() } | ForEach-Object {
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($_.FullName))
    $orig = $text
    foreach ($p in $pairsSorted) { $text = $text.Replace($p[0], $p[1]) }
    if ($text -ne $orig) {
        [System.IO.File]::WriteAllBytes($_.FullName, [System.Text.Encoding]::UTF8.GetBytes($text))
        $patched++
    }
}
Write-Host "TOTAL_PATCHED_FILES: $patched"

# 校验
$badNames = Get-ChildItem $root -Recurse -File | Where-Object { $_.Name -match "--($extToken)(\.map)?$" }
$badRefs = 0
Get-ChildItem $root -Recurse -File | Where-Object { $textExt -contains $_.Extension.ToLower() } | ForEach-Object {
    $t = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($_.FullName))
    foreach ($p in $pairsSorted) { if ($t.Contains($p[0])) { $badRefs++ } }
}
Write-Host "REMAINING_BAD_NAMES: $($badNames.Count)"
Write-Host "REMAINING_BAD_REFS: $badRefs"
Write-Host "FIX_CHUNK_EXT_DONE"
