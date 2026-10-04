$c = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts' -Raw
Write-Output ('Total backticks: ' + ([regex]::Matches($c, '`')).Count)
$idx = $c.LastIndexOf('`')
Write-Output ('Last backtick at index: ' + $idx)
Write-Output ('Context after last backtick:')
Write-Output $c.Substring($idx, [Math]::Min(200, $c.Length - $idx))
