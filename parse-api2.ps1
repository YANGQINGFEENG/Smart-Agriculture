$j = Get-Content 'e:\tghy\api-actuators.json' -Raw | ConvertFrom-Json
$j.data | ForEach-Object { Write-Host ($_.id + "  locked=" + $_.locked + "  status=" + $_.status + "  state=" + $_.state) }
