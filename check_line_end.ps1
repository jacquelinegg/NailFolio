$lines = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts'
$line = $lines[157]
Write-Output ('Line length: ' + $line.Length)
Write-Output ('Last 200 chars:')
Write-Output $line.Substring([Math]::Max(0, $line.Length - 200))
