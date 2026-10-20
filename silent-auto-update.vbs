' Ugaan Hub - Zero-Click Silent Git Auto-Updater
' Runs invisible in the background, checks Git every 60 seconds
Set WshShell = CreateObject("WScript.Shell")

Do
    WshShell.Run "cmd /c ""C:\Ruten Scen New\auto-pull.bat""", 0, True
    WScript.Sleep 60000
Loop
