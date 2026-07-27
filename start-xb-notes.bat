@echo off
chcp 65001 > nul
title XB Notes Server

cd /d "d:\XB"

echo.
echo  ============================================
echo   XB 笔记启动中...
echo   访问地址: http://localhost:3300
echo  ============================================
echo.

REM 后台启动开发服务
start "XB-Notes-Server" /min cmd /c "npm run dev"

REM 等待服务就绪
echo  等待服务就绪...
timeout /t 4 /nobreak > nul

REM 打开浏览器
echo  正在打开浏览器...
start "" http://localhost:3300

echo.
echo  服务已在后台运行，浏览器已打开。
echo  如需停止服务，请关闭任务栏中的 "XB-Notes-Server" 窗口。
echo.
echo  按任意键关闭此启动窗口（服务不受影响）
pause > nul
