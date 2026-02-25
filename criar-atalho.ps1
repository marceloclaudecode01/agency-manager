# Cria atalho "Agency" na Area de Trabalho
$Desktop = [System.Environment]::GetFolderPath("Desktop")
$WshShell = New-Object -ComObject WScript.Shell

$Atalho = $WshShell.CreateShortcut("$Desktop\Agency - Gestao.lnk")
$Atalho.TargetPath = "$PSScriptRoot\iniciar.bat"
$Atalho.WorkingDirectory = $PSScriptRoot
$Atalho.WindowStyle = 1
$Atalho.Description = "Iniciar Sistema Agency de Gestao para Marketing"
$Atalho.Save()

Write-Host "Atalho criado na Area de Trabalho!" -ForegroundColor Green
Write-Host "Procure por 'Agency - Gestao' na sua Area de Trabalho." -ForegroundColor Cyan
Start-Sleep -Seconds 2
