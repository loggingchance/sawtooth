@echo off
setlocal

echo.
echo Sawtooth push helper
echo =====================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git was not found on PATH.
  pause
  exit /b 1
)

cd /d "%~dp0"
if errorlevel 1 (
  echo Could not enter the repository folder.
  pause
  exit /b 1
)

git branch --show-current | findstr /r "^main$" >nul
if errorlevel 1 (
  echo Switching to main...
  git checkout main
  if errorlevel 1 (
    echo Could not switch to main.
    pause
    exit /b 1
  )
)

echo Pulling latest changes...
git pull --ff-only origin main
if errorlevel 1 (
  echo Pull failed. Resolve conflicts or authentication issues, then run again.
  pause
  exit /b 1
)

git status --porcelain > "%TEMP%\sawtooth-status.txt"
for %%A in ("%TEMP%\sawtooth-status.txt") do set "STATUS_SIZE=%%~zA"

if not "%STATUS_SIZE%"=="0" (
  echo.
  echo Local changes found:
  git status --short
  echo.
  set /p COMMIT_MESSAGE="Commit message [Update Sawtooth]: "
  if "%COMMIT_MESSAGE%"=="" set "COMMIT_MESSAGE=Update Sawtooth"
  git add .
  git commit -m "%COMMIT_MESSAGE%"
  if errorlevel 1 (
    del "%TEMP%\sawtooth-status.txt" >nul 2>nul
    echo Commit failed.
    pause
    exit /b 1
  )
) else (
  echo No local changes to commit.
)

del "%TEMP%\sawtooth-status.txt" >nul 2>nul

echo.
echo Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
  echo Push failed. Check GitHub authentication or repo permissions.
  pause
  exit /b 1
)

echo.
echo Push complete.
git log -1 --oneline

where gh >nul 2>nul
if not errorlevel 1 (
  echo.
  echo Recent workflow runs:
  gh run list --repo loggingchance/sawtooth --limit 5
)

echo.
echo GitHub Pages: https://loggingchance.github.io/sawtooth/
pause
