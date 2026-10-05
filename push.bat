@echo off
setlocal enabledelayedexpansion

rem ====== XB Notes 一键双推 ======
rem 用户双击 push.bat → 自动：
rem   1. 导出静态站数据（Prisma dev.db → public-site/data/ + uploads）
rem   2. 推静态站到 gh-pages 分支（手机 GitHub Pages 能看到）
rem   3. 推 Next.js 代码到 main 分支

cd /d "%~dp0"

echo.
echo ========================================
echo    XB Notes 一键双推
echo ========================================
echo.

rem ========================================
rem STEP 0: 清理 git lock（Windows 上常卡）
rem ========================================
echo [0/3] 清理 git lock...
taskkill /f /im git.exe >nul 2>&1
timeout /t 1 /nobreak >nul
for /r ".git" %%f in (*.lock) do del /f "%%f" >nul 2>&1
if exist "public-site\.git" (
    for /r "public-site\.git" %%f in (*.lock) do del /f "%%f" >nul 2>&1
)

rem ========================================
rem STEP 1: 导出数据 + 推静态站
rem ========================================
echo.
echo [1/3] 导出静态站数据...
node scripts\export-static.js
if errorlevel 1 (
    echo [ERROR] 导出失败！检查 dev.db 和 Prisma
    pause
    exit /b 1
)

echo.
echo [2/3] 推静态站到 GitHub Pages...
cd public-site

rem bump 缓存版本号（styles.css?v=N, app.js?v=N 各 +1）
node ..\scripts\bump-cache.js

git status --porcelain data/ assets/uploads/ index.html | findstr /r ".*" >nul
if not errorlevel 1 (
    git add data/ assets/uploads/ index.html
    git commit -m "sync data + bump cache"
    if errorlevel 1 (
        echo [WARN] commit 失败，跳过静态站 push
        goto :SKIP_STATIC
    )
    git push origin gh-pages
    if errorlevel 1 (
        echo [ERROR] 静态站 push 失败！
        pause
        exit /b 1
    )
    echo      gh-pages push done  ^^(手机刷新就能看到新笔记^^)
) else (
    echo      静态站数据无变化，跳过
)
:SKIP_STATIC

cd /d "%~dp0"

rem ========================================
rem STEP 2: 推 Next.js 代码
rem ========================================
echo.
echo [3/3] 检查 Next.js 代码改动...

if not exist ".git" goto :END

rem 排除 public-site（独立仓库）
git status --porcelain | findstr /v "^.*public-site" | findstr /r ".*" >nul
if errorlevel 1 (
    echo      无代码改动，跳过 main push
    goto :END
)

rem 算改动文件数
set /a CNT=0
for /f "delims=" %%c in ('git status --porcelain ^| findstr /v "^.*public-site" ^| find /c /v ""') do set CNT=%%c

if "%~1"=="" (
    set "MSG=sync: !CNT! files updated"
) else (
    set "MSG=%~1"
)

git add -A
git commit -m "!MSG!" >nul 2>&1
if errorlevel 1 (
    echo [WARN] commit 失败，跳过 main push
    goto :END
)

git push origin main
if errorlevel 1 (
    echo [ERROR] main push 失败！
    pause
    exit /b 1
)
echo      main push done

:END
echo.
echo ========================================
echo    全部完成！手机刷新 GitHub Pages 就能看到新笔记了
echo ========================================
echo.
pause
endlocal
