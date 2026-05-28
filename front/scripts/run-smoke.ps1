# smoke @smoke (헤드리스) — 서버 기동 중일 때
$ErrorActionPreference = 'Stop'
$FrontDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $FrontDir '.env.e2e.local'

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $n = $matches[1].Trim()
      $v = $matches[2].Trim()
      [Environment]::SetEnvironmentVariable($n, $v, 'Process')
    }
  }
  Write-Host "[smoke] .env.e2e.local 로드"
}

try {
  $r = Invoke-WebRequest -Uri 'http://localhost:4000/api/health' -TimeoutSec 5 -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw 'health not 200' }
} catch {
  Write-Host '[smoke] SKIP: 백엔드(4000) 미응답 — npm run dev 후 재실행'
  exit 2
}

Push-Location $FrontDir
npm run test:e2e:smoke
$code = $LASTEXITCODE
Pop-Location
exit $code
