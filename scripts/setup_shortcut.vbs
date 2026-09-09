Set oWS = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
rootDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
vbsPath = rootDir & "\SoundScope.vbs"
iconPath = rootDir & "\icon.ico"

' 1. Shortcut in the root directory
folderLnk = rootDir & "\SoundScope.lnk"
Set oLink = oWS.CreateShortcut(folderLnk)
oLink.TargetPath = "wscript.exe"
oLink.Arguments = "//nologo """ & vbsPath & """"
oLink.WorkingDirectory = rootDir
oLink.IconLocation = iconPath & ", 0"
oLink.Description = "SoundScope - AI Music Tagger & Explorer"
oLink.Save

' 2. Shortcut on the user's Desktop
desktopDir = oWS.SpecialFolders("Desktop")
If fso.FolderExists(desktopDir) Then
    desktopLnk = desktopDir & "\SoundScope.lnk"
    Set oLink2 = oWS.CreateShortcut(desktopLnk)
    oLink2.TargetPath = "wscript.exe"
    oLink2.Arguments = "//nologo """ & vbsPath & """"
    oLink2.WorkingDirectory = rootDir
    oLink2.IconLocation = iconPath & ", 0"
    oLink2.Description = "SoundScope - AI Music Tagger & Explorer"
    oLink2.Save
End If

WScript.Echo "Shortcuts successfully created!"
