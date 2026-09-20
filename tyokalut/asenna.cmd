@echo off
rem Asentaa vnetcon-docs-paketin kohdeprojektin juureen (Windows).
rem
rem   tyokalut\asenna.cmd <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]
rem
rem Toteutus on asenna.mjs (Node). Ei vaadi bashia eika WSL:aa.

setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo asenna: node puuttuu - tarvitaan Node 18+. Asenna: https://nodejs.org 1>&2
  exit /b 1
)
node "%~dp0asenna.mjs" %*
exit /b %ERRORLEVEL%
