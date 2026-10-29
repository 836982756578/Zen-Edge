Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = appDir & "\node_modules\electron\dist\electron.exe"

If fso.FileExists(electronExe) Then
  shell.Run """" & electronExe & """ """ & appDir & """", 0, False
Else
  MsgBox "Electron bulunamadi. Lutfen once klasorde 'npm install' komutunu calistirin.", 16, "Zen Side"
End If
