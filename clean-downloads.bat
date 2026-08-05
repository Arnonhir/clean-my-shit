@echo off
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs
echo.
if "%~1"=="" (
    call npx tsx scripts/clean.ts
) else (
    call npx tsx scripts/clean.ts "%~1"
)
echo.
pause
