# Libera TCP 5173 (Vite) e 3001 (API) para outros dispositivos na rede local.
# Execute no PowerShell COMO ADMINISTRADOR: npm run fw:windows

$ErrorActionPreference = 'Stop'
# 5173 = PDV principal; 5174 = dev pedir online; 3001 = API Node
$ports = @(5173, 5174, 3001)
foreach ($p in $ports) {
  $name = "PDV Bosque - porta $p (dev)"
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Regra ja existe: $name"
    continue
  }
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p | Out-Null
  Write-Host "Criada regra de firewall: $name"
}
Write-Host ""
Write-Host "Pronto. Reinicie npm run dev e teste no celular o endereco que o Vite mostrar (http://IP:5173)."
