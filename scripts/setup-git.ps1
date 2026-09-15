$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path .git)) { git init -b main }
git config --local user.name timo-leiser
git config --local user.email timo@leiser.me
git config --local user.useConfigOnly true
git config --local github.user timo-leiser
git config --local credential.https://github.com.username timo-leiser
git config --local credential.https://github.com.useHttpPath true
# Empty value resets inherited helpers; only the verified account helper follows.
git --% config --local --replace-all credential.https://github.com.helper ""
if ($LASTEXITCODE -ne 0) { throw 'Could not reset inherited GitHub helpers.' }
$helperPath = (Join-Path $PSScriptRoot 'git-credential.ps1').Replace('\', '/')
git config --local --add credential.https://github.com.helper "!powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$helperPath'"
git config --local core.hooksPath .githooks
git config --local core.autocrlf false
if ($LASTEXITCODE -ne 0) { throw 'Could not configure local Git.' }
