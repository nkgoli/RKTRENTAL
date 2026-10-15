<#
.SYNOPSIS
Starts RocketRental locally on Windows with one command.

.DESCRIPTION
Checks prerequisites, installs dependencies when node_modules is missing or
stale, creates .env when missing, starts PostgreSQL, applies Prisma migrations,
optionally seeds the demo data, then starts the app and prints its URL.

Database: by default the embedded Postgres 16 used by `npm run db:local`
(no Docker needed, data in prisma\.local-postgres). Use -Docker to start the
`db` service of docker-compose.yml instead, or -SkipDatabase to use your own
database from DATABASE_URL.

App: production build (`next build` + `next start`) by default, or the Next.js
dev server with -Dev. The script stays in the foreground; press Ctrl+C to stop
the app and any database it started.

Ports: the app uses 3000 and Postgres 5432. If either is held, the script
reports the process (and the 'RocketRentalPreview' scheduled task, if that is
the holder) and exits. Re-run with -StopExisting to stop the old copy, or pick
other ports with -Port / -DbPort. Nothing is killed unless -StopExisting is set.

.PARAMETER Dev
Run `next dev` (hot reload) instead of a production build.

.PARAMETER Port
HTTP port for the app. Default 3000 (or PORT from .env).

.PARAMETER DbPort
Postgres port. Default 5432 (or ROCKETRENTAL_DB_PORT from .env).

.PARAMETER StopExisting
Stop an existing copy holding the app/database ports: first the
'RocketRentalPreview' scheduled task and its process tree, then any remaining
listener that is a RocketRental node/postgres process. Unrelated processes are
never killed; the script reports them and exits.

.PARAMETER Seed
Run the demo seed (`npm run db:seed`). Also done automatically when the
embedded database is created for the first time.

.PARAMETER SkipInstall
Do not run npm install/ci even if node_modules is missing or stale.

.PARAMETER Rebuild
Force a production rebuild (ignored with -Dev).

.PARAMETER Docker
Start Postgres with `docker compose up -d --wait db` instead of embedded Postgres.

.PARAMETER SkipDatabase
Do not start a database; use whatever DATABASE_URL points at.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
Production build on http://localhost:3000.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -Dev -Seed
Dev server, re-seeding the demo data.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -StopExisting
Stop the old RocketRentalPreview copy, then start this one.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -Port 3100 -DbPort 5433
Run alongside an existing copy on different ports.

.NOTES
Works on Windows PowerShell 5.1 and PowerShell 7. If scripts are blocked, run
it through `powershell -ExecutionPolicy Bypass -File scripts\start.ps1`.
#>
[CmdletBinding()]
param(
    [switch]$Dev,
    [int]$Port = 0,
    [int]$DbPort = 0,
    [switch]$StopExisting,
    [switch]$Seed,
    [switch]$SkipInstall,
    [switch]$Rebuild,
    [switch]$Docker,
    [switch]$SkipDatabase
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $env:TEMP 'rocketrental'
$TaskName = 'RocketRentalPreview'

function Info($m) { Write-Host "[start] $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[start] $m" -ForegroundColor Yellow }
function Fail($m, [int]$code = 1) { Write-Host "[start] ERROR: $m" -ForegroundColor Red; exit $code }

trap {
    Fail "Unexpected startup failure: $($_.Exception.Message)"
}

# Run a native command line through cmd so npm.cmd/docker resolve; stops on failure.
function Invoke-Step($label, $cmd) {
    Info $label
    # Windows PowerShell 5.1 can turn native stderr into a terminating error
    # with ErrorActionPreference=Stop, even when the command exits successfully.
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & cmd.exe /c $cmd 2>&1 | ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                Write-Host $_.Exception.Message
            } else {
                Write-Host $_
            }
        }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($code -ne 0) { Fail "$label failed (exit $code)." }
}

function Stop-Tree($processId) {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & taskkill.exe /PID $processId /T /F 2>&1 | Out-Null
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($code -ne 0 -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
        } catch {
            Warn "Could not stop PID $processId (taskkill exit $code): $($_.Exception.Message)"
        }
    }
}

Set-Location $Root

# ---------------------------------------------------------------- prerequisites
$missing = @()
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    $missing += 'Node.js 22+ (https://nodejs.org) - `node` not found on PATH'
} else {
    $v = (& node -v).TrimStart('v')
    if ($LASTEXITCODE -ne 0) { Fail "Unable to read the Node.js version (exit $LASTEXITCODE)." }
    if ([int]($v.Split('.')[0]) -lt 22) { $missing += "Node.js 22+ (found $v)" }
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { $missing += 'npm - `npm` not found on PATH' }
if ($Docker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $missing += 'Docker Desktop (needed for -Docker) - `docker` not found on PATH; omit -Docker to use embedded Postgres'
    } else {
        $previousPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & docker info *> $null
            $dockerCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousPreference
        }
        if ($dockerCode -ne 0) { $missing += 'Docker is installed but its engine is not running - start Docker Desktop' }
    }
}
if ($missing.Count -gt 0) {
    Write-Host '[start] Missing prerequisites:' -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
$nodeVersion = & node -v
if ($LASTEXITCODE -ne 0) { Fail "Unable to read the Node.js version (exit $LASTEXITCODE)." }
$npmVersion = & cmd.exe /c npm -v
if ($LASTEXITCODE -ne 0) { Fail "Unable to read the npm version (exit $LASTEXITCODE)." }
Info "Node $nodeVersion, npm $npmVersion"

# ---------------------------------------------------------------- .env
$envFile = Join-Path $Root '.env'
if (-not (Test-Path $envFile)) {
    $doc = Join-Path $Root 'docs\environment.md'
    $example = @('env.example', '.env.example') | ForEach-Object { Join-Path $Root $_ } |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    $content = $null
    if (Test-Path $doc) {
        $m = [regex]::Match((Get-Content $doc -Raw), '(?s)```dotenv\r?\n(.*?)```')
        if ($m.Success) { $content = $m.Groups[1].Value }
    }
    if ($content) {
        Set-Content -Path $envFile -Value $content -Encoding UTF8
        Info 'Created .env from the sandbox block in docs\environment.md (no live provider keys).'
    } elseif ($example) {
        Copy-Item $example $envFile
        Info "Created .env from $(Split-Path -Leaf $example)."
    } else {
        Fail 'No .env and no env.example / .env.example / docs\environment.md to create it from.'
    }
} else {
    Info 'Using existing .env.'
}

# Read simple KEY=VALUE pairs from .env (explicit environment variables win).
$dotenv = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*?)"?\s*$') { $dotenv[$Matches[1]] = $Matches[2] }
}
if ($Port -le 0) { $Port = if ($env:PORT) { [int]$env:PORT } elseif ($dotenv['PORT']) { [int]$dotenv['PORT'] } else { 3000 } }
if ($DbPort -le 0) {
    $DbPort = if ($env:ROCKETRENTAL_DB_PORT) { [int]$env:ROCKETRENTAL_DB_PORT }
              elseif ($dotenv['ROCKETRENTAL_DB_PORT']) { [int]$dotenv['ROCKETRENTAL_DB_PORT'] } else { 5432 }
}
$env:PORT = "$Port"
$env:ROCKETRENTAL_DB_PORT = "$DbPort"
if (-not $env:ROCKETRENTAL_AUTH_COOKIE_SECURE -and -not $dotenv['ROCKETRENTAL_AUTH_COOKIE_SECURE']) { $env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false' }
if (-not $env:ROCKETRENTAL_SANDBOX -and -not $dotenv['ROCKETRENTAL_SANDBOX']) { $env:ROCKETRENTAL_SANDBOX = 'true' }
if (-not $env:ROCKETRENTAL_AUTH_SECRET -and -not $dotenv['ROCKETRENTAL_AUTH_SECRET']) {
    $env:ROCKETRENTAL_AUTH_SECRET = 'local-dev-only-secret-not-for-production-0123456789'
}
# Keep DATABASE_URL aligned with the chosen Postgres port.
if (-not $SkipDatabase) {
    $url = if ($env:DATABASE_URL) { $env:DATABASE_URL } elseif ($dotenv['DATABASE_URL']) { $dotenv['DATABASE_URL'] } else {
        'postgresql://rocketrental:rocketrental@localhost:5432/rocketrental?schema=public' }
    $env:DATABASE_URL = [regex]::Replace($url, '(@(?:localhost|127\.0\.0\.1)):\d+', "`$1:$DbPort")
}
Info "Using app port $Port and database port $DbPort."

# ---------------------------------------------------------------- port conflicts
function Get-Ancestry($processId) {
    $chain = @()
    $cur = $processId
    for ($i = 0; $i -lt 8 -and $cur; $i++) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue
        if (-not $p) { break }
        $chain += $p
        $cur = $p.ParentProcessId
        if ($cur -eq 0) { break }
    }
    $chain
}

function Get-PortHolders([int]$p) {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    foreach ($procId in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $chain = @(Get-Ancestry $procId)
        $self = if ($chain.Count) { $chain[0] } else { $null }
        $text = ($chain | ForEach-Object { $_.CommandLine }) -join ' '
        [pscustomobject]@{
            Port = $p; Pid = $procId
            Name = if ($self) { $self.Name } else { '?' }
            CommandLine = if ($self) { $self.CommandLine } else { '' }
            IsRocketRental = [bool]($text -match 'preview\.mjs|start-rocketrental|local-postgres|RocketRental')
            ViaTask = [bool]($text -match 'preview\.mjs|start-rocketrental')
        }
    }
}

function Test-PortAvailable([int]$p) {
    foreach ($address in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::IPv6Loopback)) {
        $client = [System.Net.Sockets.TcpClient]::new($address.AddressFamily)
        try {
            $client.Connect($address, $p)
            return $false
        } catch [System.Net.Sockets.SocketException] {
            # No listener on this loopback address; check the other family.
        } finally {
            $client.Close()
        }
    }
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $p)
    $listener.Server.ExclusiveAddressUse = $true
    try {
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        $listener.Stop()
    }
}

function Get-PreviewTask {
    Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}

$ports = @($Port)
if (-not $SkipDatabase) { $ports += $DbPort }
Info "Checking required ports: $(($ports -join ', '))."
$holders = @($ports | ForEach-Object { Get-PortHolders $_ })
foreach ($p in $ports) {
    if (-not (Test-PortAvailable $p) -and -not @($holders | Where-Object { $_.Port -eq $p }).Count) {
        # Process enumeration can be denied even though a listener owns the port.
        $holders += [pscustomobject]@{
            Port = $p; Pid = '?'; Name = '?'; CommandLine = ''
            IsRocketRental = $false; ViaTask = $false
        }
    }
}

if ($holders.Count -gt 0) {
    $task = Get-PreviewTask
    Warn 'Port conflict:'
    foreach ($h in $holders) {
        $role = if ($h.Port -eq $Port) { 'app' } else { 'database' }
        Warn ("  port {0} ({1}) is held by PID {2} {3}" -f $h.Port, $role, $h.Pid, $h.Name)
        if ($h.CommandLine) { Warn "    $($h.CommandLine)" }
        elseif ($h.Name -eq '?') { Warn '    (process details not visible - it may belong to another user/session or a RocketRentalPreview copy)' }
        if ($h.ViaTask -and $task) { Warn "    -> started by scheduled task '$TaskName' (state: $($task.State))" }
    }
    if (-not $StopExisting) {
        Warn 'Nothing was stopped. Options:'
        Warn "  - re-run with -StopExisting to stop the old copy (scheduled task '$TaskName' and its processes)"
        Warn '  - or use other ports: -Port 3100 -DbPort 5433'
        Fail 'Required port is already in use.' 2
    }

    Info 'Stopping existing copy (-StopExisting)...'
    $task = Get-PreviewTask
    if ($task -and $task.State -eq 'Running') {
        Info "Stopping scheduled task '$TaskName'"
        Stop-ScheduledTask -TaskName $TaskName
    }
    foreach ($h in $holders | Where-Object { $_.ViaTask }) {
        # Kill the launcher (node scripts\preview.mjs) tree so it cannot respawn children.
        $launcher = Get-Ancestry $h.Pid | Where-Object { $_.CommandLine -match 'preview\.mjs' } | Select-Object -First 1
        if ($launcher) { Info "Stopping launcher PID $($launcher.ProcessId)"; Stop-Tree $launcher.ProcessId }
    }
    Start-Sleep -Seconds 2
    $still = @($ports | ForEach-Object { Get-PortHolders $_ })
    $unrelated = @($still | Where-Object { -not $_.IsRocketRental })
    if ($unrelated.Count -gt 0) {
        $unrelated | ForEach-Object { Warn "Port $($_.Port) is held by unrelated process PID $($_.Pid) $($_.Name); not killing it." }
        Fail 'Free that port yourself or choose -Port / -DbPort.'
    }
    foreach ($h in $still) { Info "Stopping leftover RocketRental process PID $($h.Pid) ($($h.Name))"; Stop-Tree $h.Pid }
    Start-Sleep -Seconds 2
    $final = @($ports | ForEach-Object { Get-PortHolders $_ })
    if ($final.Count -gt 0) { Fail "Ports still in use: $(($final | ForEach-Object { $_.Port }) -join ', ')." }
    Info 'Ports are free.'
} else {
    Info 'Required ports are free.'
}

# ---------------------------------------------------------------- dependencies
if (-not $SkipInstall) {
    $nm = Join-Path $Root 'node_modules'
    $stamp = Join-Path $nm '.package-lock.json'
    $lock = Join-Path $Root 'package-lock.json'
    $stale = (-not (Test-Path $nm)) -or (-not (Test-Path $stamp)) -or
        ((Test-Path $lock) -and ((Get-Item $lock).LastWriteTime -gt (Get-Item $stamp).LastWriteTime)) -or
        ((Get-Item (Join-Path $Root 'package.json')).LastWriteTime -gt (Get-Item $stamp).LastWriteTime)
    if ($stale) {
        $cmd = if (Test-Path $lock) { 'npm ci' } else { 'npm install' }
        Invoke-Step "Installing dependencies ($cmd)" $cmd
    } else {
        Info 'Dependencies are up to date.'
    }
} elseif (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Fail '-SkipInstall given but node_modules is missing.'
} else {
    Info 'Dependency install skipped (-SkipInstall).'
}

# ---------------------------------------------------------------- build (production)
if (-not $Dev) {
    Info 'Checking production build freshness.'
    $buildId = Join-Path $Root '.next\BUILD_ID'
    $needBuild = $Rebuild -or -not (Test-Path $buildId)
    if (-not $needBuild) {
        $built = (Get-Item $buildId).LastWriteTime
        foreach ($relativePath in @('src', 'prisma\schema.prisma', 'package.json', 'next.config.ts')) {
            $p = Join-Path $Root $relativePath
            if (Test-Path -LiteralPath $p -PathType Container) {
                $files = Get-ChildItem -LiteralPath $p -Recurse -File
            } elseif (Test-Path -LiteralPath $p -PathType Leaf) {
                $files = @(Get-Item -LiteralPath $p)
            } else {
                continue
            }
            foreach ($file in $files) {
                if ($file.LastWriteTime -gt $built) { $needBuild = $true; break }
            }
            if ($needBuild) { break }
        }
    }
    if ($needBuild) { Invoke-Step 'Building (npm run build)' 'npm run build' } else { Info 'Production build is up to date.' }
} else {
    Info 'Development mode; production build skipped.'
}

# ---------------------------------------------------------------- database
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$dbProc = $null
$seedMarker = $null
$app = $null

function Stop-All {
    if ($app -and -not $app.HasExited) { Info 'Stopping app...'; Stop-Tree $app.Id }
    if ($dbProc -and -not $dbProc.HasExited) {
        Info 'Stopping embedded Postgres...'
        $pgCtl = Get-ChildItem (Join-Path $Root 'prisma\node_modules\@embedded-postgres') -Recurse -Filter pg_ctl.exe -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pgCtl -and $dbDir -and (Test-Path (Join-Path $dbDir 'postmaster.pid'))) {
            $previousPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                & $pgCtl.FullName -D $dbDir stop -m fast 2>&1 | ForEach-Object { Write-Host $_ }
                $code = $LASTEXITCODE
            } finally {
                $ErrorActionPreference = $previousPreference
            }
            if ($code -ne 0) { Warn "Postgres shutdown returned exit $code." }
        }
        Stop-Tree $dbProc.Id
    }
}

try {
    if ($SkipDatabase) {
        Info 'Skipping database start (-SkipDatabase); using DATABASE_URL from the environment/.env.'
    } elseif ($Docker) {
        $env:ROCKETRENTAL_DB_PORT = "$DbPort"
        Invoke-Step 'Starting Postgres with docker compose' 'docker compose up -d --wait db'
    } else {
        $dbDir = if ($env:ROCKETRENTAL_DB_DIR) { $env:ROCKETRENTAL_DB_DIR } elseif ($dotenv['ROCKETRENTAL_DB_DIR']) { $dotenv['ROCKETRENTAL_DB_DIR'] } else { Join-Path $Root 'prisma\.local-postgres' }
        $seedMarker = Join-Path $dbDir '.demo-seeded'
        New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
        if (-not (Test-Path (Join-Path $Root 'prisma\node_modules\embedded-postgres'))) {
            Invoke-Step 'Installing embedded Postgres (npm install --prefix prisma)' 'npm install --prefix prisma'
        }
        Info "Starting embedded Postgres on port $DbPort (first run downloads/initialises the data dir)"
        $dbOut = Join-Path $LogDir 'postgres.out.log'
        $dbErr = Join-Path $LogDir 'postgres.err.log'
        Remove-Item $dbOut, $dbErr -ErrorAction SilentlyContinue
        $dbProc = Start-Process -FilePath node -ArgumentList '--import', './prisma/os-userinfo.mjs', 'prisma/local-postgres.mjs' `
            -WorkingDirectory $Root -NoNewWindow -PassThru -RedirectStandardOutput $dbOut -RedirectStandardError $dbErr
        $deadline = (Get-Date).AddSeconds(120)
        while ($true) {
            if ($dbProc.HasExited) {
                Get-Content $dbErr -ErrorAction SilentlyContinue | Select-Object -Last 15 | ForEach-Object { Write-Host $_ }
                $dbExit = if ($null -eq $dbProc.ExitCode) { 'unavailable' } else { $dbProc.ExitCode }
                Fail "Embedded Postgres exited early (exit $dbExit). See $dbErr"
            }
            if ((Test-Path $dbOut) -and (Select-String -Path $dbOut -Pattern 'Local PostgreSQL ready' -Quiet)) { break }
            if ((Get-Date) -gt $deadline) { Fail "Timed out waiting for Postgres. See $dbOut / $dbErr" }
            Start-Sleep -Milliseconds 500
        }
        Info "Postgres ready on port $DbPort."
    }

    # ------------------------------------------------------------ migrations / seed
    Invoke-Step 'Applying migrations (npm run db:migrate)' 'npm run db:migrate'
    if ($Seed -or ($seedMarker -and -not (Test-Path $seedMarker))) {
        $prevEnv = $env:NODE_ENV
        $env:NODE_ENV = 'development'
        # The tsx CLI starts a child that bypasses the os.userInfo preload on
        # restricted Windows hosts. Node's import hook runs the seed directly.
        Invoke-Step 'Seeding demo data (node --import tsx prisma/seed.ts)' 'node --env-file-if-exists=.env --import ./prisma/os-userinfo.mjs --import tsx prisma/seed.ts'
        $env:NODE_ENV = $prevEnv
        if ($seedMarker) { Set-Content -Path $seedMarker -Value 'seeded' -Encoding Ascii }
    } else {
        Info 'Demo seed is up to date.'
    }

    # ------------------------------------------------------------ app
    $nextBin = Join-Path $Root 'node_modules\next\dist\bin\next'
    $mode = if ($Dev) { 'dev' } else { 'start' }
    $env:NODE_ENV = if ($Dev) { 'development' } else { 'production' }
    $appOut = Join-Path $LogDir 'app.out.log'
    $appErr = Join-Path $LogDir 'app.err.log'
    Remove-Item $appOut, $appErr -ErrorAction SilentlyContinue
    Info "Starting Next.js ($mode) on port $Port"
    $app = Start-Process -FilePath node -ArgumentList "`"$nextBin`"", $mode, '-p', "$Port" `
        -WorkingDirectory $Root -NoNewWindow -PassThru -RedirectStandardOutput $appOut -RedirectStandardError $appErr

    $url = "http://localhost:$Port"
    $deadline = (Get-Date).AddSeconds(180)
    $ok = $false
    while (-not $ok) {
        if ($app.HasExited) {
            Get-Content $appErr, $appOut -ErrorAction SilentlyContinue | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
            $appExit = if ($null -eq $app.ExitCode) { 'unavailable' } else { $app.ExitCode }
            Fail "Next.js exited early (exit $appExit)."
        }
        if ((Get-Date) -gt $deadline) { Fail "App did not respond at $url within 180s. See $appOut / $appErr" }
        try {
            $r = Invoke-WebRequest -Uri "$url/sign-in" -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { $ok = $true }
        } catch { Start-Sleep -Seconds 1 }
    }

    Write-Host ''
    Info "RocketRental is running at $url (sign in at $url/sign-in)"
    Write-Host '  Manager: jordan.mills@rocketrental.example / JordanDemo#2026'
    Write-Host '  Tenant:  alex.rivera@email.com / AlexDemo#2026'
    Write-Host "  Logs:    $LogDir"
    Write-Host '  Press Ctrl+C to stop.'
    Write-Host ''
    $app.WaitForExit()
    $appExit = if ($null -eq $app.ExitCode) { 'unavailable' } else { $app.ExitCode }
    Info "App exited (code $appExit)."
    if ($appExit -ne 0) { Fail "App exited with code $appExit." }
} finally {
    Stop-All
}
