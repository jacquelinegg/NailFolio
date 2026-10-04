$lines = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts'
$line = $lines[157]
Write-Output ('Total length: ' + $line.Length)
Write-Output ('Last 100 chars:')
$start = [Math]::Max(0, $line.Length - 100)
Write-Output $line.Substring($start)
