<#
.SYNOPSIS
Runs the RealROI chart reference at http://127.0.0.1:3300/demo.
.DESCRIPTION
Clones nkgoli/RealROI into the ignored .data/reference/RealROI folder (if missing),
pins it to the inspected commit, installs with pnpm 9.15, builds the workspace
packages the web app imports and starts the Vite dev server with the dev auth
bypass. It never touches RocketRental's app (3100) or its embedded databases.
See docs/analysis/realroi-chart-parity.md.
#>
[CmdletBinding()]
param(
    [int]$Port = 3300,
    [string]$Commit = '0b12c76fea3958b98f4a722f5acf3336f1fd7d45',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$ref = Join-Path $root '.data\reference\RealROI'

if (-not (Test-Path (Join-Path $ref '.git'))) {
    git clone https://github.com/nkgoli/RealROI.git $ref
    if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
}
git -C $ref checkout --detach $Commit
if ($LASTEXITCODE -ne 0) { throw "checkout of $Commit failed" }

Push-Location $ref
try {
    if (-not $SkipInstall) {
        npx -y pnpm@9.15.0 install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
        npx -y pnpm@9.15.0 turbo build --filter="@roi/web^..."
        if ($LASTEXITCODE -ne 0) { throw 'package build failed' }
    }
    $env:VITE_DEV_AUTH_BYPASS = 'true'
    npx -y pnpm@9.15.0 --filter @roi/web exec vite --host 127.0.0.1 --port $Port --strictPort
} finally {
    Pop-Location
}
