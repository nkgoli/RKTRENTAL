param(
  [ValidateSet('start', 'status', 'stop')][string]$Action = 'status',
  [switch]$Initialize,
  [int]$AppPort = 3147,
  [int]$DatabasePort = 5547
)
$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir = Join-Path $reviewRoot '.data/lease-template-review-runtime'
$sourceRoot = Join-Path $runtimeDir 'source'
$databaseDir = Join-Path $reviewRoot '.data/lease-template-review'
$receipt = Join-Path $runtimeDir 'runtime.json'
function Identity($processId) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
  if (!$p) { throw "Owned process $processId is absent." }
  @{ pid = $p.ProcessId; created = $p.CreationDate.ToUniversalTime().ToString('o'); executable = $p.ExecutablePath; command = $p.CommandLine }
}
function Assert-Identity($saved) {
  $live = Identity $saved.pid
  if (([DateTime]$live.created).ToUniversalTime() -ne ([DateTime]$saved.created).ToUniversalTime() -or $live.executable -ne $saved.executable -or $live.command -ne $saved.command) { throw "Process identity changed for $($saved.pid); refusing lifecycle action." }
}
function Listeners($portNumber) { @(Get-NetTCPConnection -State Listen -LocalPort $portNumber -ErrorAction SilentlyContinue) }
function Save-Receipt { $script:runtime | ConvertTo-Json -Depth 6 | Set-Content $receipt }
function Assert-Ready {
  Assert-Identity $script:runtime.app
  Assert-Identity $script:runtime.database
  Assert-Identity $script:runtime.postgres
  foreach ($pair in @(@($script:runtime.appPort,$script:runtime.app.pid), @($script:runtime.databasePort,$script:runtime.postgres.pid))) {
    $listeners = @(Listeners $pair[0])
    if (!$listeners.Count -or @($listeners | Where-Object OwningProcess -ne $pair[1]).Count) { throw "Port $($pair[0]) ownership mismatch or absent listener." }
  }
  foreach ($hostName in @('localhost','127.0.0.1')) {
    if ((Invoke-WebRequest "http://${hostName}:$($script:runtime.appPort)/sign-in" -UseBasicParsing -TimeoutSec 10).StatusCode -ne 200) { throw 'HTTP readiness failed.' }
  }
  $env:DATABASE_URL = "postgresql://rocketrental:rocketrental@localhost:$($script:runtime.databasePort)/rocketrental?schema=public"
  Push-Location $sourceRoot
  try { & node (Join-Path $PSScriptRoot 'review-probe.mjs') | Out-Null } finally { Pop-Location }
  if ($LASTEXITCODE) { throw 'Database readiness failed.' }
  if ($script:runtime -is [System.Collections.IDictionary]) { $script:runtime.lastHealthyUtc = [DateTime]::UtcNow.ToString('o') } else { $script:runtime | Add-Member -Force NoteProperty lastHealthyUtc ([DateTime]::UtcNow.ToString('o')) }
  Save-Receipt
}
if ($Action -ne 'start') {
  if (!(Test-Path $receipt)) { throw 'No owned runtime receipt exists.' }
  $script:runtime = Get-Content $receipt -Raw | ConvertFrom-Json
  if ($runtime.workspace -ne $reviewRoot) { throw 'Receipt belongs to another checkout.' }
  if ($Action -eq 'status') { Assert-Ready; $runtime | ConvertTo-Json -Depth 6; exit }
  # Validate every identity and listener before stopping anything. Never kill a reused PID.
  Assert-Ready
  foreach ($owned in @($runtime.app,$runtime.database,$runtime.postgres)) { if ($owned) { Assert-Identity $owned } }
  & (Join-Path $sourceRoot 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe') stop -D $databaseDir -m fast -w | Out-Null
  if ($LASTEXITCODE) { throw 'Owned database graceful shutdown failed.' }
  foreach ($owned in @($runtime.app,$runtime.database) | Where-Object { $_ }) {
    Assert-Identity $owned
    Stop-Process -Id $owned.pid
  }
  Start-Sleep -Seconds 2
  if (@(Listeners $runtime.appPort).Count -or @(Listeners $runtime.databasePort).Count) { throw 'Release verification failed: listener remains.' }
  foreach ($owned in @($runtime.app,$runtime.database,$runtime.postgres)) { if (Get-Process -Id $owned.pid -ErrorAction SilentlyContinue) { throw 'Release verification failed: recorded PID remains.' } }
  $runtime | Add-Member -Force NoteProperty releasedUtc ([DateTime]::UtcNow.ToString('o'))
  Save-Receipt
  Write-Output 'Owned services released; both dedicated ports have no listeners.'
  exit
}
if (Test-Path $receipt) { throw 'Receipt already exists; inspect status and preserve it before another start.' }
if ($AppPort -eq $DatabasePort) { throw 'Ports must differ.' }
# Bind both ports together as a reservation probe; release immediately before service startup.
$reservations = @()
try {
  foreach ($portNumber in @($AppPort,$DatabasePort)) {
    if (@(Listeners $portNumber).Count) { throw "Port $portNumber is occupied; choose a different dedicated port." }
    $reservation = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$portNumber)
    $reservation.Start(); $reservations += $reservation
  }
} finally { foreach ($reservation in $reservations) { $reservation.Stop() } }
$env:DATABASE_URL = "postgresql://rocketrental:rocketrental@localhost:$DatabasePort/rocketrental?schema=public"
$env:ROCKETRENTAL_DB_DIR = $databaseDir
$env:ROCKETRENTAL_DB_PORT = "$DatabasePort"
$env:ROCKETRENTAL_AUTH_SECRET = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:ROCKETRENTAL_SANDBOX = 'true'
$env:STORAGE_DRIVER = 'local'
$env:STORAGE_LOCAL_DIR = Join-Path $runtimeDir 'storage'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
# Check process-inspection authority before starting any service.
$null = Identity $PID
$sourceIdentity = Get-Content (Join-Path $runtimeDir 'source-identity.json') -Raw | ConvertFrom-Json
if ((Get-FileHash (Join-Path $runtimeDir 'source.zip') -Algorithm SHA256).Hash -ne $sourceIdentity.archiveSha256) { throw 'Source archive identity changed.' }
$nodeBinary = (Get-Command node.exe).Source
$db = Start-Process $nodeBinary -ArgumentList @('--import','./prisma/os-userinfo.mjs','prisma/local-postgres.mjs') -WorkingDirectory $sourceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'db.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'db.stderr.log')
$script:runtime = @{ workspace=$reviewRoot; sourceCommit=$sourceIdentity.sourceCommit; archiveSha256=$sourceIdentity.archiveSha256; sourceRoot=$sourceRoot; databaseDir=$databaseDir; appPort=$AppPort; databasePort=$DatabasePort; database=(Identity $db.Id); startedUtc=[DateTime]::UtcNow.ToString('o'); newFixture=$true }
Save-Receipt
for ($attempt=0; $attempt -lt 60; $attempt++) {
  if ($db.HasExited) { throw 'Database launcher exited; receipt and logs retained.' }
  if ((Get-Content (Join-Path $runtimeDir 'db.stdout.log') -Raw) -match 'Local PostgreSQL ready') { break }
  Start-Sleep -Seconds 1
}
$pg = @(Listeners $DatabasePort | Select-Object -ExpandProperty OwningProcess -Unique)
if ($pg.Count -ne 1) { throw 'Database listener missing or ambiguous.' }
$runtime.postgres = Identity $pg[0]
if ($runtime.postgres.command -notlike "*$databaseDir*") { throw 'Database directory ownership mismatch.' }
Save-Receipt
if ($Initialize) {
  Push-Location $sourceRoot
  try {
    & node node_modules/prisma/build/index.js migrate deploy
    if ($LASTEXITCODE) { throw 'Migration failed.' }
    & node --import ./prisma/os-userinfo.mjs node_modules/tsx/dist/cli.mjs prisma/seed.ts
    if ($LASTEXITCODE) { throw 'Seed failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE) { throw 'New review build failed.' }
  } finally { Pop-Location }
}
$runtime.buildId = (Get-Content (Join-Path $sourceRoot '.next/BUILD_ID') -Raw).Trim()
$app = Start-Process $nodeBinary -ArgumentList @('node_modules/next/dist/bin/next','start','-p',"$AppPort") -WorkingDirectory $sourceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'app.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'app.stderr.log')
$runtime.app = Identity $app.Id
Save-Receipt
for ($attempt=0; $attempt -lt 60; $attempt++) {
  try { Assert-Ready; Write-Output "Ready: http://localhost:$AppPort; receipt $receipt"; exit } catch { if ($attempt -eq 59) { throw }; Start-Sleep -Seconds 1 }
}
