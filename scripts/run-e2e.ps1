# DQPM E2E runner (project root)
#   .\scripts\run-e2e.ps1 -Profile human -WithServers

param(
  [ValidateSet('smoke', 'human', 'workflow', 'full')]
  [string]$Profile = 'smoke',
  [switch]$WithServers,
  [switch]$Headed
)

$ErrorActionPreference = 'Stop'
$RootDir = $PSScriptRoot | Split-Path -Parent
if (-not (Test-Path (Join-Path $RootDir 'backend\package.json'))) {
  Write-Error 'Run from project root (backend + front).'
  exit 1
}
$BackendDir = Join-Path $RootDir 'backend'
$FrontDir = Join-Path $RootDir 'front'
$PortBackend = 4000
$PortFront = 5173

function Stop-ProcessesOnPorts {
  param([int[]]$Ports)
  foreach ($port in $Ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($p in ($conn | Select-Object -ExpandProperty OwningProcess -Unique)) {
      if ($p) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Write-Host "[e2e] stopped port $port PID=$p"
      }
    }
  }
}

function Wait-ServersReady {
  $maxWait = 120
  $waited = 0
  while ($waited -lt $maxWait) {
    $bBack = $false
    $bFront = $false
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$PortBackend/api/health" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $bBack = $true }
    } catch {}
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$PortFront/" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $bFront = $true }
    } catch {}
    if ($bBack -and $bFront) { return }
    Start-Sleep -Seconds 2
    $waited += 2
  }
  throw "servers not ready on $PortBackend / $PortFront"
}

function Start-E2eServers {
  $existing = @(Get-NetTCPConnection -LocalPort $PortBackend, $PortFront -ErrorAction SilentlyContinue)
  if ($existing.Count -gt 0) {
    Write-Host '[e2e] clearing ports 4000/5173...'
    Stop-ProcessesOnPorts -Ports @($PortBackend, $PortFront)
    Start-Sleep -Seconds 2
  }
  $env:E2E_ALLOW_RELOAD = '1'
  Write-Host "[e2e] backend :$PortBackend"
  $null = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden
  Write-Host "[e2e] frontend :$PortFront"
  $null = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev', '--', '--port', "$PortFront" -WorkingDirectory $FrontDir -PassThru -WindowStyle Hidden
  Wait-ServersReady
  Write-Host '[e2e] servers ready'
}

function Invoke-E2eInitPasswords {
  if (-not $env:E2E_INIT_SECRET) { return }
  try {
    $body = @{ secret = $env:E2E_INIT_SECRET } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:$PortBackend/api/admin/init-e2e-passwords" -Method POST -Body $body -ContentType 'application/json'
    Write-Host '[e2e] init-e2e-passwords ok'
  } catch {
    Write-Host "[e2e] init-e2e-passwords skip | $($_.Exception.Message)"
  }
}

function Invoke-E2eSeedWorkflow {
  Push-Location $BackendDir
  npm run seed-e2e-workflow:fresh
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[e2e] seed fresh failed, retry seed-e2e-workflow'
    npm run seed-e2e-workflow
  }
  Pop-Location
}

function Invoke-Playwright {
  param([string[]]$arrArgs)
  Push-Location $FrontDir
  $env:PLAYWRIGHT_BASE_URL = "http://localhost:$PortFront"
  & npx playwright test @arrArgs
  $nCode = $LASTEXITCODE
  Pop-Location
  return $nCode
}

$EnvFile = Join-Path $FrontDir '.env.e2e.local'
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -gt 0) {
      $key = $line.Substring(0, $idx).Trim()
      $val = $line.Substring($idx + 1).Trim()
      [Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
  }
  Write-Host '[e2e] loaded front/.env.e2e.local'
}

$bStartedServers = $false
if ($WithServers) {
  Start-E2eServers
  $bStartedServers = $true
} else {
  try {
    Wait-ServersReady
  } catch {
    Write-Host '[e2e] servers down — use -WithServers'
    exit 2
  }
}

Invoke-E2eInitPasswords
$arrHeaded = @()
if ($Headed) { $arrHeaded = @('--headed') }

$nExit = 0
try {
  switch ($Profile) {
    'smoke' {
      Write-Host '[e2e] Profile=smoke'
      $nExit = Invoke-Playwright -arrArgs (@('--project=smoke') + $arrHeaded)
    }
    'workflow' {
      Write-Host '[e2e] Profile=workflow (create through delete)'
      Invoke-E2eSeedWorkflow
      $nExit = Invoke-Playwright -arrArgs (@('--project=workflow') + $arrHeaded)
    }
    'human' {
      Write-Host '[e2e] Profile=human (smoke + workflow + delete)'
      $nExit = Invoke-Playwright -arrArgs (@('--project=smoke') + $arrHeaded)
      if ($nExit -ne 0) { break }
      Invoke-E2eSeedWorkflow
      $nExit = Invoke-Playwright -arrArgs (@('--project=workflow') + $arrHeaded)
    }
    'full' {
      Write-Host '[e2e] Profile=full (all playwright)'
      Invoke-E2eSeedWorkflow
      npm run seed-e2e-result-ui --prefix $BackendDir 2>$null
      $nExit = Invoke-Playwright -arrArgs $arrHeaded
    }
  }
} finally {
  if ($bStartedServers) {
    Write-Host '[e2e] stopping servers'
    Stop-ProcessesOnPorts -Ports @($PortBackend, $PortFront)
  }
}

exit $nExit
