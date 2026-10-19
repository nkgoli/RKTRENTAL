param([ValidateSet('db','prepare','build','app','stop')][string]$Mode)
$ErrorActionPreference = 'Stop'
$app = Join-Path $PSScriptRoot '.review-app'
$data = Join-Path $app '.file-review'
New-Item -ItemType Directory -Force $data | Out-Null
Set-Location $app
function PortUsed([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:55438/rocketrental?schema=public'
$env:STORAGE_LOCAL_DIR = Join-Path $data 'storage'
$env:ROCKETRENTAL_SANDBOX = 'true'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
$secret = Join-Path $data 'auth-secret'
if (!(Test-Path $secret)) { ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')) | Set-Content $secret }
$env:ROCKETRENTAL_AUTH_SECRET = (Get-Content $secret -Raw).Trim()
switch ($Mode) {
 'db' {
   if (PortUsed 55438) { throw 'Database port occupied; no process started.' }
   $env:ROCKETRENTAL_DB_PORT = '55438'
   $env:ROCKETRENTAL_DB_DIR = Join-Path $data 'postgres'
   New-Item -ItemType Directory -Force $env:ROCKETRENTAL_DB_DIR | Out-Null
   node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
 }
 'prepare' {
   if (Test-Path (Join-Path $data 'prepared')) { throw 'Fixture already prepared; reseeding refused.' }
   node node_modules/prisma/build/index.js migrate deploy
   if ($LASTEXITCODE) { throw 'Migration failed' }
   node --import ./prisma/os-userinfo.mjs --import tsx prisma/seed.ts
   if ($LASTEXITCODE) { throw 'Seed failed' }
   Copy-Item (Join-Path $env:STORAGE_LOCAL_DIR 'seed/seed-doc-alex-lease') (Join-Path $data 'synthetic-lease.pdf')
   $photo = Get-ChildItem (Join-Path $env:STORAGE_LOCAL_DIR 'seed') | Where-Object Name -Match 'photo' | Select-Object -First 1
   if (!$photo) { throw 'Seed photo missing' }
   Copy-Item $photo.FullName (Join-Path $data 'harmless-photo.png')
   Set-Content (Join-Path $data 'prepared') 'Standard synthetic seed; do not reseed.'
 }
 'build' {
   if (PortUsed 3238) { throw 'App must be stopped before building.' }
   node node_modules/next/dist/bin/next build
   if ($LASTEXITCODE) { throw 'Build failed' }
   Copy-Item '.next/BUILD_ID' (Join-Path $data 'expected-build')
 }
 'app' {
   if (PortUsed 3238) { throw 'App port occupied; no duplicate started.' }
   if (!(PortUsed 55438)) { throw 'Fixture database unavailable.' }
   if ((Get-Content '.next/BUILD_ID' -Raw).Trim() -ne (Get-Content (Join-Path $data 'expected-build') -Raw).Trim()) { throw 'Build changed.' }
   node node_modules/next/dist/bin/next start $app -H 127.0.0.1 -p 3238
 }
 'stop' {
   # Inspect current identities every time; recorded PIDs alone never authorize termination.
   $listeners = netstat -ano | ForEach-Object {
     if ($_ -match '^\s*TCP\s+\S+:(3238|55438)\s+\S+\s+LISTENING\s+(\d+)') {
       [pscustomobject]@{ LocalPort = [int]$Matches[1]; OwningProcess = [int]$Matches[2] }
     }
   } | Sort-Object LocalPort,OwningProcess -Unique
   foreach ($listener in $listeners) {
     $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
     if ($listener.LocalPort -eq 3238) {
       if ($process.CommandLine -notlike "*$app*" -or $process.CommandLine -notmatch 'next.*start.*3238') { throw 'App identity mismatch; untouched.' }
       Stop-Process -Id $process.ProcessId
     } else {
       $db = Join-Path $data 'postgres'
       if ($process.CommandLine -notlike "*$db*") { throw 'Database identity mismatch; untouched.' }
       $ctl = Get-ChildItem prisma/node_modules -Filter pg_ctl.exe -Recurse | Select-Object -First 1
       & $ctl.FullName -D $db stop -m fast -w
       if ($LASTEXITCODE) { throw 'Database stop failed' }
     }
   }
   if ((PortUsed 3238) -or (PortUsed 55438)) { throw 'A review port is still occupied.' }
 }
}


