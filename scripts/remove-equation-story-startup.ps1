$ErrorActionPreference = "Stop"

$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupFolder "Equation Story Launcher.lnk"

if (Test-Path $shortcutPath) {
  Remove-Item -Path $shortcutPath -Force
  Write-Host "Removed startup shortcut:" -ForegroundColor Green
  Write-Host "  $shortcutPath"
} else {
  Write-Host "No Equation Story startup shortcut was found." -ForegroundColor Yellow
}
