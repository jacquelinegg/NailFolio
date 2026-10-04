$lines = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts'
$line = $lines[157]
$len = $line.Length
Write-Output ('Line length: ' + $len)
Write-Output ('Last 50 chars:')
Write-Output $line.Substring([Math]::Max(0, $len - 50))
