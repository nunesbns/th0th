# Exemplos de Queries RLM para Multi-Tenant

Este documento demonstra como usar o sistema RLM para consultar a documentação multi-tenant.

## 🎯 Quick Reference

### Consulta Rápida via OpenCode

```typescript
// No OpenCode, você pode usar:
const context = await mcp.callTool('rlm-memory', 'get_optimized_context', {
  query: 'sua query aqui',
  projectId: 'th0th-mcp',
  userId: 'documentation-system',
  sessionId: 'multi-tenant-docs-session',
  maxTokens: 4000
});
```

## 📚 Queries Prontas para Uso

### 1. Visão Geral da Arquitetura

**Query:**
```
multi-tenant architecture th0th MCP overview isolation layers TenantContext
```

**O que retorna:**
- Conceitos fundamentais de multi-tenancy
- Estrutura do TenantContext (userId, projectId, sessionId)
- 3 camadas de isolamento (API, Service, Data)
- Diagrama de arquitetura
- Benefícios e casos de uso

**Quando usar:** Início do projeto, apresentações, onboarding de novos devs

---

### 2. Implementação de TenantContext

**Query:**
```
TenantContext implementation TypeScript middleware extraction validation
```

**O que retorna:**
- Interface TypeScript do TenantContext
- Middleware de extração de contexto
- Validação de tenant
- Exemplos de uso em handlers

**Quando usar:** Implementando a camada de API

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 2-3

---

### 3. Isolamento de Vector Store

**Query:**
```
vector store tenant isolation ChromaDB metadata filtering collection strategy
```

**O que retorna:**
- Opção 1: Collection por tenant (isolamento forte)
- Opção 2: Shared collection com metadata (economia)
- Código de implementação completo
- Trade-offs de cada abordagem

**Quando usar:** Configurando ChromaDB para multi-tenant

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 5.1.A

---

### 4. Cache Namespacing

**Query:**
```
cache namespacing tenant isolation shared embeddings optimization
```

**O que retorna:**
- Estratégia de namespace por tenant
- Cache compartilhado para embeddings
- Código da classe TenantCacheManager
- Otimizações de performance

**Quando usar:** Implementando sistema de cache

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 5.2

---

### 5. Rate Limiting por Tenant

**Query:**
```
rate limiting per tenant TokenBucket implementation different plans
```

**O que retorna:**
- Implementação de TenantRateLimiter
- TokenBucket algorithm
- Limites por plano (free, pro, enterprise)
- Código completo

**Quando usar:** Implementando rate limiting

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 5.3

---

### 6. Segurança e Autenticação

**Query:**
```
multi-tenant security authentication authorization encryption audit logging
```

**O que retorna:**
- AuthMiddleware implementation
- JWT validation
- Per-tenant encryption keys
- Audit logging system
- Código de exemplo completo

**Quando usar:** Implementando segurança

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 6

---

### 7. Service Layer Completo

**Query:**
```
TenantMemoryService complete implementation storeMemory searchMemories
```

**O que retorna:**
- Classe TenantMemoryService completa
- Métodos: store, search, get, delete
- Validações e rate limiting
- Integração com cache e vector store
- 300+ linhas de código pronto

**Quando usar:** Implementando camada de serviço

**Arquivo de referência:** `docs/15-multi-tenant-examples.md` seção 3.2

---

### 8. Helper Class Cliente

**Query:**
```
MultiTenantMcpClient helper class TypeScript usage examples
```

**O que retorna:**
- Classe helper completa
- Métodos: storeMemory, getOptimizedContext, searchCode, compressContext
- Exemplos de uso
- Pattern de configuração

**Quando usar:** Criando cliente para OpenCode

**Arquivo de referência:** `docs/15-multi-tenant-examples.md` seção 3.1

---

### 9. Caso de Uso: Agência

**Query:**
```
multi-tenant agency multiple clients example isolation demonstration
```

**O que retorna:**
- Setup de 3 clientes isolados
- Código completo do exemplo
- Demonstração de isolamento
- Queries específicas por cliente

**Quando usar:** Entendendo uso prático

**Arquivo de referência:** `docs/15-multi-tenant-examples.md` seção 4.1

---

### 10. Caso de Uso: SaaS com Planos

**Query:**
```
SaaS multi-tenant different plans free pro enterprise limits
```

**O que retorna:**
- Setup de planos diferenciados
- Classe SaaSTenantManager
- Verificação de limites
- Rate limiting por plano

**Quando usar:** Implementando SaaS

**Arquivo de referência:** `docs/15-multi-tenant-examples.md` seção 4.3

---

### 11. Troubleshooting: Cross-Tenant Data Leakage

**Query:**
```
troubleshooting cross-tenant data leakage isolation issues solution
```

**O que retorna:**
- Diagnóstico do problema
- Como verificar filtros
- Solução com código
- Validação de metadata

**Quando usar:** Debug de vazamento de dados

**Arquivo de referência:** `docs/15-multi-tenant-examples.md` seção 5.1

---

### 12. Troubleshooting: Performance

**Query:**
```
multi-tenant performance degradation indexes optimization connection pooling
```

**O que retorna:**
- Diagnóstico de performance
- Criação de índices compostos
- Connection pooling strategy
- Query optimization

**Quando usar:** Otimizando performance

**Arquivo de referência:** `docs/15-multi-tenant-examples.md` seção 5.4

---

### 13. Migração Single → Multi-Tenant

**Query:**
```
migration single-tenant to multi-tenant script database schema changes
```

**O que retorna:**
- Script completo de migração
- Alterações de schema SQL
- Backup e rollback plan
- Checklist de deploy

**Quando usar:** Migrando sistema existente

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 11

---

### 14. Monitoramento e Métricas

**Query:**
```
multi-tenant monitoring metrics dashboard per-tenant observability
```

**O que retorna:**
- MetricsCollector implementation
- Dashboard de tenant
- Health score calculation
- Alert manager

**Quando usar:** Implementando observabilidade

**Arquivo de referência:** `docs/14-multi-tenant-architecture.md` seção 10

---

## 🧪 Testando as Queries

### Via Node.js

```typescript
import { MultiTenantMcpClient } from './helpers/multi-tenant-client';

const client = new MultiTenantMcpClient('stdio://...', {
  userId: 'documentation-system',
  projectId: 'th0th-mcp'
});

// Testar query
const result = await client.getOptimizedContext(
  'multi-tenant architecture overview',
  { maxTokens: 4000 }
);

console.log('Context found:', result.data.context);
console.log('Tokens saved:', result.metadata.tokensSaved);
console.log('Cache hit:', result.metadata.cacheHit);
```

### Via CLI

```bash
# Teste rápido de query
node -e "
const { MultiTenantMcpClient } = require('./build/helpers/multi-tenant-client');
const client = new MultiTenantMcpClient('stdio://...', {
  userId: 'documentation-system',
  projectId: 'th0th-mcp'
});
client.getOptimizedContext('TenantContext implementation', { maxTokens: 2000 })
  .then(r => console.log(r.data.context));
"
```

## 🎨 Queries Avançadas

### Combinando Múltiplos Conceitos

```
multi-tenant TenantContext isolation vector store cache rate limiting complete implementation
```

Retorna contexto combinado de múltiplos aspectos.

### Busca por Código Específico

```
TypeScript TenantMemoryService storeMemory async await error handling
```

Retorna implementação focada em um método específico.

### Busca por Padrão

```
isolation pattern tenant filtering WHERE clause repository pattern
```

Retorna padrão arquitetural específico com exemplos.

## 📊 Análise de Qualidade das Queries

| Query Type | Qualidade | Tokens Típicos | Cache Hit Rate |
|------------|-----------|----------------|----------------|
| Overview geral | ⭐⭐⭐⭐⭐ | 3000-4000 | 80% |
| Código específico | ⭐⭐⭐⭐ | 1000-2000 | 90% |
| Troubleshooting | ⭐⭐⭐⭐⭐ | 1500-2500 | 70% |
| Padrões | ⭐⭐⭐⭐ | 2000-3000 | 85% |

## 💡 Dicas para Queries Eficazes

1. **Seja específico:** Use termos técnicos exatos (TenantContext, não "contexto")
2. **Combine conceitos:** "vector store isolation metadata filtering"
3. **Use ações:** "implementation", "troubleshooting", "example"
4. **Inclua tecnologia:** TypeScript, ChromaDB, SQLite
5. **Defina escopo:** "complete implementation" vs "overview"

## 🔄 Atualização do Índice

Após adicionar nova documentação:

```bash
# Re-indexar
npm run index:docs

# Testar query
npm run test:query "nova feature multi-tenant"
```

---

**Ver também:**
- [MULTI-TENANT-RLM-INDEX.md](./MULTI-TENANT-RLM-INDEX.md) - Índice completo
- [14-multi-tenant-architecture.md](./14-multi-tenant-architecture.md) - Arquitetura
- [15-multi-tenant-examples.md](./15-multi-tenant-examples.md) - Exemplos
