# Exemplos Práticos: Multi-Tenant no th0th MCP

Este documento complementa o [14-multi-tenant-architecture.md](./14-multi-tenant-architecture.md) com exemplos práticos prontos para uso.

## Índice

1. [Quick Start](#1-quick-start)
2. [Configuração do OpenCode](#2-configuração-do-opencode)
3. [Exemplos de Código Completo](#3-exemplos-de-código-completo)
4. [Casos de Uso Reais](#4-casos-de-uso-reais)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Quick Start

### 1.1 Setup Básico (5 minutos)

```bash
# Clone o repositório
git clone https://github.com/your-org/th0th-mcp.git
cd th0th-mcp

# Instale dependências
npm install

# Configure multi-tenant
echo "MULTI_TENANT_ENABLED=true" >> .env
echo "REQUIRE_AUTH=false" >> .env  # Para desenvolvimento

# Execute migrations
npm run migrate:tenant

# Inicie o servidor
npm run dev
```

### 1.2 Primeiro Uso Multi-Tenant

```typescript
// exemplo-basico.ts
import { McpClient } from "@modelcontextprotocol/sdk/client";

const client = new McpClient({
  serverUrl: "stdio://path/to/th0th-mcp/build/server.js",
});

// Definir contexto do tenant
const aliceContext = {
  userId: "alice@company.com",
  projectId: "ecommerce-api",
  sessionId: "dev-session-001",
};

// Armazenar memória
const result = await client.callTool("store_memory", {
  content: "Implementamos autenticação JWT com refresh tokens",
  type: "decision",
  ...aliceContext,
});

console.log("Memory stored:", result);

// Buscar contexto otimizado
const context = await client.callTool("get_optimized_context", {
  query: "Como funciona autenticação?",
  maxTokens: 4000,
  ...aliceContext,
});

console.log("Context:", context.data.context);
```

---

## 2. Configuração do OpenCode

### 2.1 Configuração Básica

**Arquivo:** `~/.opencode/opencode.json`

```json
{
  "mcpServers": {
    "rlm-memory": {
      "command": "node",
      "args": ["/caminho/para/th0th-mcp/build/server.js"],
      "env": {
        "MULTI_TENANT_ENABLED": "true",
        "OPERATION_MODE": "standalone",
        "LOCAL_DB_PATH": "./data/memory.db",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 2.2 Configuração Avançada (Multi-Projeto)

```json
{
  "mcpServers": {
    "rlm-project-a": {
      "command": "node",
      "args": ["/caminho/para/th0th-mcp/build/server.js"],
      "env": {
        "MULTI_TENANT_ENABLED": "true",
        "DEFAULT_PROJECT_ID": "project-a",
        "DEFAULT_USER_ID": "alice@company.com",
        "LOCAL_DB_PATH": "./data/project-a.db",
        "VECTOR_DB_PATH": "./data/vectors-a"
      }
    },
    "rlm-project-b": {
      "command": "node",
      "args": ["/caminho/para/th0th-mcp/build/server.js"],
      "env": {
        "MULTI_TENANT_ENABLED": "true",
        "DEFAULT_PROJECT_ID": "project-b",
        "DEFAULT_USER_ID": "bob@company.com",
        "LOCAL_DB_PATH": "./data/project-b.db",
        "VECTOR_DB_PATH": "./data/vectors-b"
      }
    }
  }
}
```

### 2.3 Uso no OpenCode

```typescript
// No OpenCode, o tenant context é extraído automaticamente dos parâmetros:

// Exemplo 1: Context explícito
const result = await mcp.callTool("rlm-memory", "store_memory", {
  content: "Nova feature implementada",
  type: "code",
  userId: "alice@company.com",
  projectId: "ecommerce-api",
  sessionId: "current-session",
});

// Exemplo 2: Context implícito (usa defaults do env)
const context = await mcp.callTool("rlm-memory", "get_optimized_context", {
  query: "padrões de autenticação",
  // userId e projectId vêm do env
});
```

---

## 3. Exemplos de Código Completo

### 3.1 Classe Helper para Multi-Tenant

```typescript
// src/helpers/multi-tenant-client.ts

import { McpClient } from "@modelcontextprotocol/sdk/client";

export interface TenantContext {
  userId: string;
  projectId: string;
  sessionId?: string;
}

export class MultiTenantMcpClient {
  private client: McpClient;
  private defaultContext: TenantContext;

  constructor(serverUrl: string, defaultContext: TenantContext) {
    this.client = new McpClient({ serverUrl });
    this.defaultContext = defaultContext;
  }

  /**
   * Armazena uma memória no contexto do tenant
   */
  async storeMemory(
    content: string,
    type: "preference" | "conversation" | "code" | "decision" | "pattern",
    options?: {
      importance?: number;
      tenantContext?: Partial<TenantContext>;
    },
  ) {
    const context = this.buildContext(options?.tenantContext);

    return await this.client.callTool("store_memory", {
      content,
      type,
      importance: options?.importance || 0.5,
      ...context,
    });
  }

  /**
   * Busca contexto otimizado
   */
  async getOptimizedContext(
    query: string,
    options?: {
      maxTokens?: number;
      tenantContext?: Partial<TenantContext>;
    },
  ) {
    const context = this.buildContext(options?.tenantContext);

    return await this.client.callTool("get_optimized_context", {
      query,
      maxTokens: options?.maxTokens || 8000,
      ...context,
    });
  }

  /**
   * Busca código
   */
  async searchCode(
    query: string,
    options?: {
      limit?: number;
      tenantContext?: Partial<TenantContext>;
    },
  ) {
    const context = this.buildContext(options?.tenantContext);

    return await this.client.callTool("search_code", {
      query,
      projectId: context.projectId, // Obrigatório para search_code
      limit: options?.limit || 10,
    });
  }

  /**
   * Comprime contexto
   */
  async compressContext(
    content: string,
    options?: {
      strategy?:
        | "code_structure"
        | "conversation_summary"
        | "semantic_dedup"
        | "hierarchical";
      language?: string;
    },
  ) {
    return await this.client.callTool("compress_context", {
      content,
      strategy: options?.strategy || "code_structure",
      language: options?.language,
    });
  }

  /**
   * Monta contexto completo
   */
  private buildContext(partial?: Partial<TenantContext>): TenantContext {
    return {
      userId: partial?.userId || this.defaultContext.userId,
      projectId: partial?.projectId || this.defaultContext.projectId,
      sessionId:
        partial?.sessionId ||
        this.defaultContext.sessionId ||
        this.generateSessionId(),
    };
  }

  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Uso:
const client = new MultiTenantMcpClient("stdio://path/to/server.js", {
  userId: "alice@company.com",
  projectId: "ecommerce-api",
});

// Armazena com contexto padrão
await client.storeMemory("Implementamos rate limiting", "code");

// Armazena em outro projeto
await client.storeMemory("Design system atualizado", "decision", {
  tenantContext: { projectId: "mobile-app" },
});
```

### 3.2 Service Layer Completo

```typescript
// src/services/tenant-memory-service.ts

import { MemoryRepository } from "../data/repositories/memory-repository";
import { VectorStore } from "../data/chromadb/vector-store";
import { CacheManager } from "./cache/cache-manager";
import { RateLimiter } from "../utils/rate-limiter";
import { AuditLogger } from "./audit/audit-logger";

export class TenantMemoryService {
  constructor(
    private repository: MemoryRepository,
    private vectorStore: VectorStore,
    private cache: CacheManager,
    private rateLimiter: RateLimiter,
    private auditLogger: AuditLogger,
  ) {}

  /**
   * Armazena memória com isolamento completo
   */
  async storeMemory(
    content: string,
    type: string,
    tenantContext: TenantContext,
    options?: { importance?: number },
  ): Promise<Memory> {
    // 1. Rate limiting por tenant
    await this.rateLimiter.checkLimit(tenantContext, "store_memory");

    // 2. Validações
    this.validateContent(content);
    this.validateTenantContext(tenantContext);

    // 3. Criar memória no banco
    const memory = await this.repository.create(
      {
        content,
        type,
        importance: options?.importance || 0.5,
        metadata: {
          source: "opencode",
          createdBy: tenantContext.userId,
        },
      },
      tenantContext,
    );

    // 4. Indexar no vector store (com tenant metadata)
    await this.vectorStore.add({
      id: memory.id,
      content: memory.content,
      metadata: {
        userId: tenantContext.userId,
        projectId: tenantContext.projectId,
        type: memory.type,
        importance: memory.importance,
      },
    });

    // 5. Invalidar cache do tenant
    await this.cache.invalidatePrefix(this.getCachePrefix(tenantContext));

    // 6. Audit log
    await this.auditLogger.log(
      {
        action: "memory.create",
        resource: "memory",
        resourceId: memory.id,
        metadata: { type, importance: memory.importance },
      },
      tenantContext,
    );

    return memory;
  }

  /**
   * Busca memórias com filtro de tenant
   */
  async searchMemories(
    query: string,
    tenantContext: TenantContext,
    options?: {
      limit?: number;
      minImportance?: number;
      types?: string[];
    },
  ): Promise<Memory[]> {
    // Rate limiting
    await this.rateLimiter.checkLimit(tenantContext, "search_memories");

    // Cache key específico do tenant
    const cacheKey = this.buildCacheKey(
      "search",
      query,
      tenantContext,
      options,
    );
    const cached = await this.cache.get<Memory[]>(cacheKey);

    if (cached) {
      await this.auditLogger.log(
        {
          action: "memory.search",
          resource: "memory",
          metadata: { query, cached: true },
        },
        tenantContext,
      );
      return cached;
    }

    // Busca híbrida com filtros de tenant
    const vectorResults = await this.vectorStore.search(query, {
      where: {
        userId: tenantContext.userId,
        projectId: tenantContext.projectId,
      },
      limit: options?.limit || 10,
    });

    // Busca memórias completas do banco
    const memoryIds = vectorResults.map((r) => r.id);
    let memories = await this.repository.findByIds(memoryIds, tenantContext);

    // Aplicar filtros adicionais
    if (options?.minImportance) {
      memories = memories.filter((m) => m.importance >= options.minImportance!);
    }

    if (options?.types && options.types.length > 0) {
      memories = memories.filter((m) => options.types!.includes(m.type));
    }

    // Cache results
    await this.cache.set(cacheKey, memories, { ttl: 300 });

    // Audit log
    await this.auditLogger.log(
      {
        action: "memory.search",
        resource: "memory",
        metadata: { query, resultsCount: memories.length, cached: false },
      },
      tenantContext,
    );

    return memories;
  }

  /**
   * Obtém memória por ID (com validação de tenant)
   */
  async getMemory(
    memoryId: string,
    tenantContext: TenantContext,
  ): Promise<Memory> {
    const memory = await this.repository.findById(memoryId);

    if (!memory) {
      throw new NotFoundError(`Memory ${memoryId} not found`);
    }

    // Validação de acesso: memória deve pertencer ao tenant
    if (
      memory.userId !== tenantContext.userId ||
      memory.projectId !== tenantContext.projectId
    ) {
      await this.auditLogger.log(
        {
          action: "memory.access_denied",
          resource: "memory",
          resourceId: memoryId,
          metadata: { reason: "cross_tenant_access" },
        },
        tenantContext,
      );

      throw new UnauthorizedError("Memory not found or access denied");
    }

    return memory;
  }

  /**
   * Deleta memória (com validação)
   */
  async deleteMemory(
    memoryId: string,
    tenantContext: TenantContext,
  ): Promise<void> {
    // Validar acesso
    const memory = await this.getMemory(memoryId, tenantContext);

    // Rate limiting
    await this.rateLimiter.checkLimit(tenantContext, "delete_memory");

    // Deletar do banco
    await this.repository.delete(memoryId, tenantContext);

    // Deletar do vector store
    await this.vectorStore.delete(memoryId);

    // Invalidar cache
    await this.cache.invalidatePrefix(this.getCachePrefix(tenantContext));

    // Audit log
    await this.auditLogger.log(
      {
        action: "memory.delete",
        resource: "memory",
        resourceId: memoryId,
        metadata: { type: memory.type },
      },
      tenantContext,
    );
  }

  /**
   * Obtém estatísticas do tenant
   */
  async getTenantStats(tenantContext: TenantContext) {
    const [totalMemories, memoryByType, storageBytes, recentActivity] =
      await Promise.all([
        this.repository.count(tenantContext),
        this.repository.countByType(tenantContext),
        this.repository.getStorageSize(tenantContext),
        this.repository.getRecentActivity(tenantContext, 10),
      ]);

    return {
      totalMemories,
      memoryByType,
      storageBytes,
      storageMB: (storageBytes / 1024 / 1024).toFixed(2),
      recentActivity,
    };
  }

  // Métodos auxiliares privados

  private validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new ValidationError("Content cannot be empty");
    }

    if (content.length > 50000) {
      throw new ValidationError("Content exceeds maximum length (50KB)");
    }
  }

  private validateTenantContext(context: TenantContext): void {
    if (!context.userId || !context.projectId) {
      throw new ValidationError("userId and projectId are required");
    }
  }

  private getCachePrefix(context: TenantContext): string {
    return `tenant:${context.userId}:${context.projectId}`;
  }

  private buildCacheKey(
    operation: string,
    query: string,
    context: TenantContext,
    options?: any,
  ): string {
    const optionsHash = options ? JSON.stringify(options) : "";
    return `${this.getCachePrefix(context)}:${operation}:${query}:${optionsHash}`;
  }
}
```

---

## 4. Casos de Uso Reais

### 4.1 Caso: Agência com Múltiplos Clientes

```typescript
// exemplo-agencia.ts

import { MultiTenantMcpClient } from "./helpers/multi-tenant-client";

// Setup: 3 clientes, cada um com seu projeto
const clients = {
  clientA: new MultiTenantMcpClient("stdio://...", {
    userId: "dev@agency.com",
    projectId: "client-a-ecommerce",
  }),

  clientB: new MultiTenantMcpClient("stdio://...", {
    userId: "dev@agency.com",
    projectId: "client-b-blog",
  }),

  clientC: new MultiTenantMcpClient("stdio://...", {
    userId: "dev@agency.com",
    projectId: "client-c-saas",
  }),
};

// Armazenar decisões arquiteturais por cliente
await clients.clientA.storeMemory(
  "Cliente A: Usando Stripe para pagamentos",
  "decision",
  { importance: 0.9 },
);

await clients.clientB.storeMemory(
  "Cliente B: WordPress com headless CMS",
  "decision",
  { importance: 0.8 },
);

await clients.clientC.storeMemory(
  "Cliente C: Microservices com Kubernetes",
  "decision",
  { importance: 0.95 },
);

// Buscar contexto isolado por cliente
async function getClientContext(clientKey: keyof typeof clients) {
  const context = await clients[clientKey].getOptimizedContext(
    "arquitetura do projeto",
    { maxTokens: 2000 },
  );

  console.log(`\n=== Context for ${clientKey} ===`);
  console.log(context.data.context);
}

await getClientContext("clientA"); // Só vê Stripe
await getClientContext("clientB"); // Só vê WordPress
await getClientContext("clientC"); // Só vê Kubernetes
```

### 4.2 Caso: Equipe Distribuída com Feature Branches

```typescript
// exemplo-feature-branches.ts

interface FeatureBranch {
  name: string;
  developer: string;
  projectId: string;
}

const branches: FeatureBranch[] = [
  { name: "feat/auth", developer: "alice", projectId: "main-app" },
  { name: "feat/payments", developer: "bob", projectId: "main-app" },
  { name: "feat/dashboard", developer: "carol", projectId: "main-app" },
];

async function trackFeatureProgress(branch: FeatureBranch) {
  const client = new MultiTenantMcpClient("stdio://...", {
    userId: branch.developer,
    projectId: branch.projectId,
    sessionId: branch.name,
  });

  // Cada desenvolvedor registra progresso na sua feature
  await client.storeMemory(
    `${branch.name}: Implementado ${Date.now()}`,
    "code",
    { importance: 0.7 },
  );

  // Busca contexto específico da feature
  const context = await client.getOptimizedContext(
    `progresso da ${branch.name}`,
    { maxTokens: 1000 },
  );

  return {
    branch: branch.name,
    developer: branch.developer,
    context: context.data.context,
  };
}

// Cada dev vê apenas seu progresso
const progress = await Promise.all(
  branches.map((b) => trackFeatureProgress(b)),
);

progress.forEach((p) => {
  console.log(`\n${p.branch} (${p.developer}):`);
  console.log(p.context);
});
```

### 4.3 Caso: SaaS com Planos Diferentes

```typescript
// exemplo-saas-planos.ts

interface TenantPlan {
  tenantId: string;
  plan: "free" | "pro" | "enterprise";
  limits: {
    maxMemories: number;
    maxStorageMB: number;
    requestsPerMinute: number;
  };
}

const tenantPlans: Record<string, TenantPlan> = {
  "startup-xyz": {
    tenantId: "startup-xyz",
    plan: "free",
    limits: {
      maxMemories: 1000,
      maxStorageMB: 100,
      requestsPerMinute: 60,
    },
  },
  "enterprise-abc": {
    tenantId: "enterprise-abc",
    plan: "enterprise",
    limits: {
      maxMemories: 1000000,
      maxStorageMB: 10000,
      requestsPerMinute: 1000,
    },
  },
};

class SaaSTenantManager {
  private clients = new Map<string, MultiTenantMcpClient>();

  getClient(tenantId: string, userId: string, projectId: string) {
    const key = `${tenantId}:${userId}:${projectId}`;

    if (!this.clients.has(key)) {
      const client = new MultiTenantMcpClient("stdio://...", {
        userId: `${tenantId}:${userId}`,
        projectId,
      });
      this.clients.set(key, client);
    }

    return this.clients.get(key)!;
  }

  async checkLimits(tenantId: string): Promise<boolean> {
    const plan = tenantPlans[tenantId];
    if (!plan) throw new Error("Tenant not found");

    // Verificar limites (exemplo simplificado)
    const stats = await this.getTenantStats(tenantId);

    if (stats.totalMemories >= plan.limits.maxMemories) {
      throw new Error(`Memory limit exceeded for ${plan.plan} plan`);
    }

    if (stats.storageMB >= plan.limits.maxStorageMB) {
      throw new Error(`Storage limit exceeded for ${plan.plan} plan`);
    }

    return true;
  }

  async getTenantStats(tenantId: string) {
    // Implementação depende do service layer
    return {
      totalMemories: 500,
      storageMB: 50,
    };
  }
}

// Uso
const manager = new SaaSTenantManager();

// Cliente free
const freeClient = manager.getClient("startup-xyz", "user1", "proj1");
await manager.checkLimits("startup-xyz"); // OK
await freeClient.storeMemory("Feature implemented", "code");

// Cliente enterprise
const enterpriseClient = manager.getClient("enterprise-abc", "admin", "main");
await manager.checkLimits("enterprise-abc"); // OK
await enterpriseClient.storeMemory("Large dataset processed", "code");
```

---

## 5. Troubleshooting

### 5.1 Problema: Dados de outro tenant aparecem nos resultados

**Sintoma:**

```typescript
const results = await client.searchMemories("auth", tenantA);
// Retorna memórias do tenantB também ❌
```

**Diagnóstico:**

```typescript
// Verificar se filtros estão sendo aplicados
console.log("Filters applied:", {
  userId: tenantContext.userId,
  projectId: tenantContext.projectId,
});

// Verificar metadados no vector store
const rawResults = await vectorStore.search(query);
console.log(
  "Raw results:",
  rawResults.map((r) => r.metadata),
);
```

**Solução:**

```typescript
// Garantir que metadata está sendo adicionada corretamente
await vectorStore.add({
  id: memory.id,
  content: memory.content,
  metadata: {
    userId: tenantContext.userId, // ✅ Obrigatório
    projectId: tenantContext.projectId, // ✅ Obrigatório
    type: memory.type,
  },
});

// Garantir que where clause está correto
await vectorStore.search(query, {
  where: {
    userId: tenantContext.userId,
    projectId: tenantContext.projectId,
  },
});
```

### 5.2 Problema: Rate limiting não funciona por tenant

**Sintoma:**

```typescript
// Todos os tenants compartilham o mesmo limite
```

**Diagnóstico:**

```typescript
// Verificar se chave do rate limiter inclui tenant
console.log("Rate limit key:", rateLimiter.buildKey(tenantContext));
// Deve ser algo como: "ratelimit:user-001:proj-x"
```

**Solução:**

```typescript
// src/utils/tenant-rate-limiter.ts
class TenantRateLimiter {
  private buildKey(context: TenantContext, operation: string): string {
    // ✅ Incluir userId e projectId na chave
    return `ratelimit:${context.userId}:${context.projectId}:${operation}`;
  }

  async checkLimit(context: TenantContext, operation: string) {
    const key = this.buildKey(context, operation);
    // ...
  }
}
```

### 5.3 Problema: Cache retornando dados de outro tenant

**Sintoma:**

```typescript
// Cache contaminado entre tenants
const contextA = await getContext(query, tenantA);
const contextB = await getContext(query, tenantB);
// contextA === contextB ❌
```

**Diagnóstico:**

```typescript
// Verificar chave de cache
console.log("Cache key:", cache.buildKey("search", query, tenantContext));
// Deve incluir userId e projectId
```

**Solução:**

```typescript
class TenantCacheManager {
  private buildKey(
    operation: string,
    params: any,
    context: TenantContext,
  ): string {
    // ✅ Namespace por tenant
    const namespace = `${context.userId}:${context.projectId}`;
    const paramsHash = this.hash(JSON.stringify(params));

    return `cache:${namespace}:${operation}:${paramsHash}`;
  }
}
```

### 5.4 Problema: Performance degradada com muitos tenants

**Sintoma:**

```typescript
// Latência aumenta proporcionalmente ao número de tenants
```

**Diagnóstico:**

```typescript
// Verificar uso de índices
const explain = await db.all(
  `
  EXPLAIN QUERY PLAN
  SELECT * FROM memories
  WHERE user_id = ? AND project_id = ?
`,
  [userId, projectId],
);

console.log(explain);
// Deve usar índice idx_memories_tenant
```

**Solução:**

```sql
-- Criar índices compostos
CREATE INDEX idx_memories_tenant_created
ON memories(user_id, project_id, created_at DESC);

CREATE INDEX idx_memories_tenant_importance
ON memories(user_id, project_id, importance DESC);

-- Analisar para atualizar estatísticas
ANALYZE;
```

### 5.5 Problema: Embeddings duplicados ocupando muito espaço

**Solução:**

```typescript
// src/services/optimization/embedding-deduplicator.ts
class EmbeddingDeduplicator {
  async deduplicateEmbeddings() {
    // Identificar conteúdo duplicado
    const duplicates = await this.db.all(`
      SELECT content_hash, COUNT(*) as count
      FROM memories
      GROUP BY content_hash
      HAVING count > 1
    `);

    for (const dup of duplicates) {
      // Manter uma embedding, referenciar nos outros
      const [canonical, ...others] = await this.db.all(
        "SELECT id FROM memories WHERE content_hash = ?",
        [dup.content_hash],
      );

      // Atualizar vector store
      await this.vectorStore.deduplicateEmbedding(
        canonical.id,
        others.map((o) => o.id),
      );
    }
  }
}
```

---

## Recursos Adicionais

- **Documentação Principal:** [14-multi-tenant-architecture.md](./14-multi-tenant-architecture.md)
- **Diagrama Visual:** [Ver no ToDiagram](https://todiagram.com/editor?doc=c5c820a499a5267861655850)
- **Tests:** `tests/integration/multi-tenant.test.ts`
- **Migrations:** `migrations/001_add_tenant_support.sql`

---

**Dúvidas?** Abra uma issue no GitHub ou consulte a [documentação completa](./14-multi-tenant-architecture.md).
