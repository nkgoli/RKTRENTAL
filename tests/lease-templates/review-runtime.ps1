param([ValidateSet('start', 'stop')][string]$Action = 'start', [switch]$Development)
$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir = Join-Path $reviewRoot '.data/lease-template-review-runtime'
New-Item -ItemType Directory -Force $runtimeDir | Out-Null
$receipt = Join-Path $runtimeDir 'runtime.json'
if ($Action -eq 'stop') {
  if (Test-Path $receipt) {
    $runtime = Get-Content $receipt -Raw | ConvertFrom-Json
    foreach ($ownedPid in @($runtime.appPid, $runtime.dbPid)) {
      $ownedProcess = Get-Process -Id $ownedPid -ErrorAction SilentlyContinue
      if ($ownedProcess) {
        if ([Math]::Abs(($ownedProcess.StartTime.ToUniversalTime() - [DateTime]::Parse($runtime.startedUtc).ToUniversalTime()).TotalSeconds) -gt 15) { throw 'Runtime process identity changed; inspect receipt before stopping.' }
        if ($ownedPid -eq $runtime.dbPid) {
          & (Join-Path $reviewRoot 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe') stop -D (Join-Path $reviewRoot '.data/lease-template-review') -m fast | Out-Null
        }
        & taskkill.exe /PID $ownedPid /T /F | Out-Null
      }
    }
  }
  exit
}
$nodeBinary = (Get-Command node.exe).Source
foreach ($reviewPort in @(3147, 5547)) {
  $connection = New-Object Net.Sockets.TcpClient
  try { $connection.Connect('127.0.0.1', $reviewPort); throw "Dedicated review port $reviewPort is already in use; stop the owned runtime first." }
  catch [Net.Sockets.SocketException] { }
  finally { $connection.Dispose() }
}
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:5547/rocketrental?schema=public'
$env:ROCKETRENTAL_DB_DIR = Join-Path $reviewRoot '.data/lease-template-review'
$env:ROCKETRENTAL_DB_PORT = '5547'
$env:ROCKETRENTAL_AUTH_SECRET = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:ROCKETRENTAL_SANDBOX = 'true'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
$databaseProcess = Start-Process -FilePath $nodeBinary -ArgumentList @('--import', './prisma/os-userinfo.mjs', 'prisma/local-postgres.mjs') -WorkingDirectory $reviewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'db.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'db.stderr.log')
$serverMode = if ($Development) { 'dev' } else { 'start' }
$appProcess = Start-Process -FilePath $nodeBinary -ArgumentList @('node_modules/next/dist/bin/next', $serverMode, '-p', '3147') -WorkingDirectory $reviewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'app.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'app.stderr.log')
$candidate = (& git -C $reviewRoot rev-parse HEAD).Trim()
$build = if (!$Development) { (Get-Content (Join-Path $reviewRoot '.next/BUILD_ID') -Raw).Trim() } else { 'development-baseline' }
@{ appPid = $appProcess.Id; dbPid = $databaseProcess.Id; candidate = $candidate; buildId = $build; mode = $serverMode; url = 'http://127.0.0.1:3147'; databasePort = 5547; startedUtc = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content $receipt
$ready = $false
for ($readinessAttempt = 0; $readinessAttempt -lt 45; $readinessAttempt++) {
  if ($appProcess.HasExited -or $databaseProcess.HasExited) { throw 'Review process exited; inspect runtime logs.' }
  if ((Get-Content (Join-Path $runtimeDir 'db.stdout.log') -Raw) -match 'Local PostgreSQL ready') {
    try { $ready = (Invoke-WebRequest -Uri 'http://127.0.0.1:3147/sign-in' -UseBasicParsing).StatusCode -eq 200 } catch { }
    if ($ready) { break }
  }
  Start-Sleep -Seconds 1
}
if (!$ready) { throw 'Review runtime readiness timed out; inspect runtime logs.' }
Write-Output "Started hidden $serverMode fixture runtime; receipt: .data/lease-template-review-runtime/runtime.json"
