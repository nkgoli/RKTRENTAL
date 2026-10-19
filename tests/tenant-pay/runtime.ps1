param([string]$Mode)
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:55429/rocketrental?schema=public&connection_limit=3'
$env:STORAGE_LOCAL_DIR = Join-Path $PSScriptRoot 'node_modules/runtime/storage'
$secretPath = Join-Path $PSScriptRoot 'node_modules/runtime/auth-secret'
if (!(Test-Path $secretPath)) { ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')) | Set-Content $secretPath }
$env:ROCKETRENTAL_AUTH_SECRET = (Get-Content $secretPath -Raw).Trim()
$env:ROCKETRENTAL_SANDBOX = 'true'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
if ($Mode -eq 'db') {
 $env:ROCKETRENTAL_DB_PORT = '55429'
 $env:ROCKETRENTAL_DB_DIR = Join-Path $PSScriptRoot 'node_modules/runtime/postgres'
 node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
} elseif ($Mode -eq 'app') {
 node node_modules/next/dist/bin/next start -p 3229
} elseif ($Mode -eq 'seed') {
 node node_modules/prisma/build/index.js migrate deploy
 node --import ./prisma/os-userinfo.mjs --import tsx prisma/seed.ts
}



