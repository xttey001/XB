@echo off
chcp 65001 > nul
title XB 笔记 (开发模式)

REM ============================================================
REM  XB 笔记 - 开发模式启动脚本
REM  端口: 3300，支持热更新
REM ============================================================

cd /d "d:\XB"

echo.
echo  ============================================
echo   XB 笔记启动中 (开发模式)...
echo   访问地址: http://localhost:3300
echo  ============================================
echo.

REM 后台启动 dev server
start "XB-Notes-Dev" /min cmd /c "npm run dev"

REM 等待服务就绪（dev 启动比生产慢）
echo  等待服务就绪...
timeout /t 5 /nobreak > nul

REM 打开默认浏览器
start "" http://localhost:3300

echo.
echo  浏览器已打开。
echo  关闭服务：关闭任务栏中最小化的 "XB-Notes-Dev" 窗口
echo  或按 Ctrl+C 在那个窗口里停止。
echo.
pause > nul
