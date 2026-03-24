param(
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$launcherPath = Join-Path $PSScriptRoot "start-equation-story.cmd"
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupFolder "Equation Story Launcher.lnk"

if (-not (Test-Path $launcherPath)) {
  throw "Launcher not found at $launcherPath"
}

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherPath
$shortcut.WorkingDirectory = $workspaceRoot
$shortcut.WindowStyle = 7
$shortcut.Description = "Start the Equation Story backend and Cloudflare tunnel at login."

if ($ForceRestart) {
  $shortcut.Arguments = "-ForceRestart"
} else {
  $shortcut.Arguments = ""
}

$shortcut.Save()

Write-Host "Created startup shortcut:" -ForegroundColor Green
Write-Host "  $shortcutPath"
Write-Host ""
Write-Host "This will run at log in and launch Equation Story automatically." -ForegroundColor Cyan
