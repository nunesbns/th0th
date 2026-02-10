# Arquitetura Alternativa: MCP RLM Sem memoria local (Standalone)

## Visão Geral

Esta arquitetura alternativa implementa o sistema MCP RLM **sem dependência obrigatória do camada de memoria local**, tornando-o um componente **opcional/complementar**. O sistema funciona completamente standalone usando apenas recursos locais.

## Arquitetura Standalone vs Com memoria local

```
┌─────────────────────────────────────────────────────────────────┐
│           VERSÃO STANDALONE (Sem memoria local)                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CAMADA DE MEMÓRIA LOCAL                     │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Working    │  │   Session    │  │   Persistent │  │   │
│  │  │   Memory     │  │   Memory     │  │   Memory     │  │   │
│  │  │   (RAM)      │  │   (SQLite)   │  │   (Files)    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                          │   │
│  │  • Cache em memória (LRU)                               │   │
│  │  • SQLite para sessões                                  │   │
│  │  • Arquivos para persistência                           │   │
│  │  • Sem dependências externas                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ✓ Funciona offline                                             │
│  ✓ Zero custo de API                                            │
│  ✓ Privacidade total                                            │
│  ✗ Sem sincronização entre dispositivos                         │
│  ✗ Sem memória de longo prazo avançada                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│           VERSÃO COMPLEMENTAR (Com memoria local)                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CAMADA DE MEMÓRIA HÍBRIDA                   │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │    Local     │  │    memoria local      │  │   Sincronia  │  │   │
│  │  │   (SQLite)   │  │   (Cloud)    │  │   (Auto)     │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                          │   │
│  │  • Memória local para performance                       │   │
│  │  • memoria local para persistência avançada                      │   │
│  │  • Sincronização automática                             │   │
│  │  • Fallback para local se memoria local falhar                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ✓ Memória entre dispositivos                                   │
│  ✓ Backup automático                                            │
│  ✓ Analytics avançados                                          │
│  ✓ Compartilhamento de memórias                                 │
│  ~ Custo opcional (pode usar tier gratuito)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Implementação Standalone

### 1. Estrutura de Memória Local

```typescript
// src/memory/local-memory-manager.ts

interface LocalMemoryConfig {
  enablePersistence: boolean;
  persistencePath: string;
  maxSessionSize: number;
  compressionEnabled: boolean;
}

class LocalMemoryManager {
  private workingMemory: Map<string, MemoryEntry>;  // RAM
  private sessionStore: SessionStore;               // SQLite
  private persistentStore: PersistentStore;         // Files
  
  constructor(config: LocalMemoryConfig) {
    this.workingMemory = new Map();
    this.sessionStore = new SQLiteSessionStore(config.persistencePath);
    this.persistentStore = new FilePersistentStore(config.persistencePath);
  }
  
  // Nível 1: Working Memory (RAM - mais rápido)
  async getFromWorking(key: string): Promise<MemoryEntry | null> {
    return this.workingMemory.get(key) || null;
  }
  
  async setInWorking(key: string, value: MemoryEntry): Promise<void> {
    this.workingMemory.set(key, value);
    
    // Evicção LRU se necessário
    if (this.workingMemory.size > MAX_WORKING_SIZE) {
      this.evictLRU();
    }
  }
  
  // Nível 2: Session Memory (SQLite - persistente por sessão)
  async getFromSession(sessionId: string, query: string): Promise<MemoryEntry[]> {
    return await this.sessionStore.search({
      session_id: sessionId,
      query,
      limit: 10
    });
  }
  
  async addToSession(sessionId: string, entry: MemoryEntry): Promise<void> {
    await this.sessionStore.insert({
      ...entry,
      session_id: sessionId,
      timestamp: Date.now()
    });
  }
  
  // Nível 3: Persistent Memory (Arquivos - cross-session)
  async getPersistent(userId: string, query: string): Promise<MemoryEntry[]> {
    return await this.persistentStore.search({
      user_id: userId,
      query,
      limit: 20
    });
  }
  
  async addPersistent(userId: string, entry: MemoryEntry): Promise<void> {
    await this.persistentStore.insert({
      ...entry,
      user_id: userId,
      timestamp: Date.now()
    });
  }
}
```

### 2. SQLite Schema (Standalone)

```sql
-- Schema completo sem dependência de memoria local

-- Memórias de sessão (temporárias)
CREATE TABLE session_memories (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT CHECK(type IN ('preference', 'conversation', 'code', 'decision')),
    metadata JSON,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,  -- TTL para auto-cleanup
    
    INDEX idx_session (session_id),
    INDEX idx_expires (expires_at)
);

-- Memórias persistentes (cross-session)
CREATE TABLE persistent_memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT CHECK(type IN ('preference', 'conversation', 'code', 'decision')),
    metadata JSON,
    importance_score REAL DEFAULT 0.5,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0,
    
    INDEX idx_user (user_id),
    INDEX idx_importance (importance_score),
    INDEX idx_accessed (last_accessed)
);

-- Full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(
    content,
    content='persistent_memories',
    content_rowid='rowid'
);

-- Cache de contextos
CREATE TABLE context_cache (
    cache_key TEXT PRIMARY KEY,
    context_data JSON NOT NULL,
    token_count INTEGER,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    hit_count INTEGER DEFAULT 0,
    
    INDEX idx_expires (expires_at)
);

-- Índice de código
CREATE TABLE code_index (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    language TEXT,
    symbols JSON,  -- Funções, classes, etc
    summary TEXT,  -- Resumo gerado
    last_modified INTEGER NOT NULL,
    embedding BLOB,  -- Vetor comprimido (opcional)
    
    INDEX idx_path (file_path),
    INDEX idx_language (language)
);
```

### 3. Modo Standalone vs Híbrido

```typescript
// src/config/modes.ts

type OperationMode = 'standalone' | 'hybrid' | 'memory-only';

interface ModeConfig {
  mode: OperationMode;
  features: {
    localMemory: boolean;
    memoryIntegration: boolean;
    cloudSync: boolean;
    crossDevice: boolean;
  };
  fallbacks: {
    onmemoria localFailure: 'local' | 'error' | 'retry';
    onNetworkFailure: 'offline' | 'error';
  };
}

const MODE_CONFIGS: Record<OperationMode, ModeConfig> = {
  standalone: {
    mode: 'standalone',
    features: {
      localMemory: true,
      memoryIntegration: false,
      cloudSync: false,
      crossDevice: false
    },
    fallbacks: {
      onmemoria localFailure: 'local',
      onNetworkFailure: 'offline'
    }
  },
  
  hybrid: {
    mode: 'hybrid',
    features: {
      localMemory: true,
      memoryIntegration: true,
      cloudSync: true,
      crossDevice: true
    },
    fallbacks: {
      onmemoria localFailure: 'local',
      onNetworkFailure: 'offline'
    }
  },
  
  'memory-only': {
    mode: 'memory-only',
    features: {
      localMemory: false,
      memoryIntegration: true,
      cloudSync: true,
      crossDevice: true
    },
    fallbacks: {
      onmemoria localFailure: 'error',
      onNetworkFailure: 'error'
    }
  }
};

// Seletor de modo
class ModeSelector {
  static detectMode(): OperationMode {
    // Se memoria local não configurado → standalone
    if (!process.env.CLOUD_SYNC_API_KEY) {
      console.log('🔧 Modo STANDALONE ativado (memoria local não configurado)');
      return 'standalone';
    }
    
    // Se memoria local configurado mas preferência por local → hybrid
    if (process.env.PREFER_LOCAL === 'true') {
      console.log('🔧 Modo HÍBRIDO ativado (preferência local)');
      return 'hybrid';
    }
    
    // Default → hybrid
    console.log('🔧 Modo HÍBRIDO ativado');
    return 'hybrid';
  }
}
```

### 4. Memory Manager Unificado

```typescript
// src/memory/unified-memory-manager.ts

class UnifiedMemoryManager {
  private mode: OperationMode;
  private localManager: LocalMemoryManager;
  private memoryManager?: memoria localIntegration;
  
  constructor(mode: OperationMode) {
    this.mode = mode;
    this.localManager = new LocalMemoryManager({
      enablePersistence: true,
      persistencePath: './data',
      maxSessionSize: 1000,
      compressionEnabled: true
    });
    
    // memoria local apenas se modo híbrido ou memory-only
    if (mode !== 'standalone') {
      this.memoryManager = new memoria localIntegration();
    }
  }
  
  async addMemory(
    entry: MemoryEntry,
    options: { persistent?: boolean } = {}
  ): Promise<void> {
    // Sempre salva localmente primeiro
    await this.localManager.addToSession(
      entry.sessionId,
      entry
    );
    
    // Se persistente e modo híbrido, sincroniza com memoria local
    if (options.persistent && this.memoryManager) {
      try {
        await this.memoryManager.addMemory(
          [{ role: 'user', content: entry.content }],
          entry.userId,
          entry.sessionId,
          { type: entry.type }
        );
      } catch (error) {
        // Fallback: apenas loga erro, mantém local
        console.warn('memoria local sync failed, keeping local only:', error);
      }
    }
    
    // Se persistente standalone, salva em persistent store
    if (options.persistent && this.mode === 'standalone') {
      await this.localManager.addPersistent(entry.userId, entry);
    }
  }
  
  async searchMemories(
    query: string,
    options: SearchOptions
  ): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    
    // 1. Busca local (sempre)
    const localResults = await this.localManager.getFromSession(
      options.sessionId,
      query
    );
    results.push(...localResults);
    
    // 2. Busca memoria local (se disponível)
    if (this.memoryManager && this.mode !== 'standalone') {
      try {
        const memoryResults = await this.memoryManager.searchMemories(
          query,
          options.userId,
          options.sessionId,
          { limit: options.limit }
        );
        
        // Merge e deduplica resultados
        results.push(...memoryResults);
      } catch (error) {
        console.warn('memoria local search failed, using local only:', error);
      }
    }
    
    // 3. Se standalone e persistente, busca também
    if (this.mode === 'standalone' && options.includePersistent) {
      const persistentResults = await this.localManager.getPersistent(
        options.userId,
        query
      );
      results.push(...persistentResults);
    }
    
    // Remove duplicatas e ordena por relevância
    return this.deduplicateAndRank(results);
  }
  
  private deduplicateAndRank(results: MemoryEntry[]): MemoryEntry[] {
    const seen = new Set<string>();
    return results
      .filter(r => {
        const key = this.hashContent(r.content);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}
```

## Fluxos de Uso

### Fluxo 1: Standalone Puro (Sem memoria local)

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO STANDALONE                                            │
│ Zero dependências externas                                   │
└─────────────────────────────────────────────────────────────┘

Usuário faz query
        │
        ▼
┌─────────────────┐
│  Working Memory │ ◄── Cache em RAM (mais rápido)
│     (LRU)       │
└────────┬────────┘
         │ Miss
         ▼
┌─────────────────┐
│  Session Store  │ ◄── SQLite local (sessão atual)
│    (SQLite)     │
└────────┬────────┘
         │ Miss
         ▼
┌─────────────────┐
│ Persistent Store│ ◄── Arquivos locais (cross-session)
│    (Files)      │
└────────┬────────┘
         │ Miss
         ▼
┌─────────────────┐
│   Code Index    │ ◄── Índice do projeto
│   (SQLite)      │
└─────────────────┘

✓ Funciona 100% offline
✓ Zero latência de rede
✓ Privacidade total
✗ Sem sincronização
```

### Fluxo 2: Híbrido (Com memoria local Opcional)

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO HÍBRIDO                                               │
│ memoria local é complementar, não obrigatório                         │
└─────────────────────────────────────────────────────────────┘

Usuário faz query
        │
        ▼
┌─────────────────┐
│  Working Memory │ ◄── Sempre consulta local primeiro
│     (LRU)       │
└────────┬────────┘
         │ Miss
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Session Store  │────►│      memoria local       │ ◄── Tenta memoria local
│    (SQLite)     │     │    (Cloud)      │     (se configurado)
└────────┬────────┘     └────────┬────────┘
         │ Miss                  │ Timeout/Erro
         │                       │
         │              ┌────────▼────────┐
         │              │   Fallback to   │
         │              │     Local       │
         │              └─────────────────┘
         ▼
┌─────────────────┐
│ Persistent Store│ ◄── Fallback local
│    (SQLite)     │
└─────────────────┘

✓ Melhor dos dois mundos
✓ Fallback automático
✓ Funciona offline
~ Custo opcional
```

### Fluxo 3: Migração Standalone → Híbrido

```
┌─────────────────────────────────────────────────────────────┐
│ MIGRAÇÃO: Standalone → Híbrido                              │
│ Quando usuário configura memoria local posteriormente                 │
└─────────────────────────────────────────────────────────────┘

1. Usuário configura CLOUD_SYNC_API_KEY
        │
        ▼
2. Sistema detecta mudança
        │
        ▼
3. Migração automática:
   ┌────────────────────────────────────────┐
   │ Para cada memória persistente local:   │
   │                                        │
   │ 1. Lê do SQLite                        │
   │ 2. Envia para memoria local                     │
   │ 3. Marca como sincronizado             │
   │ 4. Mantém cópia local (cache)          │
   └────────────────────────────────────────┘
        │
        ▼
4. Modo alterado: standalone → hybrid
        │
        ▼
5. Novas memórias sincronizadas automaticamente

✓ Migração transparente
✓ Sem perda de dados
✓ Configurável a qualquer momento
```

## Configuração

### Modo Standalone

```bash
# .env
# Deixe CLOUD_SYNC_API_KEY vazio ou comente
# CLOUD_SYNC_API_KEY=

# Ou defina explicitamente
OPERATION_MODE=standalone

# Configurações locais
LOCAL_DB_PATH=./data/memory.db
MAX_SESSION_SIZE=1000
ENABLE_COMPRESSION=true
```

### Modo Híbrido

```bash
# .env
CLOUD_SYNC_API_KEY=sua-chave-aqui
OPERATION_MODE=hybrid

# Preferência: usar local quando possível
PREFER_LOCAL=true

# Fallback
FALLBACK_ON_SYNC_ERROR=true
```

## Comparação de Funcionalidades

| Funcionalidade | Standalone | Híbrido | memoria local-Only |
|----------------|------------|---------|-----------|
| **Memória de trabalho** | ✅ | ✅ | ✅ |
| **Memória de sessão** | ✅ | ✅ | ✅ |
| **Memória persistente** | ✅ (arquivos) | ✅ (ambos) | ✅ (cloud) |
| **Cross-device** | ❌ | ✅ | ✅ |
| **Backup automático** | ❌ | ✅ | ✅ |
| **Funciona offline** | ✅ | ✅* | ❌ |
| **Custo** | $0 | $variável | $variável |
| **Privacidade** | Máxima | Alta | Média |
| **Setup** | Zero | Médio | Médio |

*Modo híbrido funciona offline usando cache local

## Recomendações de Uso

### Use Standalone quando:
- ✅ Trabalha sempre no mesmo dispositivo
- ✅ Prioriza privacidade máxima
- ✅ Quer zero custos
- ✅ Não precisa de sincronização
- ✅ Ambiente offline/air-gapped

### Use Híbrido quando:
- ✅ Trabalha em múltiplos dispositivos
- ✅ Quer backup automático
- ✅ Precisa de analytics
- ✅ Aceita custo moderado
- ✅ Quer flexibilidade máxima

### Use memoria local-Only quando:
- ✅ Sempre online
- ✅ Múltiplos colaboradores
- ✅ Infraestrutura cloud-native
- ✅ Não se importa com dependência externa

## Exemplo de Código: Detecção Automática

```typescript
// src/index.ts

async function main() {
  // Detecta modo automaticamente
  const mode = ModeSelector.detectMode();
  const config = MODE_CONFIGS[mode];
  
  console.log(`🚀 Iniciando MCP RLM em modo: ${mode}`);
  console.log(`   Features: ${Object.entries(config.features)
    .filter(([_, v]) => v)
    .map(([k]) => k)
    .join(', ')}`);
  
  // Inicializa manager apropriado
  const memoryManager = new UnifiedMemoryManager(mode);
  
  // Inicia servidor MCP
  const server = new McpServer({
    name: 'rlm-memory-server',
    version: '1.0.0'
  });
  
  // Registra tools (mesmas para todos os modos!)
  registerTools(server, memoryManager);
  
  await server.connect(new StdioServerTransport());
  
  console.log('✅ Servidor MCP RLM pronto!');
  if (mode === 'standalone') {
    console.log('💡 Dica: Configure CLOUD_SYNC_API_KEY para habilitar sincronização cloud');
  }
}

main().catch(console.error);
```

## Conclusão

A arquitetura standalone torna o MCP RLM **acessível a todos**, independente de:
- Conectividade com internet
- Orçamento para APIs
- Preocupações com privacidade
- Complexidade de setup

O memoria local torna-se um **upgrade opcional** que adiciona conveniência (sincronização, backup) sem ser obrigatório para o funcionamento básico do sistema.
