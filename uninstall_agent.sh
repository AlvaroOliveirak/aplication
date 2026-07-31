#!/bin/bash
# uninstall_agent.sh
# Script de desinstalação do agente Prom_TS para Linux (systemd)

# Requer privilégios de root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute este script como root (sudo ./uninstall_agent.sh)."
  exit 1
fi

INSTALL_DIR="/usr/local/bin"
CONF_DIR="/etc/promts-agent"
SERVICE_FILE="/etc/systemd/system/promts-agent.service"

echo -e "\e[36mIniciando a remoção do agente Prom_TS...\e[0m"

# 1. Para e desabilita o serviço
if systemctl is-active --quiet promts-agent; then
  systemctl stop promts-agent
  echo -e "\e[32m[OK] Serviço promts-agent parado.\e[0m"
fi

if systemctl is-enabled --quiet promts-agent &>/dev/null; then
  systemctl disable promts-agent
  echo -e "\e[32m[OK] Serviço promts-agent desabilitado do boot.\e[0m"
fi

# 2. Deleta arquivos de serviço
if [ -f "$SERVICE_FILE" ]; then
  rm "$SERVICE_FILE"
  systemctl daemon-reload
  echo -e "\e[32m[OK] Definição de serviço removida de $SERVICE_FILE\e[0m"
fi

# 3. Limpa arquivos binários e de configuração
if [ -f "$INSTALL_DIR/promts-agent.py" ]; then
  rm "$INSTALL_DIR/promts-agent.py"
  echo -e "\e[32m[OK] Executável removido de $INSTALL_DIR\e[0m"
fi

if [ -d "$CONF_DIR" ]; then
  rm -rf "$CONF_DIR"
  echo -e "\e[32m[OK] Diretório de configuração e logs limpos em $CONF_DIR\e[0m"
fi

echo -e "\e[32m--------------------------------------------------------\e[0m"
echo -e "\e[32mAgente Prom_TS desinstalado com sucesso!\e[0m"
echo -e "\e[32m--------------------------------------------------------\e[0m"
