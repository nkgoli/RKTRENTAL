param([ValidateSet('Start', 'Status', 'Stop')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$reviewData = Join-Path $PSScriptRoot '.runtime'
$recordPath = Join-Path $reviewData 'runtime.json'
if ($Action -eq 'Start') {
  # A fresh checkout has no .runtime yet; logs and the process record live there.
  New-Item -ItemType Directory -Force $reviewData | Out-Null
  $env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:55434/rocketrental?schema=public'
  $env:ROCKETRENTAL_AUTH_SECRET = 'lease-detail-local-fixture-only-01234567890123456789'
  $env:ROCKETRENTAL_SANDBOX = 'true'
  $env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
  $env:STORAGE_DRIVER = 'local'
  $env:STORAGE_LOCAL_DIR = Join-Path $reviewData 'storage'
  if (-not (Test-Path (Join-Path $reviewRoot '.next/BUILD_ID'))) { throw 'Build the candidate first.' }
  if (Test-Path $recordPath) {
    $previous = Get-Content $recordPath -Raw | ConvertFrom-Json
    $existing = Get-Process -Id $previous.pid -ErrorAction SilentlyContinue
    if ($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $previous.startedAt) { throw 'This review runtime is already running.' }
  }
  $reviewProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'node_modules/next/dist/bin/next','start','-p','3234','-H','127.0.0.1' -WorkingDirectory $reviewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $reviewData 'server.log') -RedirectStandardError (Join-Path $reviewData 'server-error.log')
  @{ pid=$reviewProcess.Id; startedAt=$reviewProcess.StartTime.ToUniversalTime().ToString('o'); buildId=[string](Get-Content (Join-Path $reviewRoot '.next/BUILD_ID')); sourceHead=(git -C $reviewRoot rev-parse HEAD); url='http://127.0.0.1:3234'; databasePort=55434 } | ConvertTo-Json | Set-Content $recordPath
  Get-Content $recordPath
} elseif ($Action -eq 'Stop') {
  $record = Get-Content $recordPath -Raw | ConvertFrom-Json
  $reviewProcess = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
  if ($reviewProcess -and $reviewProcess.StartTime.ToUniversalTime().ToString('o') -eq $record.startedAt) {
    Stop-Process -Id $record.pid
    Write-Output 'Stopped this task review server.'
  } else { Write-Output 'Recorded process is no longer running; no process stopped.' }
} else {
  if (Test-Path $recordPath) { Get-Content $recordPath }
  (Invoke-WebRequest 'http://127.0.0.1:3234/sign-in' -UseBasicParsing).StatusCode
}

