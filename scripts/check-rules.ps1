# Usage: .\scripts\check-rules.ps1

$strRootPath = Split-Path $PSScriptRoot -Parent
$strLastCheck = Join-Path $PSScriptRoot ".last-rules-check"

$dtLastCheck = if (Test-Path $strLastCheck) {
    Get-Content $strLastCheck | Get-Date
} else {
    (Get-Date).AddDays(-30)
}

$arrWatchPaths = @(
    "backend\src\types\index.ts",
    "backend\src\controllers",
    "backend\src\routes",
    "backend\src\services",
    "front\src\types\index.ts",
    "front\src\pages",
    "front\src\stores",
    "front\src\hooks"
)

$arrChanged = @()
foreach ($strPath in $arrWatchPaths) {
    $strFullPath = Join-Path $strRootPath $strPath
    if (Test-Path $strFullPath) {
        $arrFiles = Get-ChildItem $strFullPath -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -gt $dtLastCheck }
        $arrChanged += $arrFiles
    }
}

if ($arrChanged.Count -eq 0) {
    Write-Host "[OK] Rules/Skills are up to date." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[!] Rules/Skills may need update." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Changed files since last check:" -ForegroundColor Cyan

    $arrHints = @{}
    foreach ($objFile in $arrChanged) {
        $strRelPath = $objFile.FullName.Replace($strRootPath + "\", "")
        Write-Host "  - $strRelPath" -ForegroundColor White

        if ($strRelPath -match "types.index")              { $arrHints["coding-standards.mdc / domain-event-instance.mdc"] = 1 }
        if ($strRelPath -match "controllers|routes")       { $arrHints["backend-patterns.mdc"] = 1 }
        if ($strRelPath -match "pages|stores|hooks")       { $arrHints["frontend-patterns.mdc"] = 1 }
        if ($strRelPath -match "eventInstanceController")  { $arrHints["domain-event-instance.mdc"] = 1 }
    }

    Write-Host ""
    Write-Host "Rules to review:" -ForegroundColor Cyan
    foreach ($strRule in $arrHints.Keys) {
        Write-Host "  -> $strRule" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Ask Cursor: 'rules/skills update'" -ForegroundColor Green
}

(Get-Date).ToString("o") | Set-Content $strLastCheck