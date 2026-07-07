@echo off
setlocal
set "SETUP_EXE=%~dp0setup\PocketTtsCompanionSetup.exe"

if not exist "%SETUP_EXE%" (
    echo Browser Speech setup was not found at:
    echo %SETUP_EXE%
    echo.
    echo Make sure the full repo ZIP was extracted before running setup.
    pause
    exit /b 1
)

pushd "%~dp0setup"
"%SETUP_EXE%"
set "EXITCODE=%ERRORLEVEL%"
popd

exit /b %EXITCODE%

