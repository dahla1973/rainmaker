@echo off
cd /d C:\code\rainmaker
call npx vite build >nul 2>&1
start "" npx electron .
