# E2E 테스트: 서버 자동 기동 → 테스트 실행 → 테스트 종료 후 서버 종료
# 사용법: 프로젝트 루트에서 .\scripts\run-e2e-with-servers.ps1

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $RootDir "backend\package.json"))) {
    Write-Error "프로젝트 루트(backend, front 포함)에서 실행해 주세요."
    exit 1
}

$BackendDir = Join-Path $RootDir "backend"
$FrontDir   = Join-Path $RootDir "front"
$PortBackend = 4000
$PortFront   = 5173

function Stop-ProcessesOnPorts {
    param([int[]]$Ports)
    foreach ($port in $Ports) {
        $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($p in ($conn | Select-Object -ExpandProperty OwningProcess -Unique)) {
            if ($p) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Write-Host "[종료] 포트 $port 프로세스 (PID $p)"
            }
        }
    }
}

# 이미 포트 사용 중이면 기존 프로세스 정리 (선택)
$existing = @(Get-NetTCPConnection -LocalPort $PortBackend,$PortFront -ErrorAction SilentlyContinue)
if ($existing.Count -gt 0) {
    Write-Host "기존 서버 프로세스 종료 중..."
    Stop-ProcessesOnPorts -Ports @($PortBackend, $PortFront)
    Start-Sleep -Seconds 2
}

Write-Host "[1/4] 백엔드 서버 기동 중 (포트 $PortBackend)..."
$null = Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden

Write-Host "[2/4] 프론트 서버 기동 중 (포트 $PortFront)..."
$null = Start-Process -FilePath "npm" -ArgumentList "run","dev","--","--port",$PortFront -WorkingDirectory $FrontDir -PassThru -WindowStyle Hidden

Write-Host "서버 준비 대기 중 (최대 30초)..."
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$PortBackend/api/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$PortFront/" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($waited -ge $maxWait) {
    Write-Error "서버가 준비되지 않았습니다. 포트 $PortBackend, $PortFront 를 확인해 주세요."
    Stop-ProcessesOnPorts -Ports @($PortBackend, $PortFront)
    exit 1
}
Write-Host "서버 준비 완료."

try {
    Write-Host "[3/4] E2E 테스트 실행 중..."
    $env:PLAYWRIGHT_BASE_URL = "http://localhost:$PortFront"
    Push-Location $FrontDir
    try {
        & npx playwright test
        $testExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} finally {
    Write-Host "[4/4] 서버 프로세스 종료 중..."
    Stop-ProcessesOnPorts -Ports @($PortBackend, $PortFront)
}

if ($testExitCode -ne 0) { exit $testExitCode }
