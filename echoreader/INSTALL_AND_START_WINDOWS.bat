@echo off
setlocal
cd /d "%~dp0"
echo.
echo ======================================================
echo   EchoReader - install packages and start development
 echo ======================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 first from https://nodejs.org/
  pause
  exit /b 1
)
echo Installing dependencies (including the splash-screen package)...
call npm install
if errorlevel 1 (
  echo.
  echo Installation failed. Check your internet connection and share the error.
  pause
  exit /b 1
)
echo.
echo Set your Firebase web app values in .env.local to enable login and signup.
echo See START_HERE.md for instructions. Press W in the Expo terminal for web.
echo.
call npx expo start -c
pause
