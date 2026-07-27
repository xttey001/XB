' XB Notes 静默启动器
' 双击此文件即可无黑窗启动服务并打开浏览器

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' 使用 -ExecutionPolicy Bypass 避免执行策略限制
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""d:\XB\start-xb-notes.ps1""", 0, False

Set WshShell = Nothing
