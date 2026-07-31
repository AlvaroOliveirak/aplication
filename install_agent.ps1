# install_agent.ps1
# Script de instalação do agente Prom_TS para Windows

# Requer privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Por favor, execute este script como Administrador do sistema."
    Exit
}

$InstallDir = "C:\Program Files\PromTSAgent"
$ExeSource = Join-Path $PSScriptRoot "agent.exe"
if (-not (Test-Path $ExeSource)) {
    $ExeSource = Join-Path $PSScriptRoot "dist\agent.exe"
}
$ExeDest = Join-Path $InstallDir "agent.exe"
$ConfigDest = Join-Path $InstallDir "agent_config.json"

Write-Host "Iniciando a instalação do agente Prom_TS..." -ForegroundColor Cyan

# 1. Cria diretório de instalação
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Copia o executável
if (Test-Path $ExeSource) {
    Copy-Item -Path $ExeSource -Destination $ExeDest -Force
    Write-Host "[OK] Executável copiado para: $ExeDest" -ForegroundColor Green
} else {
    Write-Error "Não foi possível encontrar o arquivo agent.exe. Certifique-se de extrair todos os arquivos do zip."
    Exit
}

# 3. Copia ou cria o arquivo de configuração
$ConfigSource = Join-Path $PSScriptRoot "agent_config.json"
if (Test-Path $ConfigSource) {
    Copy-Item -Path $ConfigSource -Destination $ConfigDest -Force
    Write-Host "[OK] Configuração personalizada do agente copiada para: $ConfigDest" -ForegroundColor Green
} elseif (-not (Test-Path $ConfigDest)) {
    $DefaultConfig = @{
        server_url = "http://localhost:3000"
        token = "promts_INSIRA_SEU_TOKEN_AQUI"
    }
    $DefaultConfig | ConvertTo-Json | Out-File -FilePath $ConfigDest -Encoding utf8
    Write-Host "[OK] Configuração padrão criada em: $ConfigDest" -ForegroundColor Green
    Write-Host "[AVISO] Edite o arquivo '$ConfigDest' e insira seu Token antes de iniciar!" -ForegroundColor Yellow
}

# 4. Registra a Tarefa Agendada no Windows para rodar em background no boot
$TaskName = "PromTSAgent"
$Action = New-ScheduledTaskAction -Execute $ExeDest -WorkingDirectory $InstallDir
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount

# Remove tarefa anterior se existir
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Registra a nova tarefa
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Description "Agente de monitoramento em segundo plano do Prom_TS" | Out-Null

Write-Host "[OK] Tarefa agendada do Windows registrada com sucesso!" -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Instalação concluída com sucesso!" -ForegroundColor Green
Write-Host "Para iniciar o agente manualmente agora:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
