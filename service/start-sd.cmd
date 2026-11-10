@echo off
cd /d E:\破甲工作区\social-workbench
E:\Ai\Python311\python.exe service\sd_server.py --port 8189 >> "E:\破甲工作区\social-workbench\data\logs\sd_out.log" 2>&1
