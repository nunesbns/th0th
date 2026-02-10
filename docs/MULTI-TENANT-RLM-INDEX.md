# Multi-Tenant Documentation - RLM Memory Index

Este documento serve como índice de referência para consultas no sistema RLM (Retrieval Language Model). Use estes IDs e queries para recuperar informações específicas sobre multi-tenant architecture.

## 📋 IDs de Memória RLM

### Documentação Principal

| ID Conceitual         | Tipo         | Conteúdo                                     | Query Sugerida                                       |
| --------------------- | ------------ | -------------------------------------------- | ---------------------------------------------------- |
| `mt-arch-overview`    | Architecture | Visão geral multi-tenant                     | "multi-tenant architecture overview MCP"             |
| `mt-tenant-context`   | Pattern      | TenantContext (userId, projectId, sessionId) | "tenant context identification structure"            |
| `mt-isolation-layers` | Architecture | 3 camadas de isolamento                      | "tenant isolation layers API service data"           |
| `mt-vector-isolation` | Pattern      | Isolamento vector store                      | "vector store tenant isolation strategies"           |
| `mt-cache-namespace`  | Pattern      | Cache com namespace                          | "tenant cache namespacing pattern"                   |
| `mt-rate-limiting`    | Pattern      | Rate limiting por tenant                     | "rate limiting per tenant implementation"            |
| `mt-security`         | Security     | Auth, encryption, audit                      | "multi-tenant security authentication authorization" |
| `mt-implementation`   | Guide        | Guia passo a passo                           | "multi-tenant implementation guide phases"           |

### Exemplos Práticos

| ID Conceitual         | Tipo    | Conteúdo                   | Query Sugerida                                   |
| --------------------- | ------- | -------------------------- | ------------------------------------------------ |
| `mt-quickstart`       | Example | Setup 5 minutos            | "multi-tenant quick start setup"                 |
| `mt-helper-class`     | Code    | MultiTenantMcpClient       | "multi-tenant client helper class TypeScript"    |
| `mt-service-complete` | Code    | TenantMemoryService        | "tenant memory service complete implementation"  |
| `mt-agency-case`      | Example | Agência múltiplos clientes | "agency multiple clients multi-tenant example"   |
| `mt-saas-case`        | Example | SaaS com planos            | "SaaS different plans multi-tenant example"      |
| `mt-troubleshooting`  | Guide   | Resolução de problemas     | "multi-tenant troubleshooting cross-tenant data" |

## 🔍 Queries RLM Recomendadas

### Para Buscar Arquitetura

```typescript
// Query 1: Visão geral da arquitetura
await mcpClient.callTool("get_optimized_context", {
  query: "multi-tenant architecture th0th MCP overview isolation layers",
  projectId: "th0th-mcp",
  userId: "documentation-system",
  sessionId: "multi-tenant-docs-session",
  maxTokens: 4000,
});

// Query 2: Padrões de implementação
await mcpClient.callTool("get_optimized_context", {
  query:
    "multi-tenant implementation patterns TenantContext isolation vector store cache",
  projectId: "th0th-mcp",
  userId: "documentation-system",
  sessionId: "multi-tenant-docs-session",
  maxTokens: 6000,
});

// Query 3: Segurança e autorização
await mcpClient.callTool("get_optimized_context", {
  query:
    "multi-tenant security authentication authorization encryption audit logging",
  projectId: "th0th-mcp",
  userId: "documentation-system",
  sessionId: "multi-tenant-docs-session",
  maxTokens: 3000,
});
```

### Para Buscar Exemplos de Código

```typescript
// Query 4: Código completo de serviço
await mcpClient.callTool("search_code", {
  query: "TenantMemoryService complete implementation TypeScript",
  projectId: "th0th-mcp",
  limit: 10,
});

// Query 5: Helper classes
await mcpClient.callTool("search_code", {
  query: "MultiTenantMcpClient helper class methods",
  projectId: "th0th-mcp",
  limit: 10,
});

// Query 6: Casos de uso reais
await mcpClient.callTool("get_optimized_context", {
  query: "multi-tenant real use cases agency SaaS feature branches examples",
  projectId: "th0th-mcp",
  userId: "documentation-system",
  sessionId: "multi-tenant-docs-session",
  maxTokens: 5000,
});
```

### Para Troubleshooting

```typescript
// Query 7: Problemas de isolamento
await mcpClient.callTool("get_optimized_context", {
  query:
    "multi-tenant troubleshooting cross-tenant data leakage isolation issues",
  projectId: "th0th-mcp",
  userId: "documentation-system",
  sessionId: "multi-tenant-docs-session",
  maxTokens: 3000,
});

// Query 8: Performance
await mcpClient.callTool("get_optimized_context", {
  query:
    "multi-tenant performance optimization connection pooling cache strategy",
  projectId: "th0th-mcp",
  userId: "documentation-system",
  sessionId: "multi-tenant-docs-session",
  maxTokens: 3000,
});
```

## 📁 Arquivos e Localizações

### Documentação Completa

```
docs/
├── 14-multi-tenant-architecture.md    # Arquitetura completa (1900+ linhas)
│   ├── Seção 1: Visão Geral (linhas 1-150)
│   ├── Seção 2: Conceitos (linhas 151-250)
│   ├── Seção 3: Arquitetura (linhas 251-450)
│   ├── Seção 4: Implementação (linhas 451-800)
│   ├── Seção 5: Estratégias (linhas 801-1200)
│   ├── Seção 6: Segurança (linhas 1201-1400)
│   ├── Seção 7: Performance (linhas 1401-1600)
│   └── Seções 8-11: Guias e migração (linhas 1601-1900)
│
├── 15-multi-tenant-examples.md        # Exemplos práticos (1400+ linhas)
│   ├── Seção 1: Quick Start (linhas 1-80)
│   ├── Seção 2: Config OpenCode (linhas 81-150)
│   ├── Seção 3: Código Completo (linhas 151-650)
│   ├── Seção 4: Casos de Uso (linhas 651-1000)
│   └── Seção 5: Troubleshooting (linhas 1001-1400)
│
└── MULTI-TENANT-SUMMARY.md            # Sumário executivo
    └── Quick reference + links
```

### Diagrama Visual

- **URL:** https://todiagram.com/editor?doc=c5c820a499a5267861655850
- **Tipo:** Sistema interativo
- **Conteúdo:** Arquitetura visual com fluxo de dados

## 🎯 Contexto de Memória RLM

### Informações Armazenadas

Todas as memórias multi-tenant foram indexadas com:

```typescript
{
  projectId: 'th0th-mcp',
  userId: 'documentation-system',
  sessionId: 'multi-tenant-docs-session',
  importance: 0.9-0.95
}
```

### Tipos de Memória

| Tipo       | Uso                   | Exemplos                                 |
| ---------- | --------------------- | ---------------------------------------- |
| `code`     | Implementações        | TenantContext, Services, Repositories    |
| `pattern`  | Padrões arquiteturais | Isolation layers, Cache strategy         |
| `decision` | Decisões técnicas     | Vector store strategy, Security approach |

## 🔑 Palavras-chave para Busca

### Arquitetura

- `multi-tenant`
- `tenant isolation`
- `TenantContext`
- `userId projectId sessionId`
- `isolation layers`
- `namespace isolation`

### Implementação

- `MultiTenantMcpClient`
- `TenantMemoryService`
- `TenantContextMiddleware`
- `tenant filtering`
- `repository patterns`

### Segurança

- `authentication authorization`
- `tenant encryption`
- `audit logging`
- `cross-tenant access`
- `rate limiting per tenant`

### Performance

- `shared embeddings`
- `cache namespacing`
- `connection pooling`
- `resource optimization`
- `embedding deduplication`

## 💡 Exemplos de Uso

### Exemplo 1: Buscar Arquitetura Geral

```bash
# Via CLI do OpenCode
/mcp call rlm-memory get_optimized_context \
  --query "multi-tenant architecture complete overview" \
  --projectId "th0th-mcp" \
  --userId "documentation-system" \
  --maxTokens 6000
```

### Exemplo 2: Buscar Código Específico

```bash
# Buscar implementação de service
/mcp call rlm-memory search_code \
  --query "TenantMemoryService storeMemory implementation" \
  --projectId "th0th-mcp" \
  --limit 5
```

### Exemplo 3: Buscar Troubleshooting

```bash
# Resolver problema específico
/mcp call rlm-memory get_optimized_context \
  --query "multi-tenant cross-tenant data leakage solution" \
  --projectId "th0th-mcp" \
  --userId "documentation-system" \
  --maxTokens 2000
```

## 📊 Métricas de Indexação

| Métrica                      | Valor                       |
| ---------------------------- | --------------------------- |
| **Total de memórias**        | 4 principais + sub-memórias |
| **Arquivos documentados**    | 3 arquivos markdown         |
| **Linhas de código exemplo** | 3300+ linhas                |
| **Seções documentadas**      | 16 seções principais        |
| **Padrões indexados**        | 7 padrões arquiteturais     |
| **Exemplos de uso**          | 3 casos reais completos     |

## 🔄 Atualizações

Para atualizar o índice RLM após modificações na documentação:

```bash
# Re-indexar documentação
npm run index:docs:multi-tenant

# Ou manualmente via MCP
/mcp call rlm-memory store_memory \
  --content "Updated multi-tenant docs..." \
  --type "code" \
  --projectId "th0th-mcp" \
  --userId "documentation-system" \
  --importance 0.95
```

## 📖 Referências Rápidas

### Links Diretos

1. **Arquitetura Completa:** [docs/14-multi-tenant-architecture.md](./14-multi-tenant-architecture.md)
2. **Exemplos Práticos:** [docs/15-multi-tenant-examples.md](./15-multi-tenant-examples.md)
3. **Sumário Executivo:** [docs/MULTI-TENANT-SUMMARY.md](./MULTI-TENANT-SUMMARY.md)
4. **Diagrama Interativo:** [ToDiagram](https://todiagram.com/editor?doc=c5c820a499a5267861655850)

### Navegação Rápida por Tópico

| Tópico              | Arquivo                         | Seção     |
| ------------------- | ------------------------------- | --------- |
| Conceitos básicos   | 14-multi-tenant-architecture.md | Seção 2   |
| TenantContext       | 14-multi-tenant-architecture.md | Seção 2.1 |
| Isolamento de dados | 14-multi-tenant-architecture.md | Seção 5.1 |
| Cache strategy      | 14-multi-tenant-architecture.md | Seção 5.2 |
| Rate limiting       | 14-multi-tenant-architecture.md | Seção 5.3 |
| Segurança           | 14-multi-tenant-architecture.md | Seção 6   |
| Quick start         | 15-multi-tenant-examples.md     | Seção 1   |
| Código completo     | 15-multi-tenant-examples.md     | Seção 3   |
| Casos de uso        | 15-multi-tenant-examples.md     | Seção 4   |
| Troubleshooting     | 15-multi-tenant-examples.md     | Seção 5   |

---

**Última atualização:** 2026-02-01
**Versão:** 1.0.0
**Mantido por:** RLM Documentation System
