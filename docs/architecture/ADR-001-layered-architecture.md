# ADR 001: Arquitetura em Camadas

**Status:** Aceito  
**Data:** 2026-01-31  
**Decisor:** Arquiteto de Software  

## Contexto

O projeto th0th MCP requer uma arquitetura que:
- Separe claramente responsabilidades
- Facilite manutenção e evolução
- Permita testes isolados de componentes
- Suporte múltiplos backends de armazenamento

## Decisão

Adotamos uma **arquitetura em camadas (layered architecture)** com 3 camadas principais:

### Camada 1: API Layer (src/api/)
- **Responsabilidade:** Exposição de interface MCP
- **Componentes:**
  - `tools/` - Ferramentas MCP (get_optimized_context, store_memory, etc)
  - `resources/` - Recursos MCP (stats, config)
- **Dependências:** Apenas Service Layer

### Camada 2: Service Layer (src/services/)
- **Responsabilidade:** Lógica de negócio e orquestração
- **Componentes:**
  - `memory/` - Cliente e integração com camada de memoria local
  - `compression/` - Serviços de compressão semântica
  - `cache/` - Gerenciador de cache hierárquico
- **Dependências:** Data Layer e Models

### Camada 3: Data Layer (src/data/)
- **Responsabilidade:** Persistência e recuperação de dados
- **Componentes:**
  - `chromadb/` - Vector store implementation
  - `sqlite/` - Keyword search (FTS5) e cache L2
  - `vector/` - Abstrações de busca vetorial
- **Dependências:** Apenas Models e Types

### Camadas Transversais

**Models (src/models/)**
- Entidades de domínio com lógica de negócio
- Memory, CacheEntry, CompressedContent

**Types (src/types/)**
- Interfaces e tipos TypeScript
- Contratos entre camadas

**Utils (src/utils/)**
- Utilitários e helpers
- Funções puras sem estado

**Config (src/config/)**
- Configuração centralizada
- Gerenciamento de ambiente

## Consequências

### Positivas
- ✅ Separação clara de responsabilidades (SoC)
- ✅ Testabilidade: cada camada testável isoladamente
- ✅ Manutenibilidade: mudanças localizadas
- ✅ Extensibilidade: fácil adicionar novos backends
- ✅ Dependency Injection: camadas superiores dependem de interfaces

### Negativas
- ⚠️ Overhead inicial de setup
- ⚠️ Possível over-engineering para features simples
- ⚠️ Requer disciplina para não quebrar limites de camadas

## Regras de Dependência

```
API Layer
    ↓ (depende de)
Service Layer
    ↓ (depende de)
Data Layer
    ↓ (depende de)
Models + Types
```

**Proibido:**
- ❌ Data Layer chamar Service Layer
- ❌ Service Layer acessar diretamente APIs externas sem wrapper
- ❌ API Layer conter lógica de negócio

## Alternativas Consideradas

### 1. Arquitetura Hexagonal (Ports & Adapters)
- **Prós:** Maior isolamento do domínio
- **Contras:** Complexidade excessiva para o escopo atual
- **Decisão:** Rejeitada por over-engineering

### 2. Arquitetura Modular Flat
- **Prós:** Mais simples
- **Contras:** Dificulta crescimento e testes
- **Decisão:** Rejeitada por falta de estrutura

## Implementação

Ver:
- `src/types/interfaces.ts` - Contratos entre camadas
- `src/models/` - Modelos de domínio
- `src/server.ts` - Ponto de entrada que conecta camadas

## Revisão

Esta decisão deve ser revisada se:
- O projeto crescer significativamente (>50k linhas)
- Houver necessidade de múltiplos serviços distribuídos
- A complexidade do domínio aumentar drasticamente
