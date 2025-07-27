@echo off
echo Starting DXF Visual Ilot Pro...
echo.

echo Installing dependencies...
call npm install

echo.
echo Starting development server...
set "PYTHON_PATH=C:\Python313"
call node_modules\.bin\cross-env PORT=%PORT% npm run dev