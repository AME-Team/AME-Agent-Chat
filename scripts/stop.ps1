# AME Agent Chat — 停止スクリプト
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Agent コンテナを停止..."
docker compose -f "$Root/docker-compose.yml" down

Write-Host "Gatekeeper / Frontend プロセスを終了..."
Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -match 'ame-agent-chat'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "停止しました。"
