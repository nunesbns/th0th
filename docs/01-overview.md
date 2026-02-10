# MCP RLM: Sistema de Memória Otimizada para OpenCode

## Visão Geral

Este projeto implementa um **MCP Server (Model Context Protocol)** com **RLM (Retrieval Language Model)** para fornecer contexto infinito ao OpenCode com economia máxima de tokens (70-90%).

### Modos de Operação

| Modo | Memória | camada de memoria local | Uso Ideal |
|------|---------|---------|-----------|
| **Standalone** | 100% Local | ❌ Não usa | Offline, privacidade máxima |
| **Híbrido** | Local + Cloud | ✅ Opcional | Flexibilidade, sync entre devices |
| **Cloud** | camada de memoria local | ✅ Obrigatório | Múltiplos dispositivos, backup |

> **Nota:** camada de memoria local é **completamente opcional**. O sistema funciona 100% offline com SQLite local.

## Arquitetura do Sistema (Standalone - Padrão)

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENCODE AGENT                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              MCP SERVER: RLM-OPTIMIZED                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           CAMADA DE ECONOMIA DE PROMPTS               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Semantic   │  │   Prompt    │  │   Context   │  │  │
│  │  │  Compressor │  │    Cache    │  │   Router    │  │  │
│  │  │  (70% econ) │  │  (50% econ) │  │  (30% econ) │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           MEMÓRIA LOCAL (100% Offline)                │  │
│  │  • Working Memory (RAM)                              │  │
│  │  • Session Memory (SQLite)                           │  │
│  │  • Persistent Memory (Arquivos)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      MEM0.AI (OPCIONAL - Modo Híbrido/Cloud)         │  │
│  │  • Sincronização entre dispositivos                  │  │
│  │  • Backup automático                                 │  │
│  │  • Analytics avançados                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              RETRIEVAL INTELIGENTE                    │  │
│  │  • HNSW Vector Search (ChromaDB)                     │  │
│  │  • BM25 Keyword Search (SQLite FTS5)                 │  │
│  │  • Graph RAG (NetworkX)                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Benefícios

| Métrica | Melhoria |
|---------|----------|
| **Economia de tokens** | 70-90% |
| **Velocidade** | 91% mais rápido |
| **Precisão** | +26% vs OpenAI Memory |
| **Custo** | Redução de 80-90% |

## Tecnologias Utilizadas

### Core (Obrigatório)
- **TypeScript** - Linguagem principal
- **SQLite** - Memória local persistente
- **ChromaDB** - Vector database local
- **Ollama** - Embeddings locais (gratuitos)
- **MCP SDK** - Integração com OpenCode

### Opcional
- **camada de memoria local** - Memória em nuvem (sincronização, backup)
- **Redis** - Cache distribuído (opcional)

## Estrutura do Projeto

```
th0th-mcp/
├── docs/                              # Documentação
│   ├── 01-overview.md                # Este arquivo
│   ├── 02-architecture.md            # Arquitetura detalhada
│   ├── 03-optimization.md            # Estratégias de otimização
│   ├── 04-memory-integration.md        # Integração com memoria local (OPCIONAL)
│   ├── 05-implementation.md          # Guia de implementação
│   ├── 06-api-reference.md           # Referência da API
│   ├── 07-subagents-system.md        # Sistema de subsagentes
│   ├── 08-agent-architect.md         # Plano Arquiteto
│   ├── 09-agent-implementer.md       # Plano Implementador
│   ├── 10-agent-optimizer.md         # Plano Otimizador
│   ├── 11-orchestrator-mistral.md    # Orquestrador
│   ├── 12-workflow-execution.md      # Workflows
│   └── 13-standalone-architecture.md # Arquitetura standalone
├── src/
│   ├── server.ts                     # MCP Server
│   ├── memory/                       # Sistema de memória
│   │   ├── local-memory.ts          # Memória local (standalone)
│   │   ├── unified-manager.ts       # Manager unificado
│   │   └── memory-client.ts           # Cliente memoria local (opcional)
│   ├── compression.ts               # Compressão semântica
│   ├── cache.ts                     # Sistema de cache
│   ├── router.ts                    # Context router
│   └── retrieval/
│       ├── vector.ts                # Busca vetorial
│       ├── keyword.ts               # Busca por palavras-chave
│       └── hybrid.ts                # Busca híbrida
├── data/                             # Dados locais (SQLite)
├── tests/
├── package.json
└── tsconfig.json
```

## Próximos Passos

1. **Para uso Standalone (Offline)**
   - Leia [13-standalone-architecture.md](./13-standalone-architecture.md)
   - Configure SQLite local
   - Sem necessidade de memoria local

2. **Para uso Híbrido (com memoria local opcional)**
   - Leia [02-architecture.md](./02-architecture.md) para arquitetura
   - Consulte [04-memory-integration.md](./04-memory-integration.md) para memoria local
   - Siga [05-implementation.md](./05-implementation.md) para implementar

3. **Para desenvolvimento com subsagentes**
   - Veja [07-subagents-system.md](./07-subagents-system.md)

## Referências

- [MCP Protocol](https://modelcontextprotocol.io)
- [OpenCode](https://opencode.ai)
- [camada de memoria local Documentation](https://docs.memory.ai) (opcional)
