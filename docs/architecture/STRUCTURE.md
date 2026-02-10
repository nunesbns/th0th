# Estrutura do Projeto

Visão geral da organização de código do th0th MCP Server.

## Árvore de Diretórios

```
th0th-mcp/
├── src/
│   ├── api/                    # API Layer (MCP Interface)
│   │   ├── tools/             # MCP Tools
│   │   │   ├── get_optimized_context.ts
│   │   │   ├── store_memory.ts
│   │   │   ├── search_code.ts
│   │   │   └── compress_context.ts
│   │   └── resources/         # MCP Resources
│   │       ├── stats.ts
│   │       └── config.ts
│   │
│   ├── services/              # Service Layer (Business Logic)
│   │   ├── memory/             # memoria local Integration
│   │   │   ├── client.ts
│   │   │   ├── user-memory.ts
│   │   │   └── session-memory.ts
│   │   ├── compression/      # Semantic Compression
│   │   │   ├── code-compressor.ts
│   │   │   ├── conversation-compressor.ts
│   │   │   └── hierarchical-compressor.ts
│   │   └── cache/            # Hierarchical Cache
│   │       ├── cache-manager.ts
│   │       ├── l1-memory-cache.ts
│   │       ├── l2-sqlite-cache.ts
│   │       └── l3-memory-cache.ts
│   │
│   ├── data/                  # Data Layer (Persistence)
│   │   ├── chromadb/         # Vector Store
│   │   │   ├── vector-store.ts
│   │   │   └── collection.ts
│   │   ├── sqlite/           # Keyword Search & Cache
│   │   │   ├── keyword-search.ts
│   │   │   ├── cache-db.ts
│   │   │   └── migrations/
│   │   └── vector/           # Search Abstractions
│   │       ├── hybrid-search.ts
│   │       └── reranker.ts
│   │
│   ├── models/               # Domain Models
│   │   ├── Memory.ts
│   │   ├── CacheEntry.ts
│   │   ├── CompressedContent.ts
│   │   └── index.ts
│   │
│   ├── types/                # TypeScript Interfaces
│   │   ├── index.ts          # Core types
│   │   └── interfaces.ts     # Layer contracts
│   │
│   ├── utils/                # Utilities
│   │   ├── logger.ts
│   │   ├── sanitizer.ts
│   │   ├── tokenizer.ts
│   │   └── rate-limiter.ts
│   │
│   ├── config/               # Configuration
│   │   └── index.ts
│   │
│   └── server.ts             # Main entry point
│
├── tests/                     # Tests
│   ├── unit/
│   │   ├── models/
│   │   ├── services/
│   │   └── utils/
│   └── integration/
│       ├── api/
│       └── data/
│
├── docs/                      # Documentation
│   ├── architecture/
│   │   ├── ADR-001-layered-architecture.md
│   │   ├── ADR-002-hierarchical-memory.md
│   │   └── STRUCTURE.md (this file)
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   └── ...
│
├── data/                      # Runtime data (gitignored)
│   ├── chroma/               # Vector DB files
│   ├── cache.db              # SQLite cache
│   └── keyword.db            # SQLite FTS5
│
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Camadas e Responsabilidades

### API Layer (`src/api/`)
**Propósito:** Expor interface MCP para o OpenCode

**Responsabilidades:**
- Definir tools e resources MCP
- Validar inputs
- Formatar outputs
- Delegar para Service Layer

**Proibido:**
- ❌ Lógica de negócio
- ❌ Acesso direto a dados
- ❌ Manter estado

### Service Layer (`src/services/`)
**Propósito:** Implementar lógica de negócio e orquestração

**Responsabilidades:**
- Orquestrar operações entre componentes
- Aplicar regras de negócio
- Gerenciar transações
- Implementar estratégias (compression, cache)

**Proibido:**
- ❌ Conhecer detalhes de protocolo MCP
- ❌ Acessar filesystem diretamente
- ❌ Hard-code de configurações

### Data Layer (`src/data/`)
**Propósito:** Persistência e recuperação de dados

**Responsabilidades:**
- Operações CRUD
- Indexação
- Queries
- Migrações de schema

**Proibido:**
- ❌ Lógica de negócio
- ❌ Conhecer sobre MCP
- ❌ Decisões sobre compressão/cache

### Models (`src/models/`)
**Propósito:** Entidades de domínio com comportamento

**Responsabilidades:**
- Encapsular dados + lógica
- Validações de domínio
- Factories
- Serialização

**Exemplo:**
```typescript
// ✅ Correto: lógica de domínio no modelo
class Memory {
  isExpired(): boolean { ... }
  setExpiration(ttl: number): void { ... }
}

// ❌ Errado: lógica de domínio no service
class MemoryService {
  isMemoryExpired(memory: Memory): boolean { ... }
}
```

### Types (`src/types/`)
**Propósito:** Contratos e definições de tipos

**Responsabilidades:**
- Interfaces entre camadas
- Enums compartilhados
- Type guards
- Schemas

**Proibido:**
- ❌ Implementações
- ❌ Lógica

### Utils (`src/utils/`)
**Propósito:** Funções auxiliares puras

**Responsabilidades:**
- Funções stateless
- Helpers de formatação
- Wrappers de libs externas

**Proibido:**
- ❌ Estado compartilhado
- ❌ Side effects (exceto logging)

## Convenções de Código

### Nomenclatura

```typescript
// Interfaces começam com I
interface IMemoryRepository { ... }

// Classes em PascalCase
class MemoryRepository implements IMemoryRepository { ... }

// Métodos e variáveis em camelCase
async function storeMemory() { ... }

// Constantes em UPPER_SNAKE_CASE
const MAX_CACHE_SIZE = 100 * 1024 * 1024;

// Tipos e Enums em PascalCase
enum MemoryLevel { ... }
type MemoryFilters = { ... }
```

### Imports

```typescript
// 1. Node built-ins
import { readFile } from 'fs/promises';

// 2. External dependencies
import { ChromaClient } from 'chromadb';

// 3. Internal - types first
import { Memory, MemoryType } from '../types/index.js';

// 4. Internal - implementations
import { MemoryRepository } from './MemoryRepository.js';

// 5. Relative imports
import { logger } from '../utils/logger.js';
```

### Exports

```typescript
// ✅ Named exports (preferido)
export class Memory { ... }
export interface IMemoryRepository { ... }

// ❌ Default exports (evitar)
export default class Memory { ... }
```

### Async/Await

```typescript
// ✅ Sempre usar async/await
async function fetchData(): Promise<Data> {
  const result = await db.query();
  return result;
}

// ❌ Evitar .then()
function fetchData(): Promise<Data> {
  return db.query().then(result => result);
}
```

## Padrões de Projeto Utilizados

| Padrão | Onde | Por quê |
|--------|------|---------|
| **Repository** | `src/data/` | Abstrai acesso a dados |
| **Strategy** | `src/services/compression/` | Múltiplas estratégias de compressão |
| **Factory** | `src/models/Memory.ts` | Criação de diferentes tipos de memória |
| **Dependency Injection** | Todo o projeto | Testabilidade e desacoplamento |
| **Adapter** | `src/services/memory/client.ts` | Wrapper para API externa |
| **Singleton** | `src/config/index.ts` | Config global |

## Fluxo de Dados Típico

### Exemplo: `get_optimized_context`

```
1. User → OpenCode
        ↓
2. OpenCode → MCP Tool (API Layer)
   src/api/tools/get_optimized_context.ts
        ↓
3. Tool → Context Optimizer (Service Layer)
   src/services/context-optimizer.ts
        ↓
4. Optimizer → Cache Manager (Service)
   src/services/cache/cache-manager.ts
        ↓ (cache miss)
5. Optimizer → Hybrid Search (Data Layer)
   src/data/vector/hybrid-search.ts
        ↓
6. Hybrid Search → [Vector DB + Keyword Search]
        ↓
7. Results → Compressor (Service)
   src/services/compression/
        ↓
8. Compressed → Cache (atualiza L1, L2)
        ↓
9. Return → Tool → OpenCode → User
```

## Testing Strategy

### Unit Tests
- Models: lógica de domínio
- Utils: funções puras
- Services: lógica de negócio (mocks para data layer)

### Integration Tests
- API Layer: tools e resources
- Data Layer: operações com DBs reais (test fixtures)
- Services: fluxos completos

### Estrutura de Test
```typescript
// tests/unit/models/Memory.test.ts
describe('Memory', () => {
  describe('isExpired', () => {
    it('should return true when expiration date is in the past', () => {
      // ...
    });
  });
});
```

## Próximos Passos

Ver roadmap em:
- `docs/03-implementation-plan.md`
- `docs/04-phase-1-setup.md`
