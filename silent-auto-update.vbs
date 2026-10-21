' Ugaan Hub - Zero-Click Silent Git Auto-Updater
' Runs invisible in the background, checks Git every 60 seconds
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = currentDir & "\auto-pull.bat"
If Not fso.FileExists(batPath) Then
    batPath = "C:\Ruten Scen New\auto-pull.bat"
End If

Do
    WshShell.Run "cmd /c """ & batPath & """", 0, True
    WScript.Sleep 60000
Loop
