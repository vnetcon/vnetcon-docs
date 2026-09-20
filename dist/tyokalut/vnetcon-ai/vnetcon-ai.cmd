@echo off
rem vnetcon-ai - kaynnistin Windowsille (cmd.exe / PowerShell).
rem Toteutus on vnetcon-ai.mjs (Node). Ei vaadi bashia.
rem
rem   tyokalut\vnetcon-ai\vnetcon-ai.cmd doctor

setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo vnetcon-ai: node puuttuu - tarvitaan Node 18+. Asenna: https://nodejs.org 1>&2
  exit /b 1
)
node "%~dp0vnetcon-ai.mjs" %*
exit /b %ERRORLEVEL%
