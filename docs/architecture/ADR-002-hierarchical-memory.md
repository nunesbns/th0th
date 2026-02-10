# ADR 002: Sistema de Memória Hierárquica

**Status:** Aceito  
**Data:** 2026-01-31  
**Decisor:** Arquiteto de Software  

## Contexto

Sistemas de AI precisam de contexto, mas:
- Context windows são limitados (8K-128K tokens)
- Custo aumenta com número de tokens
- Informações antigas perdem relevância
- Nem tudo precisa estar sempre ativo

## Decisão

Implementamos um **sistema de memória hierárquica de 5 níveis**, inspirado em arquitetura de computadores:

### Nível 4: Working Memory (Context Window)
- **Capacidade:** 8K-128K tokens (dependendo do modelo)
- **Latência:** Imediata
- **Custo:** Alto (pago por token)
- **Conteúdo:** Contexto ativo atual
- **Gerenciado por:** LLM

### Nível 3: Session Memory (memoria local Session)
- **Capacidade:** Ilimitada
- **Latência:** ~100-200ms (API memoria local)
- **Custo:** Médio
- **Conteúdo:** Conversa atual, últimas N interações
- **TTL:** Fim da sessão
- **Storage:** camada de memoria local cloud

### Nível 2: User Memory (memoria local User)
- **Capacidade:** Ilimitada
- **Latência:** ~100-200ms (API memoria local)
- **Custo:** Médio
- **Conteúdo:** Preferências, padrões de código, decisões passadas
- **TTL:** 30-90 dias (configurável)
- **Storage:** camada de memoria local cloud

### Nível 1: Project Memory (Vector DB + SQLite)
- **Capacidade:** ~1M vetores
- **Latência:** ~10-50ms (local)
- **Custo:** Baixo (armazenamento local)
- **Conteúdo:** Código indexado, ASTs, documentação
- **TTL:** Enquanto projeto existir
- **Storage:** ChromaDB (embeddings) + SQLite (metadata)

### Nível 0: Persistent Memory (Arquivos)
- **Capacidade:** Ilimitada
- **Latência:** ~1-10ms (filesystem)
- **Custo:** Muito baixo
- **Conteúdo:** Código-fonte completo, histórico Git
- **TTL:** Permanente
- **Storage:** Filesystem

## Fluxo de Recuperação

```
1. Query do usuário
        ↓
2. Cache L1 (memória) → HIT? → Retorna
        ↓ MISS
3. Cache L2 (SQLite) → HIT? → Retorna + Popula L1
        ↓ MISS
4. Busca paralela:
   ├─→ memoria local User Memory (preferências)
   ├─→ memoria local Session Memory (conversa)
   └─→ Vector DB (código relevante)
        ↓
5. Compressão semântica
        ↓
6. Popula caches L1 e L2
        ↓
7. Retorna contexto otimizado
```

## Estratégias de Promoção/Degradação

### Promoção (subir de nível)
- **L0→L1:** Quando arquivo é aberto/modificado
- **L1→L2:** Quando informação é reutilizada (user/session memory)
- **L2→L3:** N/A (níveis diferentes de abstração)
- **L3→L4:** Quando relevante para query atual

### Degradação (descer de nível)
- **L4→L3:** Quando sai do context window (summarize)
- **L3→L2:** Quando sessão termina (extrair padrões)
- **L2→L1:** Quando TTL expira
- **L1→L0:** Sempre mantido em sync com filesystem

## Consequências

### Positivas
- ✅ Economia de tokens: até 70% de redução
- ✅ Latência otimizada: cache local first
- ✅ Escalabilidade: informação distribuída por níveis
- ✅ Relevância: informação antiga naturalmente "esquecida"
- ✅ Personalização: preferências do usuário preservadas

### Negativas
- ⚠️ Complexidade de implementação
- ⚠️ Sincronização entre níveis requer cuidado
- ⚠️ Debugging mais difícil (múltiplos storages)
- ⚠️ Cold start: primeiro acesso pode ser lento

## Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Token Savings | >70% |
| Cache Hit Rate (L1) | >60% |
| Cache Hit Rate (L2) | >30% |
| Latência média de retrieval | <100ms |
| Custo por 1K queries | <$0.10 |

## Implementação

Ver:
- `src/types/index.ts` - `MemoryLevel` enum
- `src/models/Memory.ts` - `calculateTTL()` method
- `src/services/cache/` - Implementação de cache hierárquico

## Alternativas Consideradas

### 1. Flat Memory (tudo em um só lugar)
- **Prós:** Simples
- **Contras:** Não escala, custo alto
- **Decisão:** Rejeitada

### 2. LRU Cache Simples
- **Prós:** Implementação fácil
- **Contras:** Não considera semântica/importância
- **Decisão:** Rejeitada (mas LRU usado dentro de L1)

### 3. Memory Hierárquica de 3 níveis (sem memoria local)
- **Prós:** Menos dependências externas
- **Contras:** Perde benefícios de managed memory service
- **Decisão:** Rejeitada (memoria local traz muito valor)

## Revisão

Revisar se:
- Cache hit rate < 40% consistentemente
- Latência > 200ms em p95
- Custo de memoria local se tornar proibitivo
