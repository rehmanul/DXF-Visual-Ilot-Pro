@echo off
echo Starting DXF Visual Ilot Pro...
echo.
echo This script will start the development server and open the application in your browser.
echo.

echo Installing dependencies...
call npm install

echo.
echo Starting development server...
start cmd /k "set NODE_ENV=development && npx tsx server/index.ts"

echo.
echo Waiting for server to start...
timeout /t 5 /nobreak > nul

echo.
echo Opening application in browser...
start http://localhost:3000

echo.
echo DXF Visual Ilot Pro is now running!
echo Press Ctrl+C in the server window to stop the server.
echo.