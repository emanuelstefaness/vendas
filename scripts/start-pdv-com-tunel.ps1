# Inicia de uma vez: API (3001) + Vite (5173) + Cloudflare Tunnel nomeado (config em %USERPROFILE%\.cloudflared\config.yml).
# Uso: duplo clique em START-PDV-ONLINE.bat ou: npm run start:pdv-online

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'PDV Bosque - Iniciar tudo'

function Resolve-CloudflaredPath {
  $candidates = @(
    'C:\cloudflared\cloudflared.exe',
    (Join-Path $env:ProgramFiles 'Cloudflare\cloudflared.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Cloudflare\cloudflared.exe')
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Stop-ListenerOnPort {
  param([int]$Port)
  $lines = @(netstat -ano | Select-String ":$Port\s+.*(LISTENING|OUVINDO)")
  foreach ($line in $lines) {
    if ($line -match '\s+(LISTENING|OUVINDO)\s+(\d+)\s*$') {
      $procId = [int]$Matches[2]
      if ($procId -le 0) { continue }
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "Porta $Port liberada (processo $procId encerrado)."
      } catch {
        Write-Host "Nao foi possivel encerrar PID $procId na porta $Port. Feche manualmente ou rode como Administrador."
      }
    }
  }
}

function Read-CloudflaredTunnelName {
  $cfg = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
  if (-not (Test-Path -LiteralPath $cfg)) { return 'pdv-bosque' }
  foreach ($line in Get-Content -LiteralPath $cfg) {
    if ($line -match '^\s*tunnel:\s*(.+)\s*$') { return $Matches[1].Trim() }
  }
  return 'pdv-bosque'
}

function Read-CloudflaredPublicBaseUrl {
  $cfg = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
  if (-not (Test-Path -LiteralPath $cfg)) { return 'https://pdv.bosquecarne.work' }
  foreach ($line in Get-Content -LiteralPath $cfg) {
    if ($line -match '^\s*hostname:\s*(.+)\s*$') {
      $h = $Matches[1].Trim()
      if ($h) { return "https://$h" }
    }
  }
  return 'https://pdv.bosquecarne.work'
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$OutFile = Join-Path $RepoRoot 'ULTIMO_LINK_TUNEL.txt'

if (-not (Test-Path -LiteralPath $BackendDir)) {
  Write-Host "Pasta backend nao encontrada: $BackendDir"
  exit 1
}
if (-not (Test-Path -LiteralPath $FrontendDir)) {
  Write-Host "Pasta frontend nao encontrada: $FrontendDir"
  exit 1
}

$cf = Resolve-CloudflaredPath
if (-not $cf) {
  Write-Host "cloudflared nao encontrado. Instale em C:\cloudflared\cloudflared.exe ou adicione ao PATH."
  Write-Host "Download: https://github.com/cloudflare/cloudflared/releases/latest"
  exit 1
}

$cfgPath = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
if (-not (Test-Path -LiteralPath $cfgPath)) {
  Write-Host "Falta o arquivo: $cfgPath"
  Write-Host "Crie config.yml com tunnel, credentials-file e ingress (hostname + service http://127.0.0.1:3001)."
  exit 1
}

$tunnelName = Read-CloudflaredTunnelName
$publicBase = Read-CloudflaredPublicBaseUrl

Write-Host "Liberando portas 3001 e 5173 (se estiverem em uso)..."
Stop-ListenerOnPort -Port 3001
Stop-ListenerOnPort -Port 5173
Start-Sleep -Milliseconds 400

Write-Host "Iniciando backend + frontend (npm run dev) em nova janela..."
$devPs = @"
Set-Location -LiteralPath '$RepoRoot'
`$Host.UI.RawUI.WindowTitle = 'PDV Bosque - API (3001) + Vite (5173)'
npm run dev
"@
Start-Process powershell.exe -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $devPs) | Out-Null

Write-Host "Aguardando API em http://127.0.0.1:3001 ..."
$apiOk = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $apiOk = $true; break }
  } catch { }
  Start-Sleep -Milliseconds 500
}
if (-not $apiOk) {
  Write-Host "API nao respondeu a tempo. Verifique a janela do npm run dev."
}

Write-Host "Aguardando Vite em http://127.0.0.1:5173 ..."
$viteOk = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $viteOk = $true; break }
  } catch { }
  Start-Sleep -Milliseconds 500
}
if ($viteOk) {
  Start-Process 'http://127.0.0.1:5173/'
} else {
  Write-Host "Vite nao respondeu a tempo; abra http://127.0.0.1:5173/ manualmente se necessario."
}

Write-Host "Iniciando Cloudflare Tunnel nomeado '$tunnelName' (nova janela)..."
$tunnelEscaped = $tunnelName -replace "'", "''"
$tunnelCmd = @"
Set-Location -LiteralPath '$RepoRoot'
`$Host.UI.RawUI.WindowTitle = 'PDV Bosque - Cloudflare Tunnel ($tunnelEscaped)'
& '$cf' tunnel run '$tunnelEscaped'
"@
Start-Process powershell.exe -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $tunnelCmd) | Out-Null

Write-Host "Aguardando o conector do tunnel (alguns segundos)..."
$publicOk = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 1500
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$publicBase/api/health" -TimeoutSec 10
    if ($r.StatusCode -eq 200) { $publicOk = $true; break }
  } catch { }
}

$lines = @(
  "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "",
  "PDV local:",
  "http://127.0.0.1:5173/",
  "",
  "API publica (base, do config.yml):",
  $publicBase,
  "",
  "Teste:",
  "$publicBase/api/health",
  "",
  "Pedido online:",
  "$publicBase/api/public/orders",
  "",
  "Vercel (Pedir):",
  "VITE_API_URL=$publicBase",
  ""
)

Set-Content -LiteralPath $OutFile -Value ($lines -join "`r`n") -Encoding UTF8

try { Set-Clipboard -Text $publicBase } catch { }

Write-Host ""
Write-Host "=== API publica (copiada): $publicBase ===" -ForegroundColor Green
if (-not $publicOk) {
  Write-Host ('Aviso: ainda nao respondeu em ' + $publicBase + ' - confira a janela do cloudflared (erro 1033 = tunnel parado).') -ForegroundColor Yellow
}
Write-Host ('Detalhes: ' + $OutFile) -ForegroundColor Yellow

try {
  Add-Type -AssemblyName System.Windows.Forms | Out-Null
  $msg = 'Local: http://127.0.0.1:5173/' + [char]10 + [char]10
  $msg += 'Publico (Vercel):' + [char]10 + $publicBase + [char]10 + [char]10
  $msg += 'Arquivo: ULTIMO_LINK_TUNEL.txt'
  if (-not $publicOk) {
    $msg += [char]10 + [char]10 + 'Se o site publico nao abrir, mantenha a janela do cloudflared aberta e aguarde alguns segundos.'
  }
  [void][System.Windows.Forms.MessageBox]::Show($msg, 'PDV Bosque - Iniciado', 'OK', 'Information')
} catch {
  pause
}
