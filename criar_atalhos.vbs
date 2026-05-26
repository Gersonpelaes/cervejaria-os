Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Obter caminhos dos Desktops (Publico e do Usuario atual)
publicDesktop = WshShell.ExpandEnvironmentStrings("%PUBLIC%") & "\Desktop"
userDesktop = WshShell.SpecialFolders("Desktop")

' Criar atalhos nos diretorios encontrados
If fso.FolderExists(publicDesktop) Then
    CreateShortcuts publicDesktop
End If
If fso.FolderExists(userDesktop) Then
    CreateShortcuts userDesktop
End If

Sub CreateShortcuts(desktopPath)
    On Error Resume Next
    
    ' 1. Atalho de Iniciar (Executa de forma silenciosa via iniciar.vbs)
    Set lnkStart = WshShell.CreateShortcut(desktopPath & "\PDV RESTAURANTE 2025.lnk")
    lnkStart.TargetPath = "wscript.exe"
    lnkStart.Arguments = """" & currentDir & "\iniciar.vbs"""
    lnkStart.WorkingDirectory = currentDir
    lnkStart.IconLocation = currentDir & "\logo.ico, 0"
    lnkStart.Save
    
    ' 2. Atalho de Parar (Executa parar.bat)
    Set lnkStop = WshShell.CreateShortcut(desktopPath & "\Parar PDV RESTAURANTE 2025.lnk")
    lnkStop.TargetPath = currentDir & "\parar.bat"
    lnkStop.WorkingDirectory = currentDir
    lnkStop.Save
End Sub
