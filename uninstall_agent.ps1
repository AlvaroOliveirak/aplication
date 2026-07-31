# uninstall_agent.ps1
# Script de desinstalação do agente Prom_TS para Windows

# Requer privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Por favor, execute este script como Administrador do sistema."
    Exit
}

$InstallDir = "C:\Program Files\PromTSAgent"
$TaskName = "PromTSAgent"

Write-Host "Iniciando a remoção do agente Prom_TS..." -ForegroundColor Cyan

# 1. Para e remove a tarefa agendada
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Tarefa agendada do Windows removida." -ForegroundColor Green
}

# 2. Deleta a pasta de instalação
if (Test-Path $InstallDir) {
    # Força a remoção de arquivos e subdiretórios
    Remove-Item -Path $InstallDir -Recurse -Force
    Write-Host "[OK] Diretório de instalação e arquivos deletados." -ForegroundColor Green
}

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Agente Prom_TS removido com sucesso!" -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
