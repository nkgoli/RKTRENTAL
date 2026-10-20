param(
  [ValidateSet('start','status','stop')][string]$Action = 'status',
  [ValidateSet('candidate','baseline')][string]$Variant = 'candidate'
)
$ErrorActionPreference = 'Stop'
$checkout = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$binding = Join-Path $checkout 'tests/lease-builder/.runtime-db'
$data = Join-Path $binding 'data'
$statePath = Join-Path $binding 'runtime.json'
$server = Join-Path $checkout 'tests/lease-builder/runtime-server.mjs'
$pgctl = Join-Path $binding 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
function Listeners($port) { @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }
function Build($directory) { (Get-Content -LiteralPath (Join-Path $directory '.next/BUILD_ID') -Raw).Trim() }
function Database {
  $lines = Get-Content -LiteralPath (Join-Path $data 'postmaster.pid')
  if ($lines[1].Replace('/','\').TrimEnd('\') -ne $data -or $lines[3] -ne '55508') { throw 'Database identity mismatch' }
  $listeners = @(Listeners 55508)
  if (!$listeners.Count -or @($listeners | Where-Object OwningProcess -ne ([int]$lines[0])).Count) { throw 'Unknown database owner' }
}
function Verify($state) {
  Database
  if ($state.checkout -ne $checkout -or (Build $state.directory) -ne $state.build) { throw 'Checkout/build changed' }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)"
  if (!$process -or !$process.CommandLine.Contains($server) -or !$process.CommandLine.Contains($state.build)) { throw 'Unknown process owner' }
  $listeners = @(Listeners 3308)
  if (!$listeners.Count -or @($listeners | Where-Object OwningProcess -ne $state.pid).Count) { throw 'Unknown app owner' }
  $remote = Invoke-RestMethod 'http://127.0.0.1:3308/__builder_identity'
  if ($remote.checkout -ne $checkout -or $remote.directory -ne $state.directory -or $remote.build -ne $state.build -or $remote.source -ne $state.source) { throw 'HTTP identity mismatch' }
  $state
}
if ($Action -eq 'start') {
  if (@(Listeners 3308).Count) { throw 'Port 3308 occupied; refusing reuse' }
  if (!(Test-Path (Join-Path $data 'PG_VERSION'))) { throw 'Preserved fixture missing; no implicit reseed' }
  if (!@(Listeners 55508).Count) {
    $pg = Start-Process $pgctl -ArgumentList @('-D',('"'+$data+'"'),'-l',('"'+(Join-Path $binding 'database.log')+'"'),'-o','"-p 55508 -h 127.0.0.1"','-w','start') -WindowStyle Hidden -PassThru
    if (!$pg.WaitForExit(15000) -or $pg.ExitCode -ne 0) { throw 'Database start failed' }
  }
  Database
  $directory = if ($Variant -eq 'baseline') { Join-Path $binding 'baseline' } else { $checkout }
  $source = if ($Variant -eq 'baseline') { '69c4bf7eb34266f067df3826b7a3b5928f915c64' } else { (& git -C $checkout rev-parse HEAD).Trim() }
  $build = Build $directory
  $env:DATABASE_URL = 'postgresql://rocketrental@127.0.0.1:55508/rocketrental?schema=public'
  $env:ROCKETRENTAL_AUTH_SECRET = 'light-builder-isolated-check-only-secret-2026'
  $env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
  $env:ROCKETRENTAL_SANDBOX = 'true'
  $env:STORAGE_LOCAL_DIR = Join-Path $binding 'storage'
  $p = Start-Process (Get-Command node.exe).Source -ArgumentList @('--import','./prisma/os-userinfo.mjs',('"'+$server+'"'),('"'+$checkout+'"'),('"'+$directory+'"'),$build,$source) -WorkingDirectory $checkout -WindowStyle Hidden -RedirectStandardOutput (Join-Path $binding 'app.log') -RedirectStandardError (Join-Path $binding 'app.err') -PassThru
  $state = [pscustomobject]@{checkout=$checkout; directory=$directory; build=$build; source=$source; pid=$p.Id; variant=$Variant}
  $state | ConvertTo-Json | Set-Content -LiteralPath $statePath
  for ($i=0; $i -lt 30; $i++) { try { Verify $state | ConvertTo-Json; exit 0 } catch { if ($i -eq 29) { throw }; Start-Sleep -Seconds 1 } }
} else {
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $result = Verify $state
  if ($Action -eq 'stop') {
    Stop-Process -Id $state.pid
    & $pgctl -D $data stop -m fast -w
    if ($LASTEXITCODE) { throw 'Database stop failed' }
    @{status='stopped'; source=$state.source; build=$state.build} | ConvertTo-Json
  } else { $result | ConvertTo-Json }
}
