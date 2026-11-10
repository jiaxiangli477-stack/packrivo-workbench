' 隐藏窗口启动 image-retry.ps1
' 用途：计划任务改用 wscript.exe 调用本文件，彻底不创建控制台窗口
' 原理：wscript.exe 是 GUI 子系统程序，不会分配控制台；
'       再由 WScript.Shell.Run 以窗口模式 0（隐藏）拉起 powershell。
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""E:\破甲工作区\social-workbench\service\image-retry.ps1""", 0, False
