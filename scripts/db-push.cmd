@echo off
cd /d "%~dp0.."
node node_modules\prisma\build\index.js db push
if errorlevel 1 exit /b 1
node node_modules\prisma\build\index.js generate
exit /b 0
