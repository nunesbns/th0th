/**
 * Multi-Provider Embedding Service using Vercel AI SDK
 *
 * Provides a unified interface for embedding generation across multiple providers
 * (OpenAI, Google, Cohere, Ollama) with automatic retry and timeout handling.
 *
 * Inspired by OpenClaw's provider system with improvements:
 * - Uses Vercel AI SDK for provider abstraction
 * - Exponential backoff retry (500ms base, 8s max)
 * - Configurable timeouts (60s remote, 5min local)
 * - Health checks before usage
 * - Batch operations with token limits
 */

import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { cohere } from "@ai-sdk/cohere";
import { mistral } from "@ai-sdk/mistral";
import { ollama } from "ollama-ai-provider";
import type { EmbeddingProviderConfig } from "./config.js";
import { metrics } from "../monitoring/metrics.js";

/**
 * Base interface for embedding providers
 */
export interface EmbeddingProvider {
  /** Unique provider identifier */
  id: string;

  /** Model identifier */
  model: string;

  /** Embedding dimensions */
  dimensions: number;

  /** Embed a single text query */
  embedQuery(text: string): Promise<number[]>;

  /** Embed multiple texts in batch */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Check if provider is available and configured */
  isAvailable(): Promise<boolean>;

  /** Get provider configuration */
  getConfig(): EmbeddingProviderConfig;
}

/**
 * Retry configuration for failed embedding requests
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Execute a function with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  context: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < config.maxRetries) {
        const delay = getRetryDelay(attempt, config);
        console.warn(
          `[EmbeddingProvider] ${context} failed (attempt ${attempt + 1}/${config.maxRetries + 1}), ` +
            `retrying in ${delay}ms:`,
          lastError.message,
        );
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `${context} failed after ${config.maxRetries + 1} attempts: ${lastError?.message}`,
  );
}

/**
 * Execute with timeout
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${context} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([fn(), timeoutPromise]);
}

/**
 * AI SDK-based embedding provider implementation
 *
 * Supports OpenAI, Google, Cohere, and Ollama via Vercel AI SDK
 * with automatic retry, timeout, and health checking.
 */
export class AISDKEmbeddingProvider implements EmbeddingProvider {
  public readonly id: string;
  public readonly model: string;
  public readonly dimensions: number;

  private readonly providerType:
    | "openai"
    | "google"
    | "cohere"
    | "ollama"
    | "mistral";
  private readonly apiKey?: string;
  private readonly baseURL?: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;

  constructor(
    private readonly config: EmbeddingProviderConfig,
    private readonly providerId: string,
  ) {
    this.id = providerId;
    this.model = config.model;
    this.dimensions = config.dimensions || 768; // Default to common dimension
    this.providerType = config.provider;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 60000; // Default 60s

    this.retryConfig = {
      maxRetries: config.maxRetries || 3,
      baseDelay: 500,
      maxDelay: 8000,
    };
  }

  /**
   * Get AI SDK provider instance based on configuration
   */
  private getSDKProvider() {
    switch (this.providerType) {
      case "openai":
        return openai;

      case "google":
        return google;

      case "cohere":
        return cohere;

      case "mistral":
        return mistral;

      case "ollama":
        return ollama;

      default:
        throw new Error(`Unsupported provider: ${this.providerType}`);
    }
  }

  /**
   * Get provider options (API key, base URL)
   */
  private getProviderOptions(): Record<string, any> {
    const options: Record<string, any> = {};

    if (this.apiKey) {
      options.apiKey = this.apiKey;
    }

    if (this.baseURL) {
      options.baseURL = this.baseURL;
    }

    return options;
  }

  /**
   * Embed a single text query
   */
  async embedQuery(text: string): Promise<number[]> {
    const startTime = Date.now();
    let error = false;
    
    try {
      const result = await withTimeout(
        () =>
          withRetry(
            async () => {
              // Ollama: Custom direct API call (no AI SDK)
              if (this.providerType === "ollama") {
                const response = await fetch(`${this.baseURL}/api/embeddings`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: this.model,
                    prompt: text,
                  }),
                });

                if (!response.ok) {
                  throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json() as { embedding: number[] };
                return data.embedding;
              }

              // Other providers: Use AI SDK
              const provider = this.getSDKProvider();
              const options = this.getProviderOptions();

              const { embedding } = await embed({
                model: provider.embedding(this.model, options) as any,
                value: text,
              });

              return Array.from(embedding);
            },
            this.retryConfig,
            `[${this.id}] embedQuery`,
          ),
        this.timeout,
        `[${this.id}] embedQuery`,
      );
      
      // Record metrics (will be marked as cache miss by cached-provider if not cached)
      const latency = Date.now() - startTime;
      const tokens = Math.ceil(text.length / 4); // Rough estimate
      metrics.recordEmbedding({
        provider: this.id,
        tokens,
        latency,
        cached: false, // Provider level doesn't know about cache
        error: false,
      });
      
      return result;
    } catch (err) {
      error = true;
      const latency = Date.now() - startTime;
      const tokens = Math.ceil(text.length / 4);
      metrics.recordEmbedding({
        provider: this.id,
        tokens,
        latency,
        cached: false,
        error: true,
      });
      throw err;
    }
  }

  /**
   * Embed multiple texts in batch
   *
   * Note: AI SDK's embedMany handles batching internally
   * Ollama: Uses sequential calls (no native batch API)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Ollama: Sequential calls (no batch API)
    if (this.providerType === "ollama") {
      const embeddings: number[][] = [];
      for (const text of texts) {
        const embedding = await this.embedQuery(text);
        embeddings.push(embedding);
      }
      return embeddings;
    }

    // Other providers: Use AI SDK batch
    return withTimeout(
      () =>
        withRetry(
          async () => {
            const provider = this.getSDKProvider();
            const options = this.getProviderOptions();

            const { embeddings } = await embedMany({
              model: provider.embedding(this.model, options) as any,
              values: texts,
            });

            return embeddings.map((e) => Array.from(e));
          },
          this.retryConfig,
          `[${this.id}] embedBatch (${texts.length} texts)`,
        ),
      this.timeout,
      `[${this.id}] embedBatch`,
    );
  }

  /**
   * Check if provider is available and configured correctly
   *
   * Performs a test embedding to validate:
   * - API key is valid
   * - Model is accessible
   * - Network connectivity
   * - Service is responding
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple query
      const testText = "test";
      const embedding = await this.embedQuery(testText);

      // Validate embedding format
      if (!Array.isArray(embedding) || embedding.length !== this.dimensions) {
        console.error(
          `[${this.id}] Invalid embedding dimensions: expected ${this.dimensions}, got ${embedding.length}`,
        );
        return false;
      }

      // Validate embedding values (should be numbers)
      if (!embedding.every((v) => typeof v === "number" && !isNaN(v))) {
        console.error(`[${this.id}] Invalid embedding values (not numbers)`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        `[${this.id}] Provider unavailable:`,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Get provider configuration
   */
  getConfig(): EmbeddingProviderConfig {
    return this.config;
  }
}

/**
 * Factory function to create embedding providers from configuration
 */
export function createProvider(
  config: EmbeddingProviderConfig,
  providerId: string,
): EmbeddingProvider {
  return new AISDKEmbeddingProvider(config, providerId);
}

/**
 * Create multiple providers from configurations
 */
export function createProviders(
  configs: Array<[string, EmbeddingProviderConfig]>,
): EmbeddingProvider[] {
  return configs.map(([id, config]) => createProvider(config, id));
}
