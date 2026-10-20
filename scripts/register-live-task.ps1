<#
.SYNOPSIS
Keeps a local RocketRental copy running under Windows Task Scheduler.

.DESCRIPTION
Registers (or updates) a per-user scheduled task that runs scripts\start.ps1
hidden with the given ports, then starts it. The app and its embedded Postgres
belong to Task Scheduler rather than to the shell that ran this script, so they
keep running after that shell, an editor or an agent session exits. The task
also starts at logon and restarts if start.ps1 exits with an error.

start.ps1 rebuilds only when sources are newer than the build, never reseeds
an initialised data dir (.demo-seeded marker) and never resets it here.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\register-live-task.ps1
Run on http://localhost:3100 with Postgres 5433 (data in .data\postgres-5433).

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\register-live-task.ps1 -Restart
Stop the running copy and start it again, e.g. to pick up new commits.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\register-live-task.ps1 -Remove
Stop the copy and delete the scheduled task.
#>
[CmdletBinding()]
param(
    [int]$Port = 3100,
    [int]$DbPort = 5433,
    [string]$TaskName = '',
    [switch]$Restart,
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not $TaskName) { $TaskName = "RocketRentalLive$Port" }
function Info($m) { Write-Host "[live] $m" -ForegroundColor Cyan }

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing -and ($Remove -or $Restart) -and $existing.State -eq 'Running') {
    Info "Stopping '$TaskName'"
    Stop-ScheduledTask -TaskName $TaskName
    # Task Scheduler ends the whole process tree; wait for the ports to close.
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-NetTCPConnection -State Listen -LocalPort $Port, $DbPort -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }
}
if ($Remove) {
    if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; Info "Removed '$TaskName'." }
    return
}

$start = Join-Path $Root 'scripts\start.ps1'
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$start`" -Port $Port -DbPort $DbPort -SkipInstall"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description "RocketRental on http://localhost:$Port (embedded Postgres $DbPort) via scripts\start.ps1" -Force | Out-Null
Info "Registered '$TaskName': $start -Port $Port -DbPort $DbPort"

if ((Get-ScheduledTask -TaskName $TaskName).State -ne 'Running') {
    Start-ScheduledTask -TaskName $TaskName
    Info "Started '$TaskName'. Logs: $(Join-Path $env:TEMP 'rocketrental')\app-$Port.log"
} else {
    Info "'$TaskName' is already running."
}
