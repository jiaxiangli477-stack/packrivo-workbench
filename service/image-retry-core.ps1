$ErrorActionPreference = 'SilentlyContinue'
$log = 'E:\破甲工作区\social-workbench\data\logs\image-retry.log'
try {
  $st = Invoke-RestMethod -Uri 'http://127.0.0.1:8795/api/image/status' -TimeoutSec 10
  if (-not $st.external.configured) { return }
  $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8795/api/images/batch' -Method POST -ContentType 'application/json' -Body '{"limit":2}' -TimeoutSec 60
  "$(Get-Date -Format s) started=$($r.started) total=$($r.total) reason=$($r.reason)" | Add-Content $log -Encoding UTF8
} catch {
  "$(Get-Date -Format s) ERR $($_.Exception.Message)" | Add-Content $log -Encoding UTF8
}