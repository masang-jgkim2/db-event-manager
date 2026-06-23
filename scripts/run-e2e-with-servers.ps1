# E2E: 서버 자동 기동 → 테스트 → 종료 (레거시 래퍼 — 전체 playwright)
# 권장: .\scripts\run-e2e.ps1 -Profile human -WithServers

& "$PSScriptRoot\run-e2e.ps1" -Profile full -WithServers @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
