$j = Get-Content 'e:\tghy\云端部署\api-actuators.json' -Raw | ConvertFrom-Json
$j.data | ForEach-Object { "{0}  locked={1}  status={2}  state={3}  mode={4}" -f $_.id, $_.locked, $_.status, $_.state, $_.mode }
