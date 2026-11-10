$ErrorActionPreference = 'SilentlyContinue'
# 让 WSL 常驻：跑一个 sleep infinity，VM 不会因为空闲被关掉
$existing = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'sleep infinity' -and $_.CommandLine -match 'Ubuntu-24.04' }
if (-not $existing) {
  Start-Process -FilePath 'wsl.exe' -ArgumentList '-d','Ubuntu-24.04','-u','root','--','sleep','infinity' -WindowStyle Hidden | Out-Null
}

# 确保 docker 与容器在线
$env:WSL_UTF8 = '1'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'systemctl is-active docker >/dev/null 2>&1 || systemctl start docker; docker start postiz postiz-postgres postiz-redis postiz-temporal temporal-elasticsearch postiz-temporal-ui >/dev/null 2>&1; docker exec postiz sh -c "nginx -s reload" >/dev/null 2>&1; true' | Out-Null

$log = 'E:\破甲工作区\social-workbench\data\logs\postiz-watchdog.log'
$st = & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'docker ps --format "{{.Names}}" | tr "\n" ","' 2>$null
"$(Get-Date -Format s) containers=$st" | Add-Content $log -Encoding UTF8
