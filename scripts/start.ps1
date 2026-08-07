# AME Agent Chat — 1 クリック完全自動起動 (要件 #1 §4.2)
# Docker Desktop 確認 → Gatekeeper(ホスト)起動 → Frontend 起動 → compose up → ブラウザ表示

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "[1/5] Docker Desktop を確認..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker が見つかりません。Docker Desktop をインストールしてください。"
}
if (-not (docker info *> $null; $?)) {
  Write-Host "Docker Desktop を起動中..."
  Start-Process "docker desktop"
  $i = 0
  while (-not (docker info *> $null; $?) -and $i -lt 60) {
    Start-Sleep -Seconds 2; $i++
  }
  if (-not (docker info *> $null; $?)) { throw "Docker Desktop が起動しません。" }
}

Write-Host "[2/5] Gatekeeper API を起動 (ホスト)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root'; pnpm --filter @ame-agent-chat/gatekeeper start"

Write-Host "[3/5] Frontend (PWA) を起動..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root'; pnpm --filter @ame-agent-chat/frontend dev"

Write-Host "[4/5] Agent コンテナを起動..."
$env:WORKSPACE_DIR = $Root   # ワークスペースを bind mount へ (AGENTS.md の正規手順に整合)
docker compose -f "$Root/docker-compose.yml" up -d --build

Write-Host "[5/5] ヘルスチェック..."
$i = 0
while ($i -lt 60) {
  if (curl.exe -fsS "http://localhost:30010/health" *> $null; $?) { break }
  Start-Sleep -Seconds 2; $i++
}

Write-Host "起動完了。ブラウザで Frontend を開きます。"
Start-Process "http://localhost:51730"
