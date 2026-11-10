# -*- coding: utf-8 -*-
"""隐藏窗口运行 image-retry-core.ps1 的启动器。

用途：给计划任务 ImageBatchRetry 使用。
原理：pythonw.exe 是 GUI 子系统程序，自身不分配控制台；
      再用 CREATE_NO_WINDOW 拉起 powershell，整个过程不会出现任何窗口。
"""
import subprocess
import datetime
import os

PS = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
SCRIPT = r"E:\破甲工作区\social-workbench\service\image-retry-core.ps1"
DEBUG = r"E:\破甲工作区\social-workbench\data\logs\image-retry-launcher.log"
CREATE_NO_WINDOW = 0x08000000


def dbg(msg):
    try:
        os.makedirs(os.path.dirname(DEBUG), exist_ok=True)
        with open(DEBUG, "a", encoding="utf-8") as f:
            f.write("%s %s\n" % (datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), msg))
    except Exception:
        pass


try:
    dbg("start ps=%s exists=%s script_exists=%s" % (PS, os.path.exists(PS), os.path.exists(SCRIPT)))
    p = subprocess.Popen(
        [PS, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=CREATE_NO_WINDOW,
        close_fds=True,
        cwd=os.path.dirname(SCRIPT),
    )
    dbg("spawned pid=%s" % p.pid)
except Exception as e:
    dbg("spawn failed: %r" % (e,))
