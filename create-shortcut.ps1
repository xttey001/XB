# ============================================================
#  XB Notes - Create Desktop Shortcut
#  Pure PowerShell script (no encoding issues)
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   XB Notes - Create Desktop Shortcut" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectPath = "d:\XB"
$ScriptPath = Join-Path $ProjectPath "start-xb-notes.vbs"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "XB Notes.lnk"

# Check launcher script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "[ERROR] Launcher script not found: $ScriptPath" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# Create shortcut
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ScriptPath
$Shortcut.WorkingDirectory = $ProjectPath
$Shortcut.IconLocation = "shell32.dll,13"
$Shortcut.Description = "启动 XB Notes (http://localhost:3300)"
$Shortcut.Save()

# Verify
if (Test-Path $ShortcutPath) {
    Write-Host "[OK] Shortcut created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Location: $ShortcutPath" -ForegroundColor White
    Write-Host "  Target:   $ScriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "  Double-click the 'XB Notes' icon on your desktop to launch." -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] Shortcut creation failed" -ForegroundColor Red
    Write-Host "Try right-click -> Run as administrator." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to close this window"
