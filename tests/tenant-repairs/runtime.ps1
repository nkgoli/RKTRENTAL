param([ValidateSet('db','app','seed')][string]$Mode)
$ErrorActionPreference = 'Stop'
function Test-ReviewPort([int]$Port) {
 $client = [System.Net.Sockets.TcpClient]::new()
 try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:55427/rocketrental?schema=public'
$env:STORAGE_LOCAL_DIR = Join-Path $PSScriptRoot 'node_modules/runtime/storage'
$secretPath = Join-Path $PSScriptRoot 'node_modules/runtime/auth-secret'
if (!(Test-Path $secretPath)) { ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')) | Set-Content $secretPath }
$env:ROCKETRENTAL_AUTH_SECRET = (Get-Content $secretPath -Raw).Trim()
$env:ROCKETRENTAL_SANDBOX = 'true'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
if ($Mode -eq 'db') {
 if (Test-ReviewPort 55427) { throw 'Port 55427 is already occupied; identify its owner before restarting.' }
 $env:ROCKETRENTAL_DB_PORT = '55427'
 $env:ROCKETRENTAL_DB_DIR = Join-Path $PSScriptRoot 'node_modules/runtime/postgres'
 node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
} elseif ($Mode -eq 'app') {
 if (Test-ReviewPort 3227) { throw 'Port 3227 is already occupied; no duplicate app was started.' }
 if (!(Test-ReviewPort 55427)) { throw 'Retained fixture database is not listening on 55427; restore it without reseeding first.' }
 $build = (Get-Content (Join-Path $PSScriptRoot '.review-app/.next/BUILD_ID') -Raw).Trim()
 if ($build -ne 'SZJQyT5M5qQ6bfe8gG18w') { throw 'Review build identity changed; reconcile before launch.' }
 node node_modules/next/dist/bin/next start tests/tenant-repairs/.review-app -p 3227
} elseif ($Mode -eq 'seed') {
 node node_modules/prisma/build/index.js migrate deploy
 node --import ./prisma/os-userinfo.mjs --import tsx prisma/seed.ts
}
