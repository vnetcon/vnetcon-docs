@echo off
rem Claude Coden apiKeyHelper Windowsille. Tulostaa tunnisteen stdoutiin.
rem
rem   { "apiKeyHelper": "node ./tyokalut/vnetcon-ai/hae-token.mjs" }
rem
rem on suositeltu (toimii kaikilla alustoilla). Tama .cmd on vaihtoehto, jos
rem apiKeyHelperiin halutaan pelkka tiedostopolku ilman "node"-etuliitetta.

setlocal
node "%~dp0hae-token.mjs"
exit /b %ERRORLEVEL%
