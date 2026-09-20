@echo off
rem Savutesti (Windows). Toteutus on testaa.mjs (Node).
rem
rem   tyokalut\testaa.cmd [--pida]

setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo testaa: node puuttuu - tarvitaan Node 18+. Asenna: https://nodejs.org 1>&2
  exit /b 1
)
node "%~dp0testaa.mjs" %*
exit /b %ERRORLEVEL%
