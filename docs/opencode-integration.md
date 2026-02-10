# OpenCode Integration Guide

Este guia explica como configurar o MCP RLM Server para funcionar com OpenCode em modo standalone.

## Modo Standalone

O servidor agora pode rodar independentemente, permitindo que OpenCode se conecte via diretório ao invés de iniciar o MCP diretamente.

### Benefícios

✅ **Debug em tempo real** - UI web mostrando todas as operações  
✅ **Diffs visíveis** - Acompanhe mudanças conforme acontecem  
✅ **Contadores ao vivo** - Tokens, custos e cache hits em tempo real  
✅ **Logs do MCP** - Toda comunicação MCP visível na interface  
✅ **Performance** - Servidor roda continuamente, sem overhead de inicialização

## Instalação e Configuração

### 1. Build do projeto

```bash
npm run build
```

### 2. Iniciar o servidor standalone

```bash
# Modo padrão (porta 3030, diretório .mcp-server)
npm run start:standalone

# Ou com opções personalizadas
node dist/server-standalone.js --port 3030 --dir /caminho/para/servidor
```

### 3. Configurar OpenCode

Adicione ao arquivo de configuração do OpenCode (`.opencode/config.json` ou similar):

```json
{
  "mcpServers": {
    "th0th-mcp": {
      "mode": "directory",
      "directory": ".mcp-server",
      "debugUrl": "http://localhost:3030"
    }
  }
}
```

### 4. Acessar a UI de Debug

Abra no navegador: `http://localhost:3030`

## Estrutura do Diretório Servidor

Quando o servidor standalone inicia, ele cria:

```
.mcp-server/
├── manifest.json      # Manifesto do servidor para OpenCode
├── server.pid         # PID do processo do servidor
└── debug.db          # Banco de dados SQLite com histórico
```

## Recursos da UI

### Painel Esquerdo - Sessions

- Lista de sessões ativas e anteriores
- Estatísticas por sessão
- Status (Active/Ended)

### Painel Central - Overview

- Gráficos de uso de tokens ao longo do tempo
- Análise de custos
- Tabs para LLM calls, MCP calls e Cache stats

### Painel Direito - Real-Time

- **Contadores em tempo real**
  - Input/Output tokens
  - Custo total
  - Tokens em cache
- **Live Diffs**
  - Cada operação aparece em tempo real
  - Tipo (LLM, MCP, Cache)
  - Metadata (tokens, custo, duração, cache hit)
- **Debug Logs**
  - Todas as requisições MCP
  - Respostas do servidor
  - Erros e warnings

## Opções de Linha de Comando

```bash
node dist/server-standalone.js [opções]

Opções:
  --port <número>      Porta do servidor HTTP (padrão: 3030)
  --dir <caminho>      Diretório do servidor (padrão: .mcp-server)
  --no-ui              Desabilita a UI web
  --no-debug           Desabilita coleta de debug
```

## API Endpoints

O servidor expõe os seguintes endpoints:

### GET /

Interface web principal

### GET /api/stats

Estatísticas gerais do servidor

### GET /api/sessions

Lista de sessões (suporta paginação)

### GET /api/sessions/:id

Detalhes de uma sessão específica

### GET /api/current

Sessão atual ativa

### GET /api/diffs?limit=20&since=<timestamp>

Diffs recentes (mudanças)

### GET /api/tokens

Estatísticas de tokens da sessão atual

### GET /api/events

Server-Sent Events (SSE) para atualizações em tempo real

## Exemplo de Integração com OpenCode

```typescript
// No OpenCode, você pode acessar o servidor via:
const mcpServer = opencode.getMCPServer("th0th-mcp");

// Chamadas de ferramentas
const result = await mcpServer.callTool("get_optimized_context", {
  query: "Find authentication logic",
  maxTokens: 8000,
});

// Todas as chamadas são automaticamente monitoradas
// e aparecem na UI em tempo real
```

## Troubleshooting

### Servidor não inicia

- Verifique se a porta 3030 está disponível
- Confira permissões do diretório `.mcp-server`

### OpenCode não conecta

- Certifique-se que o `manifest.json` existe em `.mcp-server`
- Verifique o PID em `server.pid` corresponde ao processo rodando

### UI não carrega

- Acesse `http://localhost:3030/api/stats` para verificar se a API responde
- Confira o console do navegador para erros JavaScript

### Debug logs vazios

- Faça algumas chamadas via OpenCode para popular dados
- Verifique se `--no-debug` não foi passado

## Próximos Passos

1. Teste o servidor standalone localmente
2. Configure OpenCode para usar o modo directory
3. Abra a UI e faça algumas operações
4. Monitore os diffs, tokens e logs em tempo real

Para mais informações, consulte:

- Documentação do MCP: `/docs`
- Issues: GitHub repository
