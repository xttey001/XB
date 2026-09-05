@echo off
setlocal

rem ====== Git Push Shortcut ======
rem Usage: push.bat "commit message"  or  push.bat (auto message)

cd /d "%~dp0"

rem Check if git repo
if not exist ".git" (
    echo [ERROR] Not a git repository
    pause
    exit /b 1
)

rem Check for changes
git status --porcelain | findstr /r ".*" >nul
if errorlevel 1 (
    echo [INFO] No changes to commit
    pause
    exit /b 0
)

rem Build commit message
if "%~1"=="" (
    for /f "delims=" %%c in ('git status --porcelain ^| find /c /v ""') do set COUNT=%%c
) else (
    set MSG=%~1
)

echo.
echo ============ Git Push ============
echo Message: %~1
echo.

rem Add all changes
git add -A
if errorlevel 1 (
    echo [ERROR] git add failed
    pause
    exit /b 1
)

rem Commit
if "%~1"=="" (
    git commit -m "sync: %COUNT% files updated"
) else (
    git commit -m "%~1"
)
if errorlevel 1 (
    echo [ERROR] git commit failed
    pause
    exit /b 1
)

rem Push
git push origin main
if errorlevel 1 (
    echo [ERROR] git push failed
    pause
    exit /b 1
)

echo.
echo [DONE] Push success!
pause
endlocal