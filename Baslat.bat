@echo off
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
) else (
    echo Electron bulunamadi, bagimliliklar yukleniyor...
    call npm.cmd install
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
)
