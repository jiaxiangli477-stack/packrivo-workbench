# 启动本地 ComfyUI（6G 显存用 lowvram），供工作台 /api/image/generate 调用
$ErrorActionPreference = 'SilentlyContinue'
$comfy = 'E:\Ai\ComfyUI'
$python = 'E:\Ai\Python311\python.exe'
$logDir = 'E:\破甲工作区\social-workbench\data\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not (Test-Path $python)) { "缺少 python: $python" | Add-Content "$logDir\comfy.log"; exit 1 }
if (-not (Test-Path "$comfy\main.py")) { "缺少 ComfyUI: $comfy" | Add-Content "$logDir\comfy.log"; exit 1 }

# 已在跑就不再启动
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8188/system_stats' -TimeoutSec 3 -UseBasicParsing
  if ($r.StatusCode -eq 200) { "$(Get-Date -Format s) already running" | Add-Content "$logDir\comfy.log"; exit 0 }
} catch {}

Set-Location $comfy
& $python main.py --port 8188 --lowvram --preview-method none *>> "$logDir\comfy.log"
