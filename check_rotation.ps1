$lines = Get-Content -LiteralPath 'D:\NailFolio\app\api\generate-design\route.ts'
$line = $lines[157]
$idx = $line.IndexOf('rotation')
if ($idx -ge 0) {
    Write-Output ('Found "rotation" at index: ' + $idx)
    Write-Output ('Remaining after rotation:')
    Write-Output $line.Substring($idx)
}
