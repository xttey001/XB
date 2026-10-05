@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ========================================
echo    XB Notes 一键双推
echo ========================================
echo.

rem === STEP 0: 清 git lock ===
echo [0/3] 清理 git lock...
taskkill /f /im git.exe >nul 2>&1
timeout /t 1 /nobreak >nul
if exist ".git\*.lock" del /q ".git\*.lock" >nul 2>&1
if exist "public-site\.git\*.lock" del /q "public-site\.git\*.lock" >nul 2>&1

rem === STEP 1: 导出静态站数据 ===
echo.
echo [1/3] 导出静态站数据...
node scripts\export-static.js
if errorlevel 1 (
    echo [ERROR] 导出失败！
    pause
    exit /b 1
)

rem === STEP 2: 推静态站 ===
echo.
echo [2/3] 推静态站到 GitHub Pages...
cd public-site

node ..\scripts\bump-cache.js

git add data/ assets/uploads/ index.html
git commit -m "sync data + bump cache" >nul 2>&1
git push origin gh-pages
if errorlevel 1 (
    echo [WARN] 静态站 push 可能失败，但继续...
) else (
    echo      gh-pages done
)

cd /d "%~dp0"

rem === STEP 3: 推 Next.js 代码 ===
echo.
echo [3/3] 推 Next.js 代码...
git add -A
git commit -m "sync files" >nul 2>&1
if errorlevel 1 (
    echo      无代码改动，跳过 main push
    goto :END
)
git push origin main
if errorlevel 1 (
    echo [WARN] main push 可能失败
) else (
    echo      main done
)

:END
echo.
echo ========================================
echo    全部完成！手机刷新就能看到新笔记了
echo ========================================
echo.
pause
endlocal
