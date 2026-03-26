@echo off
echo ========================================
echo   MFPS WebGL - Vercel Deploy
echo ========================================
echo.

REM Check if Build folder exists
if not exist "Build" (
    echo FEHLER: Kein "Build" Ordner gefunden!
    echo.
    echo Bitte zuerst in Unity:
    echo   1. File - Build Profiles - WebGL auswaehlen
    echo   2. Build klicken
    echo   3. Diesen Ordner "WebGL-Deploy" als Ziel waehlen
    echo.
    pause
    exit /b 1
)

REM Check if vercel is installed
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo Vercel CLI wird installiert...
    npm install -g vercel
)

echo.
echo Deploying to Vercel...
echo.
vercel --prod

echo.
echo ========================================
echo   Deploy abgeschlossen!
echo ========================================
pause
