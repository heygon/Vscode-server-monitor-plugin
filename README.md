<h1 align="center">Server Monitor for VS Code (Uptime Kuma Inspired)</h1>

<p align="center">
  <strong>O plugin definitivo para monitoramento de saúde de servidores, APIs e URLs HTTP/HTTPS em tempo real direto do seu editor!</strong>
</p>

## 🚀 Sobre o Projeto
O **Server Monitor** transforma seu Visual Studio Code em uma poderosa torre de controle no melhor estilo Uptime Kuma. Sem precisar sair do seu ambiente de desenvolvimento ou abrir o navegador, você pode diagnosticar a conectividade, saúde de certificados SSL, tempos exatos de roteamento de pacotes (TTFB, DNS, TCP) e histórico completo de falhas ou instabilidade.

---

## ✨ Funcionalidades Principais
* **Dashboard em Grade Responsiva**: Visão simultânea de todos os sites hospedados usando componentes nativos do _VS Code_ (`@vscode/webview-ui-toolkit`).
* **Monitoramento em Segundo Plano Worker**: Seus servidores são testados mesmo quando a interface do Webview está fechada, notificando nativamente você na Aba de Alertas do VS Code caso qualquer serviço caia.
* **Barra de Histórico de Disponibilidade**: A famosa "linha do tempo do GitHub" (History Bar) armazenando até as 60 últimas batidas com status de variação (Verde, Laranja e Vermelho).
* **Gráficos de Sparkline**: Gráfico em Linhas exibindo as oscilações da latência das verificações passadas usando *Chart.js*.
* **Status Bar System**: Na barra inferor nativa do VS Code, ícone acompanhando e denunciando total de sites "foras do ar" em instantes críticos.

## 📊 10 Métricas de Telemetria Fina
Diferente dos testes comuns de `"Ping (Online/Offline)"`, esta extensão mede detalhadamente o clico de resposta subjacente:
1. **Status Code HTTP** (200, 404, 500, etc)
2. **DNS Lookup Time** (Roteamento do provedor)
3. **TCP Connection Time** (Handshake TPC)
4. **SSL/TLS Handshake** (Agilidade de negociação segura)
5. **Time to First Byte (TTFB)** (Agilidade de processamento do backend)
6. **Total Response Time / Latência** (Tempo integral)
7. **Content Length** (Tamanho final processado da tag/corpo)
8. **Expiração do Certificado SSL** (Dias remanescentes para renovação do seu HTTPS)
9. **Contagem de Quedas** (Down Count)
10. **Redirecionamentos** (Detecção baseada no code 3xx)

---

## 💻 Como Usar (Instruções de Instalação)

### Instalando Localmente (Via VSCE Package)
1. Certifique-se de que possui o `vsce` instalado no seu Node.js:
   \`\`\`bash
   npm install -g @vscode/vsce
   \`\`\`
2. Navegue até o diretório do projeto clonado pelo terminal e gere o executável (VSIX):
   \`\`\`bash
   vsce package --no-yarn
   \`\`\`
3. Isso vai gerar um arquivo \`.vsix\` final na sua pasta.
4. No VS Code, vá na barra lateral de **Extensions**, clique nos três pontinhos `...` no canto superior e selecione **"Install from VSIX..."**. Localize seu gerado e pronto!

### Usando:
1. Pressione \`Ctrl+Shift+P\` (ou \`Cmd+Shift+P\` no Mac).
2. Procure por: \`Server Monitor: Open Dashboard\` e aperte enter!
3. Digite suas URLs que deseja monitorar e deixe a extensão fazer o resto.

---

## ⚙️ Configurações Expostas (Workspace / Settings.json)
Você pode ir nas Configurações da Extensão pelo editor para personalizar como o ícone raiz age na Status Bar do VS Code:
- \`serverMonitor.dashboard.text\`: "Servidores"
- \`serverMonitor.dashboard.tooltip\`: "Acesse seu painel online/offline"
- \`serverMonitor.dashboard.icon\`: "⚡"

---

## 💡 Estrutura de Diretórios para DevOps / Futuros Contribuidores
A extensão foi construída em TypeScript sob alta modularidade visando integrações futuras:
- \`src/monitors/HttpMonitor.ts\` (Possui a mágica dos sockets nativos TLS/HTTP Node.js).
- \`src/monitors/MonitorManager.ts\` (Sincroniza o \`globalState\` e rege o garbage collector limitando a 60 históricos).
- \`src/interface/\` (Contém nossos scripts Front-end em Vanilla JS super veloz e as injeções nativas de CSS Themes).

</br>

*[MIT License] - Construído visando performance absoluta sem engines gigantes de build front-end embutidas na IDE.*
