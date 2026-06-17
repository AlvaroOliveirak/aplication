# aplication

App Prom_TS para monitoramento e alertas de series temporais com Prometheus.

## Monitoramento do Windows

O `prom/node-exporter` do `docker-compose.yml` coleta metricas Linux do ambiente do Docker. Em Windows com Docker Desktop, isso pode representar a VM/ambiente do Docker, nao a maquina Windows vista no Gerenciador de Tarefas.

Para que CPU, memoria, disco e rede reflitam o Windows host, instale o `windows_exporter` no Windows e deixe-o escutando na porta padrao `9182`.

Exemplo de instalacao via PowerShell como administrador, depois de baixar o MSI do `windows_exporter`:

```powershell
msiexec /i C:\caminho\windows_exporter.msi --% ENABLED_COLLECTORS="[defaults]" LISTEN_PORT=9182 ADDLOCAL=FirewallException
```

O `prometheus.yml` ja inclui o alvo:

```yaml
- job_name: 'windows-exporter'
  static_configs:
    - targets: ['host.docker.internal:9182']
```

Depois de instalar o exporter, reinicie ou recarregue o Prometheus:

```powershell
docker compose restart prometheus
```

No dashboard, as metricas padrao preferem `windows_*` e so usam `node_*` como fallback quando o `windows_exporter` nao estiver disponivel.
