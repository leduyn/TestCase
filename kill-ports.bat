@echo off
title Kill Ports 3001 & 5173
chcp 65001 >nul
echo.
echo Đang dừng tiến trình trên port 3001 va 5173...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\kill-ports.ps1"
echo.
echo Nhan phim bat ky de thoat...
pause >nul
