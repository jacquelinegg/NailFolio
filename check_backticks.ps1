$lines = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts'
$backtickCount = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    $count = ([regex]::Matches($lines[$i], '`')).Count
    if ($count -gt 0) {
        $backtickCount += $count
        Write-Output ('Line ' + ($i + 1) + ': ' + $count + ' backtick(s)')
    }
}
Write-Output ('Total backticks: ' + $backtickCount)
