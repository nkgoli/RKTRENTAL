[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet('Start', 'Launch', 'RestartNext', 'LaunchNext', 'Status', 'Stop')]
    [string]$Action = 'Status'
)

$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir = Join-Path $PSScriptRoot '.runtime'
$fixtureDir = Join-Path $runtimeDir 'postgres'
$stateFile = Join-Path $runtimeDir 'native-review.json'
$launchError = Join-Path $runtimeDir 'native-review-launch-error.log'
$postgresExe = Join-Path $reviewRoot 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/postgres.exe'
$pgCtlExe = Join-Path $reviewRoot 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
$nextEntry = Join-Path $reviewRoot 'node_modules/next/dist/bin/next'
$expectedBuild = 'AFP2Fu5f6Vc4ZfOZT7itT'

function Get-OwnedProcess($identity) {
    $process = Get-Process -Id $identity.pid -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    if ($process.StartTime.ToUniversalTime().ToString('o') -ne $identity.createdUtc -or
        $process.Path -ne $identity.executable) {
        throw "PID $($identity.pid) no longer matches the recorded review process; leaving it untouched."
    }
    return $process
}

function Get-Identity($process, [string]$executable) {
    return @{
        pid = $process.Id
        createdUtc = $process.StartTime.ToUniversalTime().ToString('o')
        # Path can briefly be null on the Process object returned by Start-Process.
        # Record the exact launched file; later status/stop checks compare the live image.
        executable = (Get-Item -LiteralPath $executable).FullName
    }
}

function Assert-ReadyToStart {
    if ((Get-Content (Join-Path $reviewRoot '.next/BUILD_ID') -Raw).Trim() -ne $expectedBuild) {
        throw 'The retained production build changed; do not silently replace the tested runtime.'
    }
    if (-not (Test-Path (Join-Path $fixtureDir 'PG_VERSION'))) { throw 'Retained fixture is missing.' }
    if (Test-Path (Join-Path $fixtureDir 'postmaster.pid')) { throw 'Fixture has a PID file; reconcile ownership first.' }
    if (@(Get-NetTCPConnection -LocalPort 3228,55428 -State Listen -ErrorAction SilentlyContinue).Count) {
        throw 'A review port is occupied; no process was replaced.'
    }
    if (Test-Path $stateFile) {
        $previous = Get-Content $stateFile -Raw | ConvertFrom-Json
        foreach ($identity in @($previous.postgres, $previous.next)) {
            if ($identity -and (Get-OwnedProcess $identity)) { throw 'A recorded review process is still running.' }
        }
    }
}

function Start-ReviewNext {
    $env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:55428/rocketrental?schema=public'
    $secretBytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
    $env:ROCKETRENTAL_AUTH_SECRET = [Convert]::ToBase64String($secretBytes)
    # This fixture is served over local HTTP only; never change the system environment.
    $env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
    $nodeExe = (Get-Command node.exe).Source
    $logStem = 'persistent-native-next-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
    try {
        $process = Start-Process -FilePath $nodeExe -ArgumentList @(('"{0}"' -f $nextEntry), 'start', '-p', '3228') -WorkingDirectory $reviewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir ($logStem + '.stdout.log')) -RedirectStandardError (Join-Path $runtimeDir ($logStem + '.stderr.log'))
        return (Get-Identity $process $nodeExe)
    } finally {
        $env:ROCKETRENTAL_AUTH_SECRET = $null
        [Array]::Clear($secretBytes, 0, $secretBytes.Length)
    }
}

if ($Action -in @('Start', 'RestartNext')) {
    if ($Action -eq 'Start') { Assert-ReadyToStart }
    # WMI creates the hidden launcher outside the tool runner's process tree/job.
    # The launcher exits after starting the services; no hold loop is required.
    $powershellExe = (Get-Command powershell.exe).Source
    $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
    $launchAction = if ($Action -eq 'RestartNext') { 'LaunchNext' } else { 'Launch' }
    $commandLine = '"{0}" -NoProfile -NonInteractive -WindowStyle Hidden -File "{1}" -Action {2}' -f $powershellExe, $PSCommandPath, $launchAction
    $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $commandLine
        CurrentDirectory = $reviewRoot
        ProcessStartupInformation = $startup
    }
    if ($result.ReturnValue -ne 0) { throw "Hidden launcher failed with Windows result $($result.ReturnValue)." }
    [pscustomobject]@{ launcherPid = $result.ProcessId; checkout = $reviewRoot; stateFile = $stateFile } | ConvertTo-Json
    return
}

if ($Action -eq 'Launch') {
    try {
        Assert-ReadyToStart
        $state = @{
            checkout = $reviewRoot
            build = $expectedBuild
            sourceHeadAtStart = (& git -C $reviewRoot rev-parse HEAD)
            launcherPid = $PID
            postgres = $null
            next = $null
        }
        $postgres = Start-Process -FilePath $postgresExe -ArgumentList @('-D', ('"{0}"' -f $fixtureDir), '-p', '55428') -WorkingDirectory $reviewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'persistent-native-postgres.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'persistent-native-postgres.stderr.log')
        $state.postgres = Get-Identity $postgres $postgresExe
        $state | ConvertTo-Json -Depth 4 | Set-Content $stateFile -Encoding UTF8
        $state.next = Start-ReviewNext
        $state | ConvertTo-Json -Depth 4 | Set-Content $stateFile -Encoding UTF8
    } catch {
        $_.Exception.Message | Set-Content $launchError -Encoding UTF8
        throw
    }
    return
}

if (-not (Test-Path $stateFile)) { throw 'No review process identities have been recorded.' }
$state = Get-Content $stateFile -Raw | ConvertFrom-Json
if ($state.checkout -ne $reviewRoot) { throw 'Runtime state belongs to another checkout.' }
$postgres = if ($state.postgres) { Get-OwnedProcess $state.postgres }
$next = if ($state.next) { Get-OwnedProcess $state.next }

if ($Action -eq 'LaunchNext') {
    if (-not $postgres) { throw 'Retained database is not running; it was not restarted.' }
    if ((Get-Content (Join-Path $reviewRoot '.next/BUILD_ID') -Raw).Trim() -ne $expectedBuild) { throw 'Tested build changed.' }
    if ($next) { Stop-Process -Id $next.Id; $next.WaitForExit() }
    if (@(Get-NetTCPConnection -LocalPort 3228 -State Listen -ErrorAction SilentlyContinue).Count) { throw 'Port 3228 remains occupied; no replacement was launched.' }
    $state.next = Start-ReviewNext
    $state.launcherPid = $PID
    $state | ConvertTo-Json -Depth 4 | Set-Content $stateFile -Encoding UTF8
    return
}

if ($Action -eq 'Stop') {
    if ($next -and $PSCmdlet.ShouldProcess("Next PID $($next.Id)", 'Stop verified review process')) {
        Stop-Process -Id $next.Id
    }
    if ($postgres) {
        $fixturePid = (Get-Content (Join-Path $fixtureDir 'postmaster.pid') -TotalCount 1).Trim()
        if ($fixturePid -ne [string]$postgres.Id) { throw 'Fixture PID differs; database was not stopped.' }
        if ($PSCmdlet.ShouldProcess("PostgreSQL PID $($postgres.Id)", 'Cleanly stop retained fixture')) {
            & $pgCtlExe stop -D $fixtureDir -m fast -w
            if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL shutdown did not complete.' }
        }
    }
    return
}

$http = foreach ($hostName in @('localhost', '127.0.0.1')) {
    $url = "http://${hostName}:3228/sign-in"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        [pscustomobject]@{ url = $url; status = [int]$response.StatusCode; signInForm = $response.Content.Contains('Email address') }
    } catch {
        [pscustomobject]@{ url = $url; error = $_.Exception.Message }
    }
}
[pscustomobject]@{
    observedUtc = [DateTime]::UtcNow.ToString('o')
    checkout = $state.checkout
    build = $state.build
    sourceHeadAtStart = $state.sourceHeadAtStart
    launcherStillRunning = [bool](Get-Process -Id $state.launcherPid -ErrorAction SilentlyContinue)
    postgres = $state.postgres
    postgresRunning = [bool]$postgres
    next = $state.next
    nextRunning = [bool]$next
    listeners = @(Get-NetTCPConnection -LocalPort 3228,55428 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess)
    http = @($http)
} | ConvertTo-Json -Depth 5
