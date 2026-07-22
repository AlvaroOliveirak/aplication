# Arquitetura do Prom_TS

Este diretório contém a documentação técnica e guias operacionais do sistema.

## Componentes Principais

1. **Dashboard UI (ECharts)**:
   Visualização dinâmica e em tempo real no frontend com Handlebars e Socket.IO.

2. **Node.js Express Server**:
   API REST, gerenciamento de sessões, persistência PostgreSQL e barramento Socket.IO.

3. **Background Alert Engine (`monitorAlerts`)**:
   Serviço em background desacoplado que executa a cada 10 segundos, consulta o Prometheus, calcula anomalias baseadas em Z-Score e distribui notificações.

4. **Nodemailer SMTP Service**:
   Despacho de e-mails para múltiplos destinatários.
