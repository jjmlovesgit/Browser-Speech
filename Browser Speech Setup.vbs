Option Explicit

Dim fso
Dim shell
Dim repoRoot
Dim setupFolder
Dim setupExe

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

repoRoot = fso.GetParentFolderName(WScript.ScriptFullName)
setupFolder = fso.BuildPath(repoRoot, "setup")
setupExe = fso.BuildPath(setupFolder, "PocketTtsCompanionSetup.exe")

If Not fso.FileExists(setupExe) Then
    MsgBox "Browser Speech setup was not found:" & vbCrLf & setupExe & vbCrLf & vbCrLf & "Make sure the full repo ZIP was extracted before running setup.", vbExclamation, "Browser Speech"
    WScript.Quit 1
End If

shell.CurrentDirectory = setupFolder
shell.Run Chr(34) & setupExe & Chr(34), 1, False

