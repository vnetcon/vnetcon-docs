@echo off
rem Windows: tuplaklikkaa kaynnistaaksesi vnetcon-docsin MCP-hallintakayttoliittyman.
cd /d "%~dp0"
node kaynnista.mjs %*
pause
