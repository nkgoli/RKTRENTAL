[CmdletBinding(SupportsShouldProcess)]
param([ValidateSet('Start','Launch','Status','Stop')][string]$Action='Status')
$ErrorActionPreference='Stop'
$reviewRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir=Join-Path $PSScriptRoot '.runtime'
$config=Get-Content (Join-Path $runtimeDir 'review-config.json') -Raw | ConvertFrom-Json
$stateFile=Join-Path $runtimeDir 'services.json'
$fixtureDir=Join-Path $runtimeDir 'postgres'
$baselineDir=Join-Path $runtimeDir 'app'
if($config.candidateDirectory -notmatch '^candidate(?:-[a-z0-9]+)?$'){throw 'Invalid candidate directory'}
$candidateDir=Join-Path $runtimeDir $config.candidateDirectory
$postgresExe=Join-Path $reviewRoot 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/postgres.exe'
$pgCtlExe=Join-Path $reviewRoot 'prisma/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
$nodeExe=(Get-Command node.exe).Source
$nextEntry=Join-Path $reviewRoot 'node_modules/next/dist/bin/next'
function Get-OwnedProcess($identity){
 if(-not $identity){return $null}
 $process=Get-Process -Id $identity.pid -ErrorAction SilentlyContinue
 if(-not $process){return $null}
 if($process.StartTime.ToUniversalTime().ToString('o') -ne $identity.createdUtc -or $process.Path -ne $identity.executable){throw 'Recorded process identity changed; leaving it untouched'}
 return $process
}
function Get-Identity($process,$executable){return @{pid=$process.Id;createdUtc=$process.StartTime.ToUniversalTime().ToString('o');executable=(Get-Item -LiteralPath $executable).FullName}}
function Assert-Snapshots {
 if((Get-Content (Join-Path $baselineDir '.next/BUILD_ID') -Raw).Trim() -ne $config.baselineBuild){throw 'Baseline build changed'}
 if((Get-Content (Join-Path $candidateDir '.next/BUILD_ID') -Raw).Trim() -ne $config.candidateBuild){throw 'Candidate build changed'}
 foreach($entry in $config.sourceFiles){
  if((Get-FileHash -LiteralPath (Join-Path $candidateDir $entry.path)).Hash -ne $entry.sha256){throw "Candidate source differs: $($entry.path)"}
 }
}
function Assert-Ready {
 Assert-Snapshots
 if(-not(Test-Path (Join-Path $fixtureDir 'PG_VERSION'))){throw 'Isolated fixture missing'}
 if(Test-Path (Join-Path $fixtureDir 'postmaster.pid')){throw 'Fixture has a PID file; reconcile ownership first'}
 if(@(Get-NetTCPConnection -LocalPort 3231,3232,55431 -State Listen -ErrorAction SilentlyContinue).Count){throw 'Review port occupied; no process replaced'}
 if(Test-Path $stateFile){
  $old=Get-Content $stateFile -Raw | ConvertFrom-Json
  foreach($identity in @($old.postgres,$old.baseline,$old.candidate)){if(Get-OwnedProcess $identity){throw 'A recorded service still runs'}}
 }
}
function Start-Next($directory,$port,$label){
 $stem=$label+'-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
 $process=Start-Process -FilePath $nodeExe -ArgumentList @(('"{0}"' -f $nextEntry),'start','-p',[string]$port,'-H','127.0.0.1') -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir ($stem+'.stdout.log')) -RedirectStandardError (Join-Path $runtimeDir ($stem+'.stderr.log'))
 return (Get-Identity $process $nodeExe)
}
if($Action -eq 'Start'){
 Assert-Ready
 $powershellExe=(Get-Command powershell.exe).Source
 $startup=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}
 $commandLine='"{0}" -NoProfile -NonInteractive -WindowStyle Hidden -File "{1}" -Action Launch' -f $powershellExe,$PSCommandPath
 $result=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$commandLine;CurrentDirectory=$reviewRoot;ProcessStartupInformation=$startup}
 if($result.ReturnValue -ne 0){throw "Hidden launcher failed: $($result.ReturnValue)"}
 [pscustomobject]@{launcherPid=$result.ProcessId;stateFile=$stateFile;candidateCommit=$config.candidateCommit} | ConvertTo-Json
 return
}
if($Action -eq 'Launch'){
 try{
  Assert-Ready
  $state=@{checkout=$reviewRoot;candidateCommit=$config.candidateCommit;candidateBuild=$config.candidateBuild;baselineBuild=$config.baselineBuild;launcherPid=$PID;postgres=$null;baseline=$null;candidate=$null}
  $process=Start-Process -FilePath $postgresExe -ArgumentList @('-D',('"{0}"' -f $fixtureDir),'-p','55431','-h','127.0.0.1') -WorkingDirectory $reviewRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'postgres.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'postgres.stderr.log')
  $state.postgres=Get-Identity $process $postgresExe
  $state | ConvertTo-Json -Depth 5 | Set-Content $stateFile -Encoding UTF8
  $env:DATABASE_URL='postgresql://rocketrental:rocketrental@127.0.0.1:55431/rocketrental?schema=public'
  $secretBytes=New-Object byte[] 48
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($secretBytes)}finally{$rng.Dispose()}
  $env:ROCKETRENTAL_AUTH_SECRET=[Convert]::ToBase64String($secretBytes)
  $env:ROCKETRENTAL_AUTH_COOKIE_SECURE='false'
  $env:STORAGE_LOCAL_DIR=Join-Path $runtimeDir 'storage'
  $state.baseline=Start-Next $baselineDir 3231 'baseline'
  $state | ConvertTo-Json -Depth 5 | Set-Content $stateFile -Encoding UTF8
  $state.candidate=Start-Next $candidateDir 3232 'candidate'
  $state | ConvertTo-Json -Depth 5 | Set-Content $stateFile -Encoding UTF8
 }catch{$_.Exception.Message | Set-Content (Join-Path $runtimeDir 'launch-error.log');throw}
 finally{$env:ROCKETRENTAL_AUTH_SECRET=$null;if($secretBytes){[Array]::Clear($secretBytes,0,$secretBytes.Length)}}
 return
}
if(-not(Test-Path $stateFile)){throw 'No services have been recorded'}
$state=Get-Content $stateFile -Raw | ConvertFrom-Json
if($state.checkout -ne $reviewRoot){throw 'Service state belongs to another checkout'}
$postgres=Get-OwnedProcess $state.postgres
$baseline=Get-OwnedProcess $state.baseline
$candidate=Get-OwnedProcess $state.candidate
if($Action -eq 'Stop'){
 foreach($process in @($baseline,$candidate)){if($process -and $PSCmdlet.ShouldProcess("Next PID $($process.Id)",'Stop verified review process')){Stop-Process -Id $process.Id}}
 if($postgres){
  if((Get-Content (Join-Path $fixtureDir 'postmaster.pid') -TotalCount 1).Trim() -ne [string]$postgres.Id){throw 'Fixture PID changed; database untouched'}
  if($PSCmdlet.ShouldProcess("PostgreSQL PID $($postgres.Id)",'Stop isolated fixture')){& $pgCtlExe stop -D $fixtureDir -m fast -w;if($LASTEXITCODE -ne 0){throw 'Database shutdown failed'}}
 }
 return
}
Assert-Snapshots
$http=foreach($port in @(3231,3232)){
 try{$response=Invoke-WebRequest -Uri "http://localhost:$port/sign-in" -UseBasicParsing -TimeoutSec 10;@{port=$port;status=[int]$response.StatusCode;signIn=$response.Content.Contains('Email address')}}catch{@{port=$port;error=$_.Exception.Message}}
}
[pscustomobject]@{observedUtc=[DateTime]::UtcNow.ToString('o');checkout=$reviewRoot;candidateCommit=$config.candidateCommit;candidateBuild=$config.candidateBuild;baselineBuild=$config.baselineBuild;postgresRunning=[bool]$postgres;baselineRunning=[bool]$baseline;candidateRunning=[bool]$candidate;identities=$state;http=@($http);listeners=@(Get-NetTCPConnection -LocalPort 3231,3232,55431 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess)} | ConvertTo-Json -Depth 6
