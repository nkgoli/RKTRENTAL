param([ValidateSet('start','status','stop')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$checkout = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$binding = Join-Path $checkout '.playwright-mcp'
$data = (Resolve-Path (Join-Path $binding 'lease-postgres')).Path
$statePath = Join-Path $binding 'lease-runtime.json'
$server = Join-Path $PSScriptRoot 'review-server.mjs'
$identity = Join-Path $PSScriptRoot 'database-identity.mjs'
$node = (Get-Command node).Source
$pgctl = Join-Path $checkout 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@127.0.0.1:55494/rocketrental?schema=public'
function Listeners([int]$port) { @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $port) }
function Build([string]$dir) { (Get-Content -LiteralPath (Join-Path $dir '.next/BUILD_ID') -Raw).Trim() }
function DatabaseIdentity {
  $result = & $node $identity
  if ($LASTEXITCODE -ne 0) { throw 'Database identity verification failed; no mutations or shutdown allowed' }
  $result | ConvertFrom-Json
}
function Verify($state) {
  if ($state.checkout -ne $checkout -or $state.dataDirectory -ne $data) { throw 'Runtime state belongs to another checkout/data directory' }
  & git -C $checkout merge-base --is-ancestor $state.candidate HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Runtime candidate is not an ancestor' }
  & git -C $checkout diff --quiet $state.candidate -- src public
  if ($LASTEXITCODE -ne 0) { throw 'Runtime source has changed; rebuild/review required' }
  $dbIdentity = DatabaseIdentity
  $pidLines = Get-Content -LiteralPath (Join-Path $data 'postmaster.pid')
  if ($pidLines[1].Replace('/','\').TrimEnd('\') -ne $data -or $pidLines[3] -ne '55494') { throw 'Postmaster identity mismatch' }
  $dbListeners = Listeners 55494
  if ($dbListeners.Count -eq 0 -or @($dbListeners | Where-Object OwningProcess -ne ([int]$pidLines[0])).Count) { throw 'Database listener mismatch' }
  foreach ($app in @($state.app, $state.baseline)) {
    if ((Build $app.directory) -ne $app.build) { throw 'On-disk build changed' }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($app.pid)"
    if (!$process -or !$process.CommandLine.Contains($server) -or !$process.CommandLine.Contains($app.directory) -or !$process.CommandLine.Contains($app.build)) { throw 'Server process identity mismatch; refusing reuse/shutdown' }
    $listeners = Listeners $app.port
    if ($listeners.Count -eq 0 -or @($listeners | Where-Object OwningProcess -ne $app.pid).Count) { throw 'Unknown port occupant; refusing reuse/shutdown' }
    $remote = Invoke-RestMethod -Uri "http://127.0.0.1:$($app.port)/__lease_review_identity"
    if ($remote.checkout -ne $checkout -or $remote.directory -ne $app.directory -or $remote.build -ne $app.build -or $remote.candidate -ne $state.candidate -or $remote.dataDirectory -ne $data) { throw 'HTTP runtime identity mismatch' }
  }
  [ordered]@{ status='ready'; checkout=$checkout; candidate=$state.candidate; dataDirectory=$dbIdentity.dataDirectory; databasePort=55494; app=$state.app; baseline=$state.baseline }
}
if ($Action -eq 'start') {
  if (Test-Path -LiteralPath $statePath) {
    $old = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if (@(Listeners 3294).Count -or @(Listeners 3295).Count -or @(Listeners 55494).Count) { Verify $old | ConvertTo-Json -Depth 5; exit 0 }
  }
  foreach ($port in @(3294,3295,55494)) { if (@(Listeners $port).Count) { throw "Reserved port $port occupied; no substitution or shutdown attempted" } }
  if (!(Test-Path -LiteralPath (Join-Path $data 'PG_VERSION'))) { throw 'Preserved fixture missing; initialization/reseed not permitted' }
  if (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid')) {
    $lines = Get-Content -LiteralPath (Join-Path $data 'postmaster.pid')
    if (Get-Process -Id ([int]$lines[0]) -ErrorAction SilentlyContinue) { throw 'Preserved data directory has a running or ambiguous owner; refusing startup' }
  }
  $candidate = (& git -C $checkout rev-parse HEAD).Trim()
  & git -C $checkout diff --quiet -- src public
  if ($LASTEXITCODE -ne 0) { throw 'Uncommitted application source' }
  $appDir = $checkout
  $baselineDir = (Resolve-Path (Join-Path $binding 'baseline')).Path
  $appBuild = Build $appDir
  $baselineBuild = Build $baselineDir
  $pg = Start-Process -FilePath $pgctl -ArgumentList @('-D', ('"'+$data+'"'), '-l', ('"'+(Join-Path $binding 'lease-database.log')+'"'), '-o', '"-p 55494 -h 127.0.0.1"', '-w', 'start') -WindowStyle Hidden -Wait -PassThru
  if ($pg.ExitCode -ne 0) { throw 'Database startup failed; no other service touched' }
  $null = DatabaseIdentity
  $env:ROCKETRENTAL_AUTH_SECRET = 'lease-review-isolated-runtime-2026-only-secret'
  $env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
  $env:ROCKETRENTAL_SANDBOX = 'true'
  $apps = @()
  foreach ($spec in @(@($appDir,$appBuild,3294), @($baselineDir,$baselineBuild,3295))) {
    $port = [int]$spec[2]
    $p = Start-Process -FilePath $node -ArgumentList @(('"'+$server+'"'), ('"'+$spec[0]+'"'), $spec[1], $candidate, $port) -WorkingDirectory $checkout -WindowStyle Hidden -RedirectStandardOutput (Join-Path $binding "lease-$port.log") -RedirectStandardError (Join-Path $binding "lease-$port.err") -PassThru
    $apps += [ordered]@{ pid=$p.Id; directory=$spec[0]; build=$spec[1]; port=$port }
  }
  $state = [ordered]@{ checkout=$checkout; dataDirectory=$data; candidate=$candidate; app=$apps[0]; baseline=$apps[1] }
  $state | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath $statePath
  for ($i=0; $i -lt 30; $i++) {
    try { $result = Verify ([pscustomobject]$state); $result | ConvertTo-Json -Depth 5; exit 0 } catch { if ($i -eq 29) { throw }; Start-Sleep -Seconds 1 }
  }
} else {
  if (!(Test-Path -LiteralPath $statePath)) { throw 'No owned runtime state; refusing reuse or shutdown' }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $result = Verify $state
  if ($Action -eq 'stop') {
    # All identities are checked before the first shutdown; no port-based killing.
    Stop-Process -Id $state.app.pid, $state.baseline.pid
    & $pgctl -D $data stop -m fast -w
    if ($LASTEXITCODE -ne 0) { throw 'Owned database stop failed' }
    [ordered]@{ status='stopped'; checkout=$checkout; candidate=$state.candidate; dataDirectory=$data } | ConvertTo-Json
  } else { $result | ConvertTo-Json -Depth 5 }
}

