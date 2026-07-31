#!/bin/bash
# install_agent.sh
# Script de instalação do agente Prom_TS para Linux (systemd)

# Requer privilégios de root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute este script como root (sudo ./install_agent.sh)."
  exit 1
fi

INSTALL_DIR="/usr/local/bin"
CONF_DIR="/etc/promts-agent"
SERVICE_FILE="/etc/systemd/system/promts-agent.service"

echo -e "\e[36mIniciando a instalação do agente Prom_TS...\e[0m"

# 1. Cria diretórios necessários
mkdir -p "$CONF_DIR"

# 2. Copia o script do agente e arquivo de configuração
if [ -f "agent.py" ]; then
  cp agent.py "$INSTALL_DIR/promts-agent.py"
  chmod +x "$INSTALL_DIR/promts-agent.py"
  echo -e "\e[32m[OK] Script do agente copiado para $INSTALL_DIR/promts-agent.py\e[0m"
else
  echo -e "\e[31mErro: agent.py não encontrado.\e[0m"
  exit 1
fi

if [ -f "agent_config.json" ]; then
  cp agent_config.json "$CONF_DIR/agent_config.json"
  echo -e "\e[32m[OK] Configuração copiada para $CONF_DIR/agent_config.json\e[0m"
else
  # Cria configuração padrão se não existir
  echo '{"server_url": "http://localhost:3000", "token": "promts_INSIRA_SEU_TOKEN_AQUI"}' > "$CONF_DIR/agent_config.json"
  echo -e "\e[33m[AVISO] Configuração padrão criada em $CONF_DIR/agent_config.json. Edite antes de rodar!\e[0m"
fi

# 3. Instala dependências Python necessárias no sistema
echo -e "\e[36mInstalando dependências Python (psutil, requests)...\e[0m"
if command -v apt-get &> /dev/null; then
  apt-get update -y &> /dev/null
  apt-get install -y python3-pip python3-psutil python3-requests &> /dev/null
elif command -v yum &> /dev/null; then
  yum install -y python3-pip &> /dev/null
  pip3 install psutil requests &> /dev/null
else
  pip3 install psutil requests &> /dev/null
fi
echo -e "\e[32m[OK] Dependências instaladas.\e[0m"

# 4. Cria a unidade de serviço do systemd
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Agente de Monitoramento Prom_TS
After=network.target

[Service]
Type=simple
WorkingDirectory=$CONF_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/promts-agent.py
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

echo -e "\e[32m[OK] Serviço systemd configurado em $SERVICE_FILE\e[0m"

# 5. Habilita e inicia o serviço
systemctl daemon-reload
systemctl enable promts-agent
systemctl start promts-agent

echo -e "\e[32m--------------------------------------------------------\e[0m"
echo -e "\e[32mInstalação concluída com sucesso!\e[0m"
echo -e "\e[36mO agente está rodando em segundo plano via systemd.\e[0m"
echo -e "\e[36mPara verificar o status:  systemctl status promts-agent\e[0m"
echo -e "\e[32m--------------------------------------------------------\e[0m"
