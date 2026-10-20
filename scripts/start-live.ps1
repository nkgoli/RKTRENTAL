<#
.SYNOPSIS
Starts the preserved local ROI dataset at http://localhost:3100.
.DESCRIPTION
Pins the app to this checkout's .data/postgres-5434 database on every restart.
No seed/reset option is exposed. Other embedded database directories are preserved.
Use scripts/start.ps1 directly for isolated databases or other configurations.
#>
[CmdletBinding()]
param(
    [switch]$StopExisting,
    [switch]$Rebuild,
    [switch]$SkipInstall
)

& (Join-Path $PSScriptRoot 'start.ps1') -Port 3100 -DbPort 5434 `
    -StopExisting:$StopExisting -Rebuild:$Rebuild -SkipInstall:$SkipInstall
