param()
$lines = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts'
$line = $lines[157]
$len = $line.Length
Write-Output ('Line length: ' + $len)
$start = [Math]::Max(0, $len - 50)
$sub = $line.Substring($start)
Write-Output ('Last 50 chars:')
Write-Output $sub
