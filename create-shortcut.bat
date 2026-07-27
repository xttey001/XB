@echo off
chcp 65001 > nul
title 创建 XB 笔记桌面快捷方式

REM ============================================================
REM  双击运行此 .bat 会调用同名 .ps1 脚本
REM  绕过 PowerShell 执行策略限制
REM ============================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
