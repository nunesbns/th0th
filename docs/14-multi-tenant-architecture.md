# Multi-Tenant Architecture no th0th MCP

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Conceitos de Multi-Tenancy](#2-conceitos-de-multi-tenancy)
3. [Arquitetura de Isolamento](#3-arquitetura-de-isolamento)
4. [Implementação no th0th MCP](#4-implementação-no-th0th-mcp)
5. [Estratégias de Isolamento](#5-estratégias-de-isolamento)
6. [Segurança e Autorização](#6-segurança-e-autorização)
7. [Performance e Escalabilidade](#7-performance-e-escalabilidade)
8. [Guia de Implementação](#8-guia-de-implementação)
9. [Exemplos Práticos](#9-exemplos-práticos)
10. [Monitoramento e Observabilidade](#10-monitoramento-e-observabilidade)
11. [Migração e Deploy](#11-migração-e-deploy)

---

## 1. Visão Geral

### O que é Multi-Tenancy?

Multi-tenancy é um padrão arquitetural onde uma única instância de software serve múltiplos clientes (tenants), mantendo isolamento completo de dados e configurações entre eles.

### Por que usar Multi-Tenancy no th0th MCP?

**Benefícios:**

- ✅ **Economia de recursos** - Uma instância serve múltiplos usuários/projetos
- ✅ **Isolamento de dados** - Cada tenant tem sua própria área de memória
- ✅ **Escalabilidade** - Adicione tenants sem provisionar novos servidores
- ✅ **Manutenção simplificada** - Atualizações centralizadas
- ✅ **Custo otimizado** - Compartilhamento inteligente de cache e embeddings

**Use Cases:**

- Múltiplos desenvolvedores na mesma organização
- Múltiplos projetos independentes
- Ambientes development/staging/production
- SaaS com múltiplos clientes

---

## 2. Conceitos de Multi-Tenancy

### 2.1 Identificadores de Tenant

No th0th MCP, utilizamos três níveis de identificação:

```typescript
interface TenantContext {
  userId: string; // Identifica o desenvolvedor/usuário
  projectId: string; // Identifica o projeto/codebase
  sessionId: string; // Identifica a sessão de trabalho
}
```

**Hierarquia:**

```
Organization (implícito)
  ├── User A (userId: "user-001")
  │   ├── Project X (projectId: "proj-x")
  │   │   ├── Session 1 (sessionId: "sess-123")
  │   │   └── Session 2 (sessionId: "sess-124")
  │   └── Project Y (projectId: "proj-y")
  └── User B (userId: "user-002")
      └── Project Z (projectId: "proj-z")
```

### 2.2 Tipos de Isolamento

| Tipo                  | Descrição                               | Nível de Isolamento      | Complexidade |
| --------------------- | --------------------------------------- | ------------------------ | ------------ |
| **Shared Database**   | Todos os tenants no mesmo DB            | Campo `tenantId`         | Baixa        |
| **Shared Schema**     | Schema compartilhado, tabelas separadas | Prefixo/Sufixo de tabela | Média        |
| **Separate Schema**   | Schema dedicado por tenant              | Schema PostgreSQL        | Média-Alta   |
| **Separate Database** | Banco dedicado por tenant               | Database completo        | Alta         |

**No th0th MCP, utilizamos híbrido:**

- **Shared Database** para cache e embeddings (otimização)
- **Namespace Isolation** para memórias e contexto (segurança)

---

## 3. Arquitetura de Isolamento

### 3.1 Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENCODE (Multi-User)                         │
│  User A (proj-x)  │  User A (proj-y)  │  User B (proj-z)       │
└────────┬───────────┴──────────┬─────────┴────────────┬──────────┘
         │                      │                       │
         │    ┌─────────────────┴──────────────┐        │
         └────▶   MCP RLM SERVER (Shared)      ◀────────┘
              │                                 │
              │  ┌───────────────────────────┐ │
              │  │  TENANT ISOLATION LAYER   │ │
              │  │  • Context Extraction     │ │
              │  │  • Authorization Check    │ │
              │  │  • Resource Routing       │ │
              │  └───────────────────────────┘ │
              └─────────────┬───────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  TENANT A       │  │  TENANT B       │  │  SHARED LAYER   │
│  (user-001)     │  │  (user-002)     │  │                 │
│                 │  │                 │  │  • Embeddings   │
│  • Memories     │  │  • Memories     │  │  • Cache        │
│  • Sessions     │  │  • Sessions     │  │  • Rate Limits  │
│  • Context      │  │  • Context      │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3.2 Camadas de Isolamento

#### Camada 1: API Layer (Identificação)

```typescript
// src/api/middleware/tenant-context.ts
export class TenantContextMiddleware {
  extractTenantContext(request: any): TenantContext {
    return {
      userId: request.params.userId || "default",
      projectId: request.params.projectId,
      sessionId: request.params.sessionId || this.generateSessionId(),
    };
  }
}
```

#### Camada 2: Service Layer (Isolamento)

```typescript
// src/services/memory/tenant-memory-service.ts
export class TenantMemoryService {
  async getMemory(tenantContext: TenantContext, memoryId: string) {
    // Adiciona filtro de tenant automaticamente
    const memory = await this.repository.findOne({
      id: memoryId,
      userId: tenantContext.userId,
      projectId: tenantContext.projectId,
    });

    if (!memory) {
      throw new UnauthorizedError("Memory not found or access denied");
    }

    return memory;
  }
}
```

#### Camada 3: Data Layer (Persistência)

```typescript
// src/data/repositories/memory-repository.ts
export class MemoryRepository {
  async create(memory: Memory, tenantContext: TenantContext) {
    // Adiciona metadados de tenant
    return await this.db.insert({
      ...memory,
      userId: tenantContext.userId,
      projectId: tenantContext.projectId,
      createdAt: new Date(),
    });
  }

  async findByTenant(tenantContext: TenantContext, filters: any) {
    // WHERE clause automático
    return await this.db.query(
      `
      SELECT * FROM memories
      WHERE userId = ? AND projectId = ?
      ${this.buildFilters(filters)}
    `,
      [tenantContext.userId, tenantContext.projectId],
    );
  }
}
```

---

## 4. Implementação no th0th MCP

### 4.1 Estrutura Atual

O th0th MCP **já possui primitivas** de multi-tenancy:

**Arquivo:** `src/server.ts:86-98`

```typescript
{
  name: 'get_optimized_context',
  inputSchema: {
    properties: {
      query: { type: 'string' },
      maxTokens: { type: 'number', default: 8000 },
      userId: { type: 'string', description: 'User ID for personalized context' },
      sessionId: { type: 'string', description: 'Session ID for conversation context' },
      projectId: { type: 'string', description: 'Project ID for code context' },
    }
  }
}
```

### 4.2 Fluxo de Execução Multi-Tenant

```
┌─────────────────────────────────────────────────────────────┐
│ 1. OPENCODE envia request com tenant context               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 2. MCP Server extrai tenant identifiers                    │
│    • userId: "dev-123"                                      │
│    • projectId: "my-saas-app"                               │
│    • sessionId: "sess-abc-456"                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 3. Tenant Context Middleware valida e enriquece            │
│    • Verifica autenticação (se habilitado)                 │
│    • Adiciona metadata de tenant                            │
│    • Registra métricas por tenant                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 4. Service Layer aplica filtros de tenant                  │
│    • Busca vetorial: WHERE userId = 'dev-123'              │
│    • Cache: Key = "cache:dev-123:my-saas-app:query-hash"   │
│    • Rate Limit: Counter = "ratelimit:dev-123"             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 5. Data Layer retorna dados isolados                       │
│    • Apenas memórias do tenant                              │
│    • Cache compartilhado (quando aplicável)                 │
│    • Embeddings reutilizados (economia)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Estratégias de Isolamento

### 5.1 Isolamento de Dados

#### A. Vector Store (ChromaDB)

**Opção 1: Collection por Tenant (Isolamento Forte)**

```typescript
// src/data/chromadb/tenant-vector-store.ts
export class TenantVectorStore {
  private getCollectionName(tenantContext: TenantContext): string {
    return `memories_${tenantContext.userId}_${tenantContext.projectId}`;
  }

  async search(query: string, tenantContext: TenantContext) {
    const collection = await this.client.getOrCreateCollection({
      name: this.getCollectionName(tenantContext),
    });

    return await collection.query({
      queryTexts: [query],
      nResults: 10,
    });
  }
}
```

**Opção 2: Shared Collection com Metadata Filtering (Economia de Recursos)**

```typescript
export class SharedVectorStore {
  async search(query: string, tenantContext: TenantContext) {
    const collection = await this.client.getCollection("memories_shared");

    return await collection.query({
      queryTexts: [query],
      nResults: 10,
      where: {
        userId: tenantContext.userId,
        projectId: tenantContext.projectId,
      },
    });
  }

  async add(document: Document, tenantContext: TenantContext) {
    await collection.add({
      documents: [document.content],
      metadatas: [
        {
          userId: tenantContext.userId,
          projectId: tenantContext.projectId,
          type: document.type,
        },
      ],
      ids: [document.id],
    });
  }
}
```

**Recomendação:** Use **Opção 2** (Shared Collection) para:

- Embeddings reutilizáveis (bibliotecas públicas, docs oficiais)
- Otimização de custos
- Facilitar deduplicação

Use **Opção 1** (Collection por Tenant) para:

- Dados sensíveis
- Compliance rigoroso
- Clientes enterprise

#### B. SQLite (Keyword Search & Cache)

**Schema Design:**

```sql
-- Tabela de memórias com tenant isolation
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  created_at INTEGER NOT NULL,

  -- Índices para performance
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_memories_tenant ON memories(user_id, project_id);
CREATE INDEX idx_memories_session ON memories(session_id);
CREATE INDEX idx_memories_created ON memories(created_at DESC);

-- FTS5 para busca full-text
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content,
  content='memories',
  content_rowid='rowid'
);

-- Trigger para manter FTS sincronizado
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Cache com TTL e tenant isolation
CREATE TABLE cache_entries (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  value TEXT NOT NULL,
  ttl INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  hits INTEGER DEFAULT 0
);

CREATE INDEX idx_cache_tenant ON cache_entries(user_id, project_id);
CREATE INDEX idx_cache_ttl ON cache_entries(ttl);
```

**Repository Implementation:**

```typescript
// src/data/sqlite/tenant-keyword-search.ts
export class TenantKeywordSearch {
  async search(
    query: string,
    tenantContext: TenantContext,
    limit: number = 10,
  ) {
    return await this.db.all(
      `
      SELECT 
        m.*,
        rank AS relevance
      FROM memories m
      INNER JOIN memories_fts fts ON fts.rowid = m.rowid
      WHERE fts MATCH ?
        AND m.user_id = ?
        AND m.project_id = ?
      ORDER BY rank
      LIMIT ?
    `,
      [query, tenantContext.userId, tenantContext.projectId, limit],
    );
  }
}
```

### 5.2 Isolamento de Cache

#### Cache Strategy com Multi-Tenancy

```typescript
// src/services/cache/tenant-cache-manager.ts
export class TenantCacheManager {
  private buildCacheKey(
    operation: string,
    params: any,
    tenantContext: TenantContext,
  ): string {
    // Namespace por tenant
    const namespace = `${tenantContext.userId}:${tenantContext.projectId}`;
    const paramHash = this.hashParams(params);

    return `cache:${namespace}:${operation}:${paramHash}`;
  }

  async get<T>(key: string, tenantContext: TenantContext): Promise<T | null> {
    const fullKey = this.buildCacheKey(key, {}, tenantContext);

    // Tenta L1 (memory)
    let value = this.l1Cache.get(fullKey);
    if (value) {
      this.metrics.recordHit("l1", tenantContext);
      return value as T;
    }

    // Tenta L2 (SQLite)
    value = await this.l2Cache.get(fullKey, tenantContext);
    if (value) {
      this.l1Cache.set(fullKey, value);
      this.metrics.recordHit("l2", tenantContext);
      return value as T;
    }

    this.metrics.recordMiss(tenantContext);
    return null;
  }
}
```

**Cache Compartilhado para Embeddings:**

```typescript
// src/services/embeddings/shared-embedding-cache.ts
export class SharedEmbeddingCache {
  private buildSharedKey(text: string): string {
    // Hash do conteúdo (não inclui tenant)
    return `embedding:${this.hashText(text)}`;
  }

  async getEmbedding(text: string): Promise<number[] | null> {
    // Embeddings são compartilhados entre tenants (economia)
    const key = this.buildSharedKey(text);
    return await this.cache.get(key);
  }

  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = this.buildSharedKey(text);
    await this.cache.set(key, embedding, {
      ttl: 7 * 24 * 60 * 60, // 7 dias
      shared: true,
    });
  }
}
```

### 5.3 Isolamento de Rate Limiting

```typescript
// src/utils/tenant-rate-limiter.ts
export class TenantRateLimiter {
  private limits = new Map<string, TokenBucket>();

  async checkLimit(
    tenantContext: TenantContext,
    operation: string,
  ): Promise<void> {
    const key = `${tenantContext.userId}:${operation}`;

    let bucket = this.limits.get(key);
    if (!bucket) {
      bucket = new TokenBucket({
        capacity: this.getCapacity(tenantContext, operation),
        refillRate: this.getRefillRate(tenantContext, operation),
      });
      this.limits.set(key, bucket);
    }

    if (!bucket.consume(1)) {
      throw new RateLimitError(`Rate limit exceeded for ${operation}`, {
        tenantId: tenantContext.userId,
        operation,
        resetAt: bucket.getResetTime(),
      });
    }
  }

  private getCapacity(tenantContext: TenantContext, operation: string): number {
    // Busca limites por tenant (pode vir de config ou DB)
    return this.config.getRateLimit(tenantContext.userId, operation) || 100;
  }
}
```

---

## 6. Segurança e Autorização

### 6.1 Authentication & Authorization

```typescript
// src/api/middleware/auth-middleware.ts
export class AuthMiddleware {
  async authenticate(request: any): Promise<TenantContext> {
    // Extrai token (se habilitado)
    const token = this.extractToken(request);

    if (!token && this.config.requireAuth) {
      throw new UnauthorizedError("Authentication required");
    }

    // Valida token (JWT, API Key, etc.)
    const claims = await this.validateToken(token);

    return {
      userId: claims.userId,
      projectId: request.params.projectId || claims.defaultProjectId,
      sessionId: request.params.sessionId || this.generateSessionId(),
      permissions: claims.permissions || [],
    };
  }

  async authorize(
    tenantContext: TenantContext,
    resource: string,
    action: string,
  ): Promise<void> {
    const hasPermission = await this.checkPermission(
      tenantContext,
      resource,
      action,
    );

    if (!hasPermission) {
      throw new ForbiddenError(
        `User ${tenantContext.userId} cannot ${action} ${resource}`,
      );
    }
  }
}
```

### 6.2 Data Encryption

```typescript
// src/utils/tenant-encryption.ts
export class TenantEncryption {
  private getEncryptionKey(tenantContext: TenantContext): Buffer {
    // Cada tenant pode ter sua própria chave
    return this.keyStore.getKey(tenantContext.userId);
  }

  async encryptMemory(
    content: string,
    tenantContext: TenantContext,
  ): Promise<string> {
    const key = this.getEncryptionKey(tenantContext);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(content, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString("hex"),
      data: encrypted,
      tag: authTag.toString("hex"),
    });
  }

  async decryptMemory(
    encrypted: string,
    tenantContext: TenantContext,
  ): Promise<string> {
    const { iv, data, tag } = JSON.parse(encrypted);
    const key = this.getEncryptionKey(tenantContext);

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex"),
    );

    decipher.setAuthTag(Buffer.from(tag, "hex"));

    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
```

### 6.3 Audit Logging

```typescript
// src/services/audit/audit-logger.ts
export class AuditLogger {
  async log(event: AuditEvent, tenantContext: TenantContext): Promise<void> {
    await this.db.insert("audit_logs", {
      id: this.generateId(),
      userId: tenantContext.userId,
      projectId: tenantContext.projectId,
      sessionId: tenantContext.sessionId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      metadata: JSON.stringify(event.metadata),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: Date.now(),
    });
  }

  async queryLogs(tenantContext: TenantContext, filters: AuditFilters) {
    return await this.db.query(
      `
      SELECT * FROM audit_logs
      WHERE user_id = ?
        AND project_id = ?
        ${this.buildFilters(filters)}
      ORDER BY timestamp DESC
      LIMIT ?
    `,
      [tenantContext.userId, tenantContext.projectId, filters.limit || 100],
    );
  }
}
```

---

## 7. Performance e Escalabilidade

### 7.1 Estratégias de Otimização

#### Compartilhamento Inteligente de Recursos

```typescript
// src/services/optimization/shared-resource-optimizer.ts
export class SharedResourceOptimizer {
  /**
   * Identifica conteúdo que pode ser compartilhado entre tenants
   */
  async identifySharedContent(content: string): Promise<boolean> {
    // Conteúdo público (docs oficiais, bibliotecas, etc.)
    if (this.isPublicContent(content)) {
      return true;
    }

    // Hash de conteúdo já indexado por múltiplos tenants
    const contentHash = this.hashContent(content);
    const sharedCount = await this.db.count(
      "SELECT COUNT(DISTINCT user_id) FROM memories WHERE content_hash = ?",
      [contentHash],
    );

    return sharedCount > 3; // Threshold configurável
  }

  async storeOptimized(
    content: string,
    tenantContext: TenantContext,
  ): Promise<void> {
    const isShared = await this.identifySharedContent(content);

    if (isShared) {
      // Armazena embedding uma vez, referencia múltiplas vezes
      const contentHash = this.hashContent(content);
      let embedding = await this.sharedEmbeddingCache.get(contentHash);

      if (!embedding) {
        embedding = await this.embedder.embed(content);
        await this.sharedEmbeddingCache.set(contentHash, embedding);
      }

      // Armazena apenas referência para o tenant
      await this.vectorStore.addReference({
        contentHash,
        tenantContext,
        metadata: { shared: true },
      });
    } else {
      // Armazena embedding dedicado
      await this.vectorStore.add({
        content,
        tenantContext,
        metadata: { shared: false },
      });
    }
  }
}
```

### 7.2 Connection Pooling

```typescript
// src/data/connection-pool.ts
export class TenantConnectionPool {
  private pools = new Map<string, DatabasePool>();

  getConnection(tenantContext: TenantContext): Database {
    const poolKey = this.getPoolKey(tenantContext);

    let pool = this.pools.get(poolKey);
    if (!pool) {
      pool = this.createPool(tenantContext);
      this.pools.set(poolKey, pool);
    }

    return pool.acquire();
  }

  private getPoolKey(tenantContext: TenantContext): string {
    // Pool por projeto (não por usuário) para otimizar
    return tenantContext.projectId;
  }

  private createPool(tenantContext: TenantContext): DatabasePool {
    return new DatabasePool({
      filename: this.getDatabasePath(tenantContext),
      maxConnections: 10,
      idleTimeout: 60000,
    });
  }
}
```

### 7.3 Métricas por Tenant

```typescript
// src/services/metrics/tenant-metrics.ts
export class TenantMetrics {
  private metrics = new Map<string, TenantMetricData>();

  recordOperation(
    operation: string,
    duration: number,
    tenantContext: TenantContext,
  ): void {
    const key = this.getMetricKey(tenantContext);
    const data = this.metrics.get(key) || this.initMetrics();

    data.operations[operation] = data.operations[operation] || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
    };

    data.operations[operation].count++;
    data.operations[operation].totalDuration += duration;
    data.operations[operation].avgDuration =
      data.operations[operation].totalDuration /
      data.operations[operation].count;

    this.metrics.set(key, data);
  }

  async getMetrics(tenantContext: TenantContext): Promise<TenantMetricData> {
    const key = this.getMetricKey(tenantContext);
    return this.metrics.get(key) || this.initMetrics();
  }

  async exportMetrics(tenantContext: TenantContext): Promise<void> {
    const metrics = await this.getMetrics(tenantContext);

    await this.db.insert("tenant_metrics", {
      userId: tenantContext.userId,
      projectId: tenantContext.projectId,
      date: new Date().toISOString().split("T")[0],
      data: JSON.stringify(metrics),
      createdAt: Date.now(),
    });
  }
}
```

---

## 8. Guia de Implementação

### 8.1 Passo a Passo

#### Fase 1: Preparação (1 dia)

**1.1 Atualizar Models**

```typescript
// src/models/TenantContext.ts
export interface TenantContext {
  userId: string;
  projectId: string;
  sessionId: string;
  organizationId?: string;
  permissions?: string[];
}

export class TenantContextValidator {
  static validate(context: Partial<TenantContext>): TenantContext {
    if (!context.userId) {
      throw new ValidationError("userId is required");
    }

    if (!context.projectId) {
      throw new ValidationError("projectId is required");
    }

    return {
      userId: context.userId,
      projectId: context.projectId,
      sessionId: context.sessionId || this.generateSessionId(),
      organizationId: context.organizationId,
      permissions: context.permissions || [],
    };
  }
}
```

**1.2 Criar Middleware**

```typescript
// src/api/middleware/tenant-middleware.ts
export class TenantMiddleware {
  handle(request: any, next: Function): any {
    const tenantContext = this.extractTenantContext(request);

    // Valida
    const validated = TenantContextValidator.validate(tenantContext);

    // Adiciona ao request
    request.tenantContext = validated;

    // Log
    this.logger.debug("Tenant context extracted", validated);

    return next();
  }

  private extractTenantContext(request: any): Partial<TenantContext> {
    return {
      userId: request.params.userId || request.headers["x-user-id"],
      projectId: request.params.projectId || request.headers["x-project-id"],
      sessionId: request.params.sessionId || request.headers["x-session-id"],
      organizationId: request.headers["x-organization-id"],
    };
  }
}
```

#### Fase 2: Data Layer (2 dias)

**2.1 Atualizar Schema SQLite**

```bash
# Execute migrations
npm run migrate:tenant
```

```sql
-- migrations/001_add_tenant_columns.sql
ALTER TABLE memories ADD COLUMN user_id TEXT;
ALTER TABLE memories ADD COLUMN project_id TEXT;
ALTER TABLE memories ADD COLUMN organization_id TEXT;

CREATE INDEX idx_memories_user ON memories(user_id);
CREATE INDEX idx_memories_project ON memories(project_id);
CREATE INDEX idx_memories_composite ON memories(user_id, project_id);

-- Migrar dados existentes
UPDATE memories SET
  user_id = 'default',
  project_id = 'default'
WHERE user_id IS NULL;
```

**2.2 Atualizar Repositories**

```typescript
// src/data/repositories/memory-repository.ts
export class MemoryRepository {
  async create(
    memory: Omit<Memory, "id">,
    tenantContext: TenantContext,
  ): Promise<Memory> {
    const id = this.generateId();

    await this.db.run(
      `
      INSERT INTO memories (
        id, user_id, project_id, content, type, importance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        tenantContext.userId,
        tenantContext.projectId,
        memory.content,
        memory.type,
        memory.importance,
        Date.now(),
      ],
    );

    return { ...memory, id };
  }

  async findByTenant(
    tenantContext: TenantContext,
    filters?: MemoryFilters,
  ): Promise<Memory[]> {
    const where = ["user_id = ?", "project_id = ?"];
    const params = [tenantContext.userId, tenantContext.projectId];

    if (filters?.type) {
      where.push("type = ?");
      params.push(filters.type);
    }

    if (filters?.minImportance) {
      where.push("importance >= ?");
      params.push(filters.minImportance);
    }

    return await this.db.all(
      `
      SELECT * FROM memories
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [...params, filters?.limit || 100],
    );
  }
}
```

#### Fase 3: Service Layer (2 dias)

**3.1 Atualizar Services**

```typescript
// src/services/memory/memory-service.ts
export class MemoryService {
  constructor(
    private repository: MemoryRepository,
    private vectorStore: VectorStore,
    private cache: CacheManager,
  ) {}

  async storeMemory(
    content: string,
    type: MemoryType,
    tenantContext: TenantContext,
    options?: StoreOptions,
  ): Promise<Memory> {
    // Validação
    this.validateContent(content);

    // Rate limiting
    await this.rateLimiter.checkLimit(tenantContext, "store_memory");

    // Criar memória
    const memory = await this.repository.create(
      {
        content,
        type,
        importance: options?.importance || 0.5,
      },
      tenantContext,
    );

    // Indexar no vector store
    await this.vectorStore.add({
      id: memory.id,
      content: memory.content,
      metadata: {
        userId: tenantContext.userId,
        projectId: tenantContext.projectId,
        type: memory.type,
      },
    });

    // Invalidar cache
    await this.cache.invalidate(`memories:${tenantContext.userId}`);

    // Audit log
    await this.auditLogger.log(
      {
        action: "store_memory",
        resource: "memory",
        resourceId: memory.id,
      },
      tenantContext,
    );

    return memory;
  }

  async searchMemories(
    query: string,
    tenantContext: TenantContext,
    options?: SearchOptions,
  ): Promise<Memory[]> {
    // Check cache
    const cacheKey = this.buildCacheKey("search", query, tenantContext);
    const cached = await this.cache.get<Memory[]>(cacheKey);
    if (cached) return cached;

    // Hybrid search com filtro de tenant
    const results = await this.hybridSearch.search(query, {
      userId: tenantContext.userId,
      projectId: tenantContext.projectId,
      limit: options?.limit || 10,
    });

    // Cache results
    await this.cache.set(cacheKey, results, { ttl: 300 });

    return results;
  }
}
```

#### Fase 4: API Layer (1 dia)

**4.1 Atualizar Handlers**

```typescript
// src/api/handlers/memory-handlers.ts
export class MemoryHandlers {
  constructor(private memoryService: MemoryService) {}

  async handleStoreMemory(request: any): Promise<ToolResponse> {
    const tenantContext = request.tenantContext; // Do middleware
    const { content, type, importance } = request.params.arguments;

    try {
      const memory = await this.memoryService.storeMemory(
        content,
        type,
        tenantContext,
        { importance },
      );

      return {
        success: true,
        data: { memory },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async handleSearchMemories(request: any): Promise<ToolResponse> {
    const tenantContext = request.tenantContext;
    const { query, limit } = request.params.arguments;

    const memories = await this.memoryService.searchMemories(
      query,
      tenantContext,
      { limit },
    );

    return {
      success: true,
      data: { memories },
    };
  }
}
```

**4.2 Integrar Middleware no Server**

```typescript
// src/server.ts
export class McpRlmServer {
  constructor() {
    this.server = new Server({...});

    // Adicionar middleware
    this.tenantMiddleware = new TenantMiddleware(logger);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Aplica middleware
      const enrichedRequest = this.tenantMiddleware.handle(request);

      // Processa tool call
      return await this.handleToolCall(enrichedRequest);
    });
  }
}
```

#### Fase 5: Testing (1 dia)

**5.1 Testes de Isolamento**

```typescript
// tests/integration/tenant-isolation.test.ts
describe("Tenant Isolation", () => {
  it("should isolate memories between tenants", async () => {
    const tenant1 = { userId: "user1", projectId: "proj1", sessionId: "sess1" };
    const tenant2 = { userId: "user2", projectId: "proj2", sessionId: "sess2" };

    // Tenant 1 stores memory
    await memoryService.storeMemory("Secret data A", "code", tenant1);

    // Tenant 2 stores memory
    await memoryService.storeMemory("Secret data B", "code", tenant2);

    // Tenant 1 searches
    const results1 = await memoryService.searchMemories("Secret", tenant1);
    expect(results1).toHaveLength(1);
    expect(results1[0].content).toBe("Secret data A");

    // Tenant 2 searches
    const results2 = await memoryService.searchMemories("Secret", tenant2);
    expect(results2).toHaveLength(1);
    expect(results2[0].content).toBe("Secret data B");
  });

  it("should prevent cross-tenant access", async () => {
    const tenant1 = { userId: "user1", projectId: "proj1", sessionId: "sess1" };
    const tenant2 = { userId: "user2", projectId: "proj2", sessionId: "sess2" };

    const memory = await memoryService.storeMemory("Data", "code", tenant1);

    // Tenant 2 tenta acessar memória do Tenant 1
    await expect(memoryService.getMemory(memory.id, tenant2)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
```

---

## 9. Exemplos Práticos

### 9.1 Cenário 1: Equipe de Desenvolvimento

**Setup:**

```typescript
// Configuração da organização
const organization = {
  id: "acme-corp",
  name: "Acme Corporation",
};

// Desenvolvedores
const alice: TenantContext = {
  userId: "alice@acme.com",
  projectId: "ecommerce-platform",
  sessionId: "sess-001",
  organizationId: "acme-corp",
};

const bob: TenantContext = {
  userId: "bob@acme.com",
  projectId: "mobile-app",
  sessionId: "sess-002",
  organizationId: "acme-corp",
};
```

**Uso:**

```typescript
// Alice trabalha no e-commerce
await mcpClient.callTool("store_memory", {
  content: "Implementamos cache Redis para o carrinho de compras",
  type: "decision",
  userId: alice.userId,
  projectId: alice.projectId,
  sessionId: alice.sessionId,
});

// Bob trabalha no app mobile
await mcpClient.callTool("store_memory", {
  content: "Usando React Native para iOS e Android",
  type: "pattern",
  userId: bob.userId,
  projectId: bob.projectId,
  sessionId: bob.sessionId,
});

// Alice busca informações sobre seu projeto
const aliceContext = await mcpClient.callTool("get_optimized_context", {
  query: "cache implementation",
  userId: alice.userId,
  projectId: alice.projectId,
  maxTokens: 4000,
});

// Bob não vê dados de Alice
const bobContext = await mcpClient.callTool("get_optimized_context", {
  query: "cache implementation",
  userId: bob.userId,
  projectId: bob.projectId,
  maxTokens: 4000,
});

console.log(aliceContext.context.includes("Redis")); // true
console.log(bobContext.context.includes("Redis")); // false
```

### 9.2 Cenário 2: SaaS Multi-Cliente

**Setup:**

```typescript
// Cliente A (Startup)
const clientA: TenantContext = {
  userId: "startup-xyz",
  projectId: "mvp-v1",
  sessionId: "sess-startup-001",
};

// Cliente B (Enterprise)
const clientB: TenantContext = {
  userId: "enterprise-abc",
  projectId: "legacy-migration",
  sessionId: "sess-enterprise-001",
};
```

**Rate Limiting Diferenciado:**

```typescript
// src/config/tenant-limits.ts
export const tenantLimits = {
  "startup-xyz": {
    requestsPerMinute: 60,
    maxStorageMB: 100,
    maxProjectsPerUser: 3,
  },
  "enterprise-abc": {
    requestsPerMinute: 1000,
    maxStorageMB: 10000,
    maxProjectsPerUser: 100,
  },
};
```

### 9.3 Cenário 3: Ambientes Múltiplos

**Setup:**

```typescript
const devEnvironment: TenantContext = {
  userId: "john@company.com",
  projectId: "api-gateway",
  sessionId: "dev-session",
  environment: "development",
};

const prodEnvironment: TenantContext = {
  userId: "john@company.com",
  projectId: "api-gateway",
  sessionId: "prod-session",
  environment: "production",
};
```

**Isolamento por Ambiente:**

```typescript
// Diferentes coleções no vector store
const getCollectionName = (context: TenantContext) => {
  return `${context.projectId}_${context.environment || "dev"}`;
};

// Dev: testa mudanças sem afetar prod
await vectorStore.add({
  content: "Testing new authentication flow",
  collection: getCollectionName(devEnvironment),
});

// Prod: dados isolados
await vectorStore.search({
  query: "authentication",
  collection: getCollectionName(prodEnvironment),
});
```

---

## 10. Monitoramento e Observabilidade

### 10.1 Métricas Essenciais

```typescript
// src/services/observability/metrics-collector.ts
export class MetricsCollector {
  async collectTenantMetrics(tenantContext: TenantContext) {
    return {
      // Uso de recursos
      storage: {
        totalBytes: await this.getStorageUsage(tenantContext),
        memoryCount: await this.getMemoryCount(tenantContext),
        vectorCount: await this.getVectorCount(tenantContext),
      },

      // Performance
      performance: {
        avgQueryLatency: await this.getAvgLatency(tenantContext, "query"),
        avgStoreLatency: await this.getAvgLatency(tenantContext, "store"),
        cacheHitRate: await this.getCacheHitRate(tenantContext),
      },

      // Rate limiting
      rateLimit: {
        requestsLastMinute: await this.getRequestCount(tenantContext, 60),
        requestsLastHour: await this.getRequestCount(tenantContext, 3600),
        throttledRequests: await this.getThrottledCount(tenantContext),
      },

      // Costs (se aplicável)
      costs: {
        embeddingCalls: await this.getEmbeddingCalls(tenantContext),
        llmTokensUsed: await this.getLLMTokens(tenantContext),
        estimatedCost: await this.calculateCost(tenantContext),
      },
    };
  }
}
```

### 10.2 Dashboard de Tenant

```typescript
// src/api/resources/tenant-dashboard.ts
export class TenantDashboard {
  async getDashboard(tenantContext: TenantContext) {
    const [metrics, recentActivity, topQueries] = await Promise.all([
      this.metricsCollector.collectTenantMetrics(tenantContext),
      this.getRecentActivity(tenantContext, 100),
      this.getTopQueries(tenantContext, 10),
    ]);

    return {
      tenant: {
        userId: tenantContext.userId,
        projectId: tenantContext.projectId,
      },
      metrics,
      recentActivity,
      topQueries,
      health: this.calculateHealthScore(metrics),
    };
  }

  private calculateHealthScore(metrics: any): number {
    let score = 100;

    // Penaliza alta latência
    if (metrics.performance.avgQueryLatency > 1000) {
      score -= 20;
    }

    // Penaliza baixo cache hit rate
    if (metrics.performance.cacheHitRate < 0.5) {
      score -= 15;
    }

    // Penaliza alto throttling
    if (metrics.rateLimit.throttledRequests > 10) {
      score -= 25;
    }

    return Math.max(0, score);
  }
}
```

### 10.3 Alertas

```typescript
// src/services/observability/alert-manager.ts
export class AlertManager {
  async checkAlerts(tenantContext: TenantContext): Promise<void> {
    const metrics =
      await this.metricsCollector.collectTenantMetrics(tenantContext);

    // Storage threshold
    if (
      metrics.storage.totalBytes >
      this.getStorageLimit(tenantContext) * 0.9
    ) {
      await this.sendAlert({
        severity: "warning",
        message: `Tenant ${tenantContext.userId} approaching storage limit`,
        tenantContext,
      });
    }

    // High error rate
    const errorRate = await this.getErrorRate(tenantContext);
    if (errorRate > 0.05) {
      await this.sendAlert({
        severity: "critical",
        message: `Tenant ${tenantContext.userId} has high error rate: ${errorRate * 100}%`,
        tenantContext,
      });
    }

    // Unusual activity
    const requestCount = metrics.rateLimit.requestsLastMinute;
    const baseline = await this.getBaselineRequests(tenantContext);
    if (requestCount > baseline * 3) {
      await this.sendAlert({
        severity: "info",
        message: `Tenant ${tenantContext.userId} has unusual activity spike`,
        tenantContext,
      });
    }
  }
}
```

---

## 11. Migração e Deploy

### 11.1 Migração de Single-Tenant para Multi-Tenant

**Script de Migração:**

```typescript
// scripts/migrate-to-multitenant.ts
async function migrate() {
  console.log("Starting multi-tenant migration...");

  // 1. Backup
  await backupDatabase("./data/memories.db", "./backups/pre-migration.db");

  // 2. Add tenant columns
  await db.exec(`
    ALTER TABLE memories ADD COLUMN user_id TEXT DEFAULT 'default';
    ALTER TABLE memories ADD COLUMN project_id TEXT DEFAULT 'default';
  `);

  // 3. Create indices
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_tenant 
    ON memories(user_id, project_id);
  `);

  // 4. Migrate existing data
  const defaultTenant = {
    userId: "legacy-user",
    projectId: "legacy-project",
  };

  await db.run(
    `
    UPDATE memories 
    SET user_id = ?, project_id = ?
    WHERE user_id = 'default'
  `,
    [defaultTenant.userId, defaultTenant.projectId],
  );

  // 5. Verify
  const count = await db.get(
    "SELECT COUNT(*) as count FROM memories WHERE user_id = ?",
    [defaultTenant.userId],
  );
  console.log(
    `Migrated ${count.count} memories to tenant ${defaultTenant.userId}`,
  );

  console.log("Migration completed successfully!");
}
```

### 11.2 Deploy Checklist

```markdown
## Pre-Deploy

- [ ] Backup de todos os bancos de dados
- [ ] Testes de integração multi-tenant passando
- [ ] Testes de isolamento de dados validados
- [ ] Documentação atualizada
- [ ] Rate limits configurados por tenant
- [ ] Métricas e alertas configurados

## Deploy

- [ ] Deploy em ambiente de staging
- [ ] Smoke tests em staging
- [ ] Migração de dados em staging
- [ ] Validação de isolamento em staging
- [ ] Deploy em produção com rollback plan
- [ ] Execução de migrations em produção
- [ ] Verificação de saúde pós-deploy

## Post-Deploy

- [ ] Monitoramento de métricas por tenant
- [ ] Verificação de logs de erro
- [ ] Validação de performance
- [ ] Comunicação com stakeholders
- [ ] Documentação de lições aprendidas
```

### 11.3 Rollback Plan

```typescript
// scripts/rollback-multitenant.ts
async function rollback() {
  console.log("Starting rollback...");

  // 1. Restore backup
  await restoreDatabase("./backups/pre-migration.db", "./data/memories.db");

  // 2. Restart server
  await restartServer();

  // 3. Verify
  await runHealthChecks();

  console.log("Rollback completed!");
}
```

---

## Conclusão

Este documento apresentou uma arquitetura completa de multi-tenancy para o th0th MCP, incluindo:

✅ **Isolamento de dados** em múltiplas camadas
✅ **Segurança** com autenticação, autorização e criptografia
✅ **Performance** com cache compartilhado inteligente
✅ **Escalabilidade** com resource pooling e otimizações
✅ **Observabilidade** com métricas e alertas por tenant
✅ **Guia prático** de implementação passo a passo

### Próximos Passos

1. **Implementação Básica** (Sprint 1)
   - Adicionar TenantContext aos models
   - Criar middleware de extração
   - Atualizar repositories com filtros de tenant

2. **Isolamento Completo** (Sprint 2)
   - Implementar isolamento no vector store
   - Adicionar rate limiting por tenant
   - Criar testes de isolamento

3. **Observabilidade** (Sprint 3)
   - Implementar métricas por tenant
   - Criar dashboard de tenant
   - Configurar alertas

4. **Produção** (Sprint 4)
   - Executar migração
   - Deploy gradual
   - Monitoramento intensivo

### Recursos Adicionais

- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [Multi-Tenant Design Patterns](https://docs.microsoft.com/azure/architecture/patterns/)
- [Database Isolation Strategies](https://martinfowler.com/articles/multi-tenant.html)

---

**Documento criado usando o sistema RLM (Retrieval Language Model) do th0th MCP**
