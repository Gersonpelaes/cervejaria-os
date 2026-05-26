Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = scriptDir

' Determinar o caminho absoluto ou comando global do Node para sessoes sem PATH recarregado
nodeCmd = "node"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodeCmd = """C:\Program Files\nodejs\node.exe"""
ElseIf fso.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
    nodeCmd = """C:\Program Files (x86)\nodejs\node.exe"""
End If

' Iniciar o servidor backend de forma invisivel em background
WshShell.Run "cmd /c cd backend && " & nodeCmd & " server.js", 0, False

' Aguardar 3 segundos para garantir que o banco de dados e a porta 3001 estejam escutando
WScript.Sleep 3000

' Abrir o navegador com seguranca apos o carregamento do servidor
WshShell.Run "cmd /c start http://localhost:3001", 0, False
