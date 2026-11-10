# image-retry.ps1  ——  计划任务入口（薄壳，只是转交）
#
# 原来的逻辑已原样搬到 image-retry-core.ps1（内容一致，以后改逻辑请改那边）。
# 本文件每 10 分钟被计划任务 ImageBatchRetry 调用一次；powershell.exe 是控制台程序，
# 启动瞬间必然先出现一个黑窗口。所以这里不做任何实际工作，立刻转交给 pythonw 隐藏执行，
# 把黑窗停留时间从原来的约 3 秒压到几十毫秒。
$pyw = 'C:\Users\21996\AppData\Local\Programs\Python\Python313\pythonw.exe'
$launcher = 'E:\破甲工作区\social-workbench\service\image_retry_launch.pyw'
$core = 'E:\破甲工作区\social-workbench\service\image-retry-core.ps1'
if (Test-Path $pyw) {
    try {
        Start-Process -FilePath $pyw -ArgumentList ('"' + $launcher + '"') -WindowStyle Hidden -ErrorAction Stop
    } catch {
        & $core
    }
} else {
    & $core
}
