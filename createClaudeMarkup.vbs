Set fso = CreateObject("Scripting.FileSystemObject")
Set currentFolder = fso.GetFolder(".")

' Get the absolute path of the current folder to strip it out later
rootPath = currentFolder.Path
If Right(rootPath, 1) <> "\" Then rootPath = rootPath & "\"

outputFile = "claude_project_bundle.md"

' Delete old file if it exists
If fso.FileExists(outputFile) Then fso.DeleteFile(outputFile)
Set outStream = fso.CreateTextFile(outputFile, True)

ProcessFolder currentFolder, fso, outStream, outputFile, rootPath

Sub ProcessFolder(folder, fso, outStream, outName, rootPath)
    For Each file In folder.Files
        ext = LCase(fso.GetExtensionName(file.Name))
        ' Check for matching file extensions
        If ext="js" Or ext="html" Or ext="css" Or ext="py" Or ext="txt" Or ext="md" Then
            If file.Name <> outName And file.Name <> "bundle.vbs" Then
                
                ' Convert absolute path to a clean relative path
                relativePath = ".\" & Replace(file.Path, rootPath, "")
                
                outStream.WriteLine("# FILE: " & relativePath)
                outStream.WriteLine("```")
                
                ' Read the file contents safely
                Set inStream = fso.OpenTextFile(file.Path, 1)
                If Not inStream.AtEndOfStream Then
                    outStream.Write(inStream.ReadAll)
                End If
                inStream.Close
                
                outStream.WriteLine()
                outStream.WriteLine("```")
                outStream.WriteLine()
            End If
        End If
    Next
    
    ' Recursively look inside subfolders
    For Each subFolder In folder.SubFolders
        ProcessFolder subFolder, fso, outStream, outName, rootPath
    Next
End Sub

MsgBox "Success! Relative path bundle created in claude_project_bundle.md", 64, "Done"
