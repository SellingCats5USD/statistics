param(
  [switch]$Copy
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $workspaceRoot "tmp\equation-story-launcher"
$tunnelPidPath = Join-Path $stateDir "cloudflared.pid"
$tunnelUrlPath = Join-Path $stateDir "tunnel-url.txt"
$tunnelStdoutLog = Join-Path $stateDir "cloudflared.stdout.log"
$tunnelStderrLog = Join-Path $stateDir "cloudflared.stderr.log"

function Test-TunnelUrlCandidate {
  param(
    [string]$Url
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $false
  }

  return $Url -match "^https://[a-z0-9-]+\.trycloudflare\.com$" -and $Url -ne "https://api.trycloudflare.com"
}

function Get-TrackedProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PidFilePath
  )

  if (-not (Test-Path $PidFilePath)) {
    return $null
  }

  $rawPid = (Get-Content -Path $PidFilePath -Raw).Trim()
  if (-not $rawPid) {
    return $null
  }

  try {
    return Get-Process -Id ([int]$rawPid) -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-LatestTunnelUrlFromLogs {
  $pattern = "https://[a-z0-9-]+\.trycloudflare\.com"
  $logPaths = @($tunnelStdoutLog, $tunnelStderrLog)

  foreach ($logPath in $logPaths) {
    if (-not (Test-Path $logPath)) {
      continue
    }

    $matches = Select-String -Path $logPath -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue
    if (-not $matches) {
      continue
    }

    $urls = foreach ($matchLine in $matches) {
      foreach ($match in $matchLine.Matches) {
        $match.Value
      }
    }

    $tunnelUrl = $urls |
      Where-Object { Test-TunnelUrlCandidate -Url $_ } |
      Select-Object -Last 1

    if ($tunnelUrl) {
      return $tunnelUrl
    }
  }

  return ""
}

function Get-TryCloudflareARecords {
  param(
    [string]$Server = ""
  )

  try {
    $resolveParams = @{
      Name = "api.trycloudflare.com"
      Type = "A"
      ErrorAction = "Stop"
    }

    if ($Server) {
      $resolveParams.Server = $Server
    }

    return @(Resolve-DnsName @resolveParams | Select-Object -ExpandProperty IPAddress -Unique)
  } catch {
    return @()
  }
}

$savedUrl = if (Test-Path $tunnelUrlPath) { (Get-Content -Path $tunnelUrlPath -Raw).Trim() } else { "" }
if (-not (Test-TunnelUrlCandidate -Url $savedUrl)) {
  $savedUrl = ""
}

$logUrl = Get-LatestTunnelUrlFromLogs
$tunnelUrl = if ($savedUrl) { $savedUrl } else { $logUrl }

if ($logUrl -and $logUrl -ne $savedUrl) {
  Set-Content -Path $tunnelUrlPath -Value $logUrl
  $tunnelUrl = $logUrl
}

$tunnelProcess = Get-TrackedProcess -PidFilePath $tunnelPidPath
$tunnelRunning = $null -ne $tunnelProcess

if ($Copy -and $tunnelUrl) {
  Set-Clipboard -Value $tunnelUrl
}

if (-not $tunnelUrl) {
  $localRecords = Get-TryCloudflareARecords
  $publicRecords = Get-TryCloudflareARecords -Server "1.1.1.1"

  if ($localRecords.Count -eq 0 -and $publicRecords.Count -gt 0) {
    throw @"
No valid trycloudflare URL was found because this network's DNS cannot resolve api.trycloudflare.com.

Public DNS (1.1.1.1) resolves it to: $($publicRecords -join ", ")

Fix the adapter DNS first, then rerun start-equation-story.ps1.
"@
  }

  throw "No valid trycloudflare URL was found in the launcher state or logs."
}

Write-Host ""
Write-Host "Equation Story tunnel URL:" -ForegroundColor Cyan
Write-Host "  $tunnelUrl"
Write-Host ""

if ($tunnelRunning) {
  Write-Host "Tunnel process:" -ForegroundColor Green
  Write-Host "  Running (PID $($tunnelProcess.Id), started $($tunnelProcess.StartTime))"
} else {
  Write-Host "Tunnel process:" -ForegroundColor Yellow
  Write-Host "  Not running. The URL above is the last known tunnel and may be stale."
}

if ($Copy -and $tunnelUrl) {
  Write-Host ""
  Write-Host "Copied to clipboard." -ForegroundColor Green
}
