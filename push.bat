@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo    XB Notes - Auto Dual Push
echo ========================================
echo.

rem === Step 1: Export ===
echo [1/3] Exporting data...
node scripts\export-static.js
if errorlevel 1 (
    echo [ERROR] Export failed!
    pause
    exit /b 1
)

rem === Step 2: Push gh-pages ===
echo.
echo [2/3] Pushing static site to gh-pages...
cd public-site
node ..\scripts\bump-cache.js
git add data/ assets/uploads/ index.html
git commit -m "sync data + bump cache" >nul 2>&1
git push origin gh-pages
echo      gh-pages done
cd /d "%~dp0"

rem === Step 3: Push main ===
echo.
echo [3/3] Pushing Next.js to main...
git add -A
git commit -m "sync files" >nul 2>&1
if not errorlevel 1 (
    git push origin main
    echo      main done
) else (
    echo      no code changes, skip
)

echo.
echo ========================================
echo    All done! Refresh phone to see notes.
echo ========================================
echo.
pause