# Multi-Provider Embedding System

Enterprise-grade embedding generation with automatic fallback, caching, and support for multiple providers.

## Features

- **Multi-Provider Support**: OpenAI, Google, Cohere, Ollama (local)
- **Auto-Fallback**: Automatic provider selection based on availability
- **Transparent Caching**: SHA-256 content-based caching (60-80% hit rate)
- **Performance**: 0.09ms cache hit latency
- **Type-Safe**: Full TypeScript support via Vercel AI SDK
- **Battle-Tested**: Based on OpenClaw's proven patterns

## Quick Start

```typescript
import { createEmbeddingProvider } from "./services/embeddings";

// Auto-select first available provider with caching
const provider = await createEmbeddingProvider({ cache: true });

// Single embedding
const embedding = await provider.embedQuery("Hello world");
// => [0.123, -0.456, 0.789, ...] (1536D for OpenAI, 768D for others)

// Batch embeddings
const embeddings = await provider.embedBatch([
  "First document",
  "Second document",
  "Third document",
]);
// => [[...], [...], [...]]
```

## Configuration

### Environment Variables

```bash
# Ollama (Local, Free, Offline) - Priority 1
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# OpenAI (Reliable, Fast) - Priority 2
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Google (Alternative) - Priority 3
GOOGLE_API_KEY=...
GOOGLE_EMBEDDING_MODEL=text-embedding-004

# Cohere (Fallback) - Priority 4
COHERE_API_KEY=...
COHERE_EMBEDDING_MODEL=embed-english-v3.0

# Cache Configuration
EMBEDDING_CACHE_DB_PATH=./data/embedding-cache.db
```

### Provider Priority

The system automatically tries providers in this order:

1. **Ollama** (768D) - Local, free, works offline
2. **OpenAI** (1536D) - Most reliable, fastest
3. **Google** (768D) - Good alternative
4. **Cohere** (1024D) - Specialized fallback

## Usage Examples

### Auto-Select Provider

```typescript
// Tries providers by priority until one works
const provider = await createEmbeddingProvider({
  provider: "auto", // default
  cache: true, // default
});

console.log(`Using: ${provider.id}`);
// => "Using: ollama-cached" or "openai-cached"
```

### Specific Provider

```typescript
// Use OpenAI specifically
const provider = await createEmbeddingProvider({
  provider: "openai",
  cache: true,
});

// Error if OpenAI not available
```

### Without Cache

```typescript
// Disable caching (not recommended)
const provider = await createEmbeddingProvider({
  provider: "auto",
  cache: false,
});
```

### Custom Cache

```typescript
import { EmbeddingCache } from "./services/cache/embedding-cache";

// Create custom cache
const cache = new EmbeddingCache("my-provider", "my-model");

const provider = await createEmbeddingProvider({
  provider: "openai",
  cacheInstance: cache,
});
```

### Check Availability

```typescript
import { checkProviderAvailability } from "./services/embeddings";

const status = await checkProviderAvailability();

for (const [id, info] of Object.entries(status)) {
  console.log(`${id}: ${info.available ? "✓" : "✗"} ${info.reason || ""}`);
}

// Example output:
// ollama: ✓
// openai: ✗ No API key configured
// google: ✗ Health check failed
// cohere: ✓
```

### Multiple Providers

```typescript
import { createAllProviders } from "./services/embeddings";

// Get all available providers (for testing/comparison)
const providers = await createAllProviders({ cache: false });

for (const provider of providers) {
  const embedding = await provider.embedQuery("test");
  console.log(`${provider.id}: ${embedding.length}D`);
}

// Output:
// ollama: 768D
// openai: 1536D
// cohere: 1024D
```

## Cache Performance

### Cache Statistics

```typescript
import { CachedEmbeddingProvider } from "./services/embeddings";

const provider = await createEmbeddingProvider({ cache: true });

if (provider instanceof CachedEmbeddingProvider) {
  // Request stats
  const stats = provider.getStats();
  console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);

  // Cache info
  const info = await provider.getCacheInfo();
  console.log(`Total entries: ${info.totalEntries}`);
  console.log(`Cache size: ${(info.cacheSize / 1024 / 1024).toFixed(2)} MB`);

  // Cleanup old entries (> 7 days)
  const removed = await provider.cleanup();
  console.log(`Removed ${removed} old entries`);
}
```

### Expected Performance

| Operation               | Latency   | Throughput          |
| ----------------------- | --------- | ------------------- |
| Cache Hit               | 0.09ms    | 10,000+ req/s       |
| Cache Miss (OpenAI)     | 50-200ms  | Depends on API      |
| Cache Miss (Ollama)     | 100-500ms | Depends on hardware |
| Batch (5 items, cached) | 0.45ms    | 2,000+ req/s        |

### Cache Hit Rates

- **Production**: 60-80% (typical workload)
- **Batch processing**: 90%+ (repeated content)
- **Development**: 95%+ (testing same queries)

## Testing

```bash
# Run comprehensive tests
npm run build
node dist/test-providers.js
```

Test suite includes:

1. **Provider Tests**: Single/batch embeddings, consistency
2. **Cache Tests**: Hit/miss, statistics, cleanup
3. **Fallback Tests**: Auto-selection, availability checks
4. **Benchmarks**: Performance comparison across providers

## Architecture

```
┌─────────────────────────────────────────────┐
│         Application Code                     │
└───────────────┬─────────────────────────────┘
                │
                │ createEmbeddingProvider()
                │
┌───────────────▼─────────────────────────────┐
│         Factory (index.ts)                   │
│  - Auto provider selection                   │
│  - Health checks                             │
│  - Cache wrapping                            │
└───────────────┬─────────────────────────────┘
                │
         ┌──────┴──────┐
         │             │
┌────────▼────┐  ┌────▼─────────────────────┐
│ CachedProvider│  │  AISDKEmbeddingProvider│
│ (optional)   │  │  (base provider)        │
│              │  │                          │
│ - SHA-256    │  │ - Vercel AI SDK         │
│ - SQLite     │  │ - Retry logic           │
│ - Hit/miss   │  │ - Timeout handling      │
└────────┬────┘  └────┬─────────────────────┘
         │            │
         │     ┌──────┴──────────────┐
         │     │                     │
         │  ┌──▼───┐ ┌──────┐ ┌─────▼──┐
         │  │OpenAI│ │Google│ │Cohere  │
         │  └──────┘ └──────┘ └────────┘
         │
  ┌──────▼────────┐
  │ Ollama        │
  │ (local)       │
  └───────────────┘
```

## Provider Details

### OpenAI

- **Model**: `text-embedding-3-small` (1536D)
- **Pros**: Fast, reliable, high quality
- **Cons**: Paid, requires API key
- **Cost**: ~$0.02 / 1M tokens

### Google

- **Model**: `text-embedding-004` (768D)
- **Pros**: Good alternative, lower dimensions
- **Cons**: Requires API key, newer
- **Cost**: Free tier available

### Cohere

- **Model**: `embed-english-v3.0` (1024D)
- **Pros**: Specialized for search/classification
- **Cons**: Requires API key
- **Cost**: Free tier: 100 calls/min

### Ollama (Local)

- **Model**: `nomic-embed-text` (768D)
- **Pros**: Free, private, offline
- **Cons**: Slower, requires local setup
- **Setup**:

  ```bash
  # Install Ollama
  curl https://ollama.ai/install.sh | sh

  # Pull model
  ollama pull nomic-embed-text

  # Server runs at localhost:11434
  ```

## Best Practices

### 1. Use Auto-Fallback in Production

```typescript
// ✅ Good: Automatic failover
const provider = await createEmbeddingProvider({ provider: "auto" });

// ❌ Bad: Single point of failure
const provider = await createEmbeddingProvider({ provider: "openai" });
```

### 2. Always Enable Cache

```typescript
// ✅ Good: 60-80% fewer API calls
const provider = await createEmbeddingProvider({ cache: true });

// ❌ Bad: Every call hits API
const provider = await createEmbeddingProvider({ cache: false });
```

### 3. Use Batch Operations

```typescript
// ✅ Good: Single API call
const embeddings = await provider.embedBatch(texts);

// ❌ Bad: Multiple API calls
const embeddings = await Promise.all(texts.map((t) => provider.embedQuery(t)));
```

### 4. Handle Provider Unavailability

```typescript
try {
  const provider = await createEmbeddingProvider({ provider: "auto" });
  // ... use provider
} catch (error) {
  if (error.message.includes("No embedding providers available")) {
    // Guide user to configure at least one provider
    console.error("Please configure at least one provider. See README.md");
  }
  throw error;
}
```

### 5. Monitor Cache Performance

```typescript
// Periodically check cache stats
setInterval(
  async () => {
    if (provider instanceof CachedEmbeddingProvider) {
      const stats = provider.getStats();

      if (stats.hitRate < 0.4) {
        console.warn(`Low cache hit rate: ${stats.hitRate}`);
      }

      // Cleanup old entries weekly
      await provider.cleanup();
    }
  },
  7 * 24 * 60 * 60 * 1000,
); // 7 days
```

## Troubleshooting

### "No embedding providers available"

**Cause**: No providers configured or all health checks failed

**Solution**:

1. Set at least one API key (OPENAI_API_KEY, etc.)
2. Or install Ollama locally (free, offline)

```bash
# Quick fix: Install Ollama
curl https://ollama.ai/install.sh | sh
ollama pull nomic-embed-text
```

### "Provider 'openai' is not available"

**Cause**: Specific provider health check failed

**Solution**:

1. Check API key is valid
2. Check network connectivity
3. Try auto-fallback instead:
   ```typescript
   const provider = await createEmbeddingProvider({ provider: "auto" });
   ```

### Cache not working

**Cause**: Cache may be disabled or corrupted

**Solution**:

1. Verify cache is enabled:
   ```typescript
   console.log(provider instanceof CachedEmbeddingProvider); // should be true
   ```
2. Check cache DB exists and is writable:
   ```bash
   ls -lh ./data/embedding-cache.db
   ```
3. Clear cache if corrupted:
   ```bash
   rm ./data/embedding-cache.db
   ```

### Slow performance

**Possible causes**:

1. Cache disabled → Enable cache
2. Using Ollama on slow hardware → Switch to OpenAI
3. Large batch without cache → Batch operations are cached too

**Solution**:

```typescript
// Benchmark your providers
import { createAllProviders } from "./services/embeddings";

const providers = await createAllProviders({ cache: false });
for (const provider of providers) {
  const start = Date.now();
  await provider.embedQuery("test");
  console.log(`${provider.id}: ${Date.now() - start}ms`);
}
```

## API Reference

See TypeScript definitions in `src/services/embeddings/` for complete API documentation.

## Contributing

This implementation follows patterns from OpenClaw's proven embedding system. Key principles:

1. **Content-based caching** (SHA-256)
2. **Exponential backoff** retry
3. **Health checks** before usage
4. **Transparent caching** (no API changes)

## License

Part of th0th MCP project.
