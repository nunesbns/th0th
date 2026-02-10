# Referência da API

## Tools

### get_optimized_context

Recupera contexto otimizado com economia máxima de tokens.

**Input:**
```json
{
  "query": "string",
  "userId": "string",
  "sessionId": "string",
  "projectPath": "string (optional)",
  "maxTokens": "number (default: 4000)"
}
```

**Output:**
```json
{
  "context": {
    "preferences": ["string"],
    "sessionContext": ["string"],
    "query": "string"
  },
  "stats": {
    "preferencesCount": "number",
    "sessionContextCount": "number",
    "estimatedTokens": "number"
  },
  "fromCache": "boolean (optional)"
}
```

**Exemplo:**
```json
// Input
{
  "query": "como funciona a autenticação",
  "userId": "user-123",
  "sessionId": "session-456",
  "maxTokens": 2000
}

// Output
{
  "context": {
    "preferences": [
      "Prefere usar async/await ao invés de callbacks"
    ],
    "sessionContext": [
      "Usuário perguntou sobre JWT anteriormente",
      "Mostrou interesse em segurança"
    ],
    "query": "como funciona a autenticação"
  },
  "stats": {
    "preferencesCount": 1,
    "sessionContextCount": 2,
    "estimatedTokens": 250
  }
}
```

---

### store_memory

Armazena uma memória no memoria local.

**Input:**
```json
{
  "content": "string",
  "userId": "string",
  "sessionId": "string",
  "type": "preference | conversation | code | decision",
  "metadata": "object (optional)"
}
```

**Output:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Memory stored successfully as {type}"
    }
  ]
}
```

**Exemplo:**
```json
// Input
{
  "content": "Prefere usar TypeScript strict mode",
  "userId": "user-123",
  "sessionId": "session-456",
  "type": "preference",
  "metadata": {
    "category": "typescript",
    "importance": "high"
  }
}

// Output
{
  "content": [
    {
      "type": "text",
      "text": "Memory stored successfully as preference"
    }
  ]
}
```

---

### search_memories

Busca memórias relevantes no memoria local.

**Input:**
```json
{
  "query": "string",
  "userId": "string",
  "limit": "number (default: 5)",
  "type": "string (optional)"
}
```

**Output:**
```json
[
  {
    "id": "string",
    "content": "string",
    "type": "string",
    "metadata": "object",
    "score": "number",
    "timestamp": "string (ISO 8601)"
  }
]
```

**Exemplo:**
```json
// Input
{
  "query": "autenticação JWT",
  "userId": "user-123",
  "limit": 3,
  "type": "code"
}

// Output
[
  {
    "id": "mem-abc123",
    "content": "Implementação do middleware JWT",
    "type": "code",
    "metadata": {
      "file": "auth.middleware.ts",
      "language": "typescript"
    },
    "score": 0.95,
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

---

### compress_code

Comprime código semanticamente mantendo estrutura e API.

**Input:**
```json
{
  "code": "string",
  "language": "string (default: typescript)"
}
```

**Output:**
```json
{
  "compressed": {
    "structure": "string",
    "publicAPI": "string",
    "dependencies": "string",
    "metadata": {
      "originalSize": "number",
      "compressedSize": "number",
      "hash": "string",
      "language": "string"
    }
  },
  "savings": "string (percentage)"
}
```

**Exemplo:**
```json
// Input
{
  "code": "export class UserService { ... }",
  "language": "typescript"
}

// Output
{
  "compressed": {
    "structure": "export class UserService",
    "publicAPI": "- authenticate(email, password): Promise<AuthResult>",
    "dependencies": "import { Repository } from 'typeorm'",
    "metadata": {
      "originalSize": 1500,
      "compressedSize": 200,
      "hash": "a1b2c3d4",
      "language": "typescript"
    }
  },
  "savings": "86.7%"
}
```

---

## Resources

### cache_stats

Retorna estatísticas do sistema de cache.

**URI:** `cache://stats`

**Output:**
```json
{
  "size": "number",
  "hitRate": "number",
  "entries": [
    {
      "key": "string",
      "hits": "number",
      "age": "number (milliseconds)"
    }
  ]
}
```

**Exemplo:**
```json
{
  "size": 42,
  "hitRate": 0.65,
  "entries": [
    {
      "key": "context:user-123:session-456:auth",
      "hits": 5,
      "age": 120000
    }
  ]
}
```

---

## Types

### Memory

```typescript
interface Memory {
  id: string;
  content: string;
  type: 'preference' | 'conversation' | 'code' | 'decision';
  metadata: Record<string, any>;
  score?: number;
  timestamp: Date;
}
```

### ContextStrategy

```typescript
interface ContextStrategy {
  type: 'minimal' | 'compressed' | 'balanced' | 'full';
  maxTokens: number;
  include: string[];
  models: string[];
}
```

### CompressedContent

```typescript
interface CompressedContent {
  structure: string;
  publicAPI: string;
  dependencies: string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    hash: string;
    language: string;
  };
}
```

---

## Configuração

### Variáveis de Ambiente

| Variável | Descrição | Obrigatório | Padrão |
|----------|-----------|-------------|--------|
| `CLOUD_SYNC_API_KEY` | API key do serviço de sincronização cloud | Sim | - |
| `CLOUD_SYNC_HOST` | URL do serviço de sincronização cloud | Não | `https://api.example.com` |
| `OPENAI_API_KEY` | API key da OpenAI | Não | - |
| `PROJECT_PATH` | Caminho do projeto | Não | `./` |
| `CACHE_PATH` | Diretório de cache | Não | `./cache` |
| `LOG_LEVEL` | Nível de log | Não | `info` |

### Configuração MCP

```json
{
  "mcpServers": {
    "rlm-memory": {
      "command": "node",
      "args": ["/path/to/th0th-mcp/build/index.js"],
      "env": {
        "CLOUD_SYNC_API_KEY": "sua-api-key",
        "CLOUD_SYNC_HOST": "https://api.example.com",
        "PROJECT_PATH": "/path/to/project",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

---

## Limites

| Recurso | Limite | Descrição |
|---------|--------|-----------|
| maxTokensPerRequest | 8000 | Máximo de tokens por request |
| maxMemoriesPerQuery | 20 | Máximo de memórias retornadas |
| maxCacheSize | 100MB | Tamanho máximo do cache |
| defaultTTL | 3600s | Tempo de vida padrão do cache |
| rateLimit.requests | 60/min | Limite de requisições |
| rateLimit.tokens | 100K/min | Limite de tokens |

---

## Códigos de Erro

| Código | Descrição | Solução |
|--------|-----------|---------|
| `CLOUD_SYNC_AUTH_ERROR` | Falha na autenticação do serviço cloud | Verifique CLOUD_SYNC_API_KEY |
| `CLOUD_SYNC_CONNECTION_ERROR` | Não foi possível conectar ao serviço cloud | Verifique CLOUD_SYNC_HOST |
| `COMPRESSION_ERROR` | Falha na compressão | Verifique sintaxe do código |
| `CACHE_ERROR` | Erro no cache | Verifique permissões do diretório |
| `VALIDATION_ERROR` | Input inválido | Verifique schema da requisição |
| `RATE_LIMIT_ERROR` | Limite de requisições excedido | Aguarde antes de tentar novamente |

---

## Exemplos de Uso

### Exemplo 1: Fluxo Completo

```typescript
// 1. Armazenar preferência
await client.callTool('store_memory', {
  content: 'Prefere usar async/await',
  userId: 'user-123',
  sessionId: 'session-456',
  type: 'preference'
});

// 2. Buscar contexto otimizado
const context = await client.callTool('get_optimized_context', {
  query: 'como fazer requisições HTTP',
  userId: 'user-123',
  sessionId: 'session-456'
});

// 3. Comprimir código
const compressed = await client.callTool('compress_code', {
  code: fs.readFileSync('api.ts', 'utf-8'),
  language: 'typescript'
});
```

### Exemplo 2: Batch Processing

```typescript
// Armazenar múltiplas memórias
const memories = [
  { content: 'Prefere TypeScript', type: 'preference' },
  { content: 'Usa ESLint strict', type: 'preference' },
  { content: 'Implementação do auth', type: 'code' }
];

await Promise.all(
  memories.map(m => 
    client.callTool('store_memory', {
      ...m,
      userId: 'user-123',
      sessionId: 'session-456'
    })
  )
);
```

### Exemplo 3: Cache Warming

```typescript
// Pré-carregar cache com queries comuns
const commonQueries = [
  'como funciona o auth',
  'estrutura do projeto',
  'padrões de código'
];

for (const query of commonQueries) {
  await client.callTool('get_optimized_context', {
    query,
    userId: 'user-123',
    sessionId: 'session-456'
  });
}
```
