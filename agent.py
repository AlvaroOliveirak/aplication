import os
import sys
import json
import time
import requests
import uuid
import socket
import platform
import psutil

# Nome do arquivo de configuração
CONFIG_FILE = "agent_config.json"

# Configuração padrão
default_config = {
    "server_url": "http://localhost:3000",
    "token": "promts_INSIRA_SEU_TOKEN_AQUI"
}

# Resolve o caminho do arquivo de configuração (funciona compilado ou em script normal)
def get_config_path():
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, CONFIG_FILE)

config_path = get_config_path()

# Cria o arquivo de configuração se não existir
if not os.path.exists(config_path):
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=4)
        print(f"Arquivo de configuração '{CONFIG_FILE}' criado. Edite-o e execute o agente novamente.")
        sys.exit(0)
    except Exception as e:
        print(f"Erro ao criar configuração padrão: {e}")
        sys.exit(1)

# Carrega as configurações
try:
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
except Exception as e:
    print(f"Erro ao ler arquivo de configuração: {e}")
    sys.exit(1)

SERVER_URL = config.get("server_url", "http://localhost:3000").rstrip('/')
TOKEN = config.get("token", "")

if not TOKEN or TOKEN == "promts_INSIRA_SEU_TOKEN_AQUI":
    print("Erro: Token ausente ou inválido no arquivo 'agent_config.json'. Edite o arquivo antes de continuar.")
    sys.exit(1)

# Identificação da Máquina
mac_uuid = str(uuid.getnode())
hostname = socket.gethostname()
os_type = f"{platform.system()} {platform.release()}"

print(f"Iniciando agente para {hostname} ({os_type})...")
print(f"Servidor: {SERVER_URL}")
print(f"UUID da Máquina: {mac_uuid}")

# 1. Registrar a máquina no banco de dados
try:
    reg_url = f"{SERVER_URL}/api/agent/register"
    reg_res = requests.post(reg_url, json={
        "token": TOKEN,
        "uuid": mac_uuid,
        "hostname": hostname,
        "os": os_type
    })
    if reg_res.status_code != 200:
        print(f"Erro no registro: {reg_res.text}")
        sys.exit(1)
    
    machine_id = reg_res.json()["machineId"]
    print(f"Máquina registrada com sucesso! ID: {machine_id}")
except Exception as e:
    print(f"Erro ao conectar ao servidor: {e}")
    sys.exit(1)

# 2. Loop de envio periódico de métricas
while True:
    try:
        # Coleta CPU e RAM
        cpu = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory().percent
        
        # Coleta Disco
        try:
            disk = psutil.disk_usage('/').percent
        except Exception:
            disk = 0
        
        # Coleta tráfego de Rede (Bytes por segundo)
        net_before = psutil.net_io_counters()
        time.sleep(1)
        net_after = psutil.net_io_counters()
        
        rx_diff = net_after.bytes_recv - net_before.bytes_recv
        tx_diff = net_after.bytes_sent - net_before.bytes_sent
        
        # Enviar métricas
        metrics_url = f"{SERVER_URL}/api/agent/metrics"
        metrics_res = requests.post(metrics_url, json={
            "machineId": machine_id,
            "cpu": cpu,
            "ram": ram,
            "disk": disk,
            "networkRx": rx_diff,
            "networkTx": tx_diff
        })
        
        # Enviar Heartbeat para manter status ONLINE
        heartbeat_url = f"{SERVER_URL}/api/agent/heartbeat"
        requests.post(heartbeat_url, json={"machineId": machine_id})
        
        time.sleep(8) # Envia a cada 10 segundos
    except Exception as e:
        print(f"Erro no loop de coleta/envio: {e}")
        time.sleep(5)
