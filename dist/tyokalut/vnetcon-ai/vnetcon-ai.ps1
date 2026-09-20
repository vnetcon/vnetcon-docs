#!/usr/bin/env pwsh
# vnetcon-ai — käynnistin PowerShellille. Toteutus on vnetcon-ai.mjs (Node).
#
#   .\tyokalut\vnetcon-ai\vnetcon-ai.ps1 doctor
#
# Jos PowerShell estää skriptin ajon, aja kerran:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# tai käytä vnetcon-ai.cmd:tä, joka ei ole skriptirajoitusten alainen.

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'vnetcon-ai: node puuttuu — tarvitaan Node 18+. Asenna: https://nodejs.org'
    exit 1
}

$mjs = Join-Path $PSScriptRoot 'vnetcon-ai.mjs'
& node $mjs @args
exit $LASTEXITCODE
