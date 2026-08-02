$orionWorkspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$orionStartup = [Environment]::GetFolderPath('Startup')
$orionShortcutPath = Join-Path $orionStartup 'Orion.lnk'
$orionShell = New-Object -ComObject WScript.Shell
$orionShortcut = $orionShell.CreateShortcut($orionShortcutPath)
$orionShortcut.TargetPath = Join-Path $orionWorkspace 'start-orion.cmd'
$orionShortcut.WorkingDirectory = $orionWorkspace
$orionShortcut.WindowStyle = 7
$orionShortcut.Save()
Write-Output "Orion startup shortcut installed at $orionShortcutPath"
