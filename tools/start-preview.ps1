$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
python -m http.server 8130 --bind 127.0.0.1
