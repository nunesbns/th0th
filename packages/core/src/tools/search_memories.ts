/**
 * Search Memories Tool
 *
 * Busca memórias armazenadas no sistema hierárquico local (SQLite)
 * para recuperar contexto persistente entre sessões
 */

import { IToolHandler } from "@th0th/shared";
import { ToolResponse, MemoryType, MemoryLevel } from "@th0th/shared";
import { logger } from "@th0th/shared";
import { Database } from "bun:sqlite";
import { config } from "@th0th/shared";
import path from "path";
import fs from "fs";
import { EmbeddingService } from "../data/chromadb/vector-store.js";
import { encode as toTOON } from "@toon-format/toon";
import { memoryConsolidationJob } from "../services/jobs/memory-consolidation-job.js";

interface SearchMemoriesParams {
  query: string;
  userId?: string;
  sessionId?: string;
  projectId?: string;
  agentId?: string; // Filter by agent who created the memory
  types?: MemoryType[];
  minImportance?: number; // 0-1
  limit?: number;
  includePersistent?: boolean; // Include memories from other sessions
  format?: "json" | "toon";
}

interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  level: MemoryLevel;
  userId: string | null;
  sessionId: string | null;
  projectId: string | null;
  agentId: string | null; // Which agent created this memory
  importance: number;
  tags: string[];
  createdAt: number;
  accessCount: number;
  lastAccessed: number | null;
  score?: number; // Similarity score
  embedding?: any; // Raw embedding for semantic ranking
}

/**
 * Search stored memories using semantic + keyword search
 */
export class SearchMemoriesTool implements IToolHandler {
  name = "search_memories";
  description =
    "Search stored memories across sessions using semantic search (recovers context from previous conversations)";
  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (what to remember)",
      },
      userId: {
        type: "string",
        description: "Filter by user ID",
      },
      sessionId: {
        type: "string",
        description: "Filter by session ID",
      },
      projectId: {
        type: "string",
        description: "Filter by project ID",
      },
      agentId: {
        type: "string",
        description: "Filter by agent ID (orchestrator, implementer, architect, optimizer)",
      },
      types: {
        type: "array",
        items: {
          type: "string",
          enum: ["preference", "conversation", "code", "decision", "pattern"],
        },
        description: "Filter by memory types",
      },
      minImportance: {
        type: "number",
        description: "Minimum importance (0-1)",
        default: 0.3,
      },
      limit: {
        type: "number",
        description: "Maximum results to return",
        default: 10,
      },
      includePersistent: {
        type: "boolean",
        description: "Include persistent memories from other sessions",
        default: true,
      },
      format: {
        type: "string",
        enum: ["json", "toon"],
        description: "Output format (json or toon)",
        default: "toon",
      },
    },
    required: ["query"],
  };

  private db!: Database;
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.initialize();
  }

  private initialize(): void {
    const dataDir = config.get("dataDir");
    const dbPath = path.join(dataDir, "memories.db");

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      logger.warn("Memory database not found", { dbPath });
      // Database will be created by store_memory when first memory is stored
    }

    this.db = new Database(dbPath);

    // Migration: Ensure agent_id column exists (in case search runs before store)
    try {
      const columns = this.db
        .prepare("PRAGMA table_info(memories)")
        .all() as any[];

      if (columns.length > 0) {
        // Table exists
        const hasAgentId = columns.some((col) => col.name === "agent_id");
        if (!hasAgentId) {
          logger.info("Migrating database: adding agent_id column");
          this.db.exec("ALTER TABLE memories ADD COLUMN agent_id TEXT");
          this.db.exec(
            "CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id)",
          );
          logger.info("Migration complete: agent_id column added");
        }
      }
    } catch (error) {
      logger.warn("Migration check failed (table might not exist yet)", {
        error: (error as Error).message,
      });
    }

    logger.info("Memory search initialized", { dbPath });
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const {
      query,
      userId,
      sessionId,
      projectId,
      agentId,
      types,
      minImportance = 0.3,
      limit = 10,
      includePersistent = true,
      format = "toon",
    } = params as SearchMemoriesParams;

    try {
      logger.info("Searching memories", {
        query: query.slice(0, 50),
        hasUserId: !!userId,
        hasSessionId: !!sessionId,
        hasProjectId: !!projectId,
        agentId: agentId || "any",
        limit,
      });

      // Step 1: Generate query embedding for semantic search
      const queryEmbedding = await this.embeddingService.embed(query);

      // Step 2: Full-text search (fast pre-filter)
      const ftsResults = this.fullTextSearch(query, {
        userId,
        sessionId,
        projectId,
        agentId,
        types,
        minImportance,
        includePersistent,
        limit: limit * 3, // Get more candidates for semantic ranking
      });

      logger.info("FTS search completed", {
        foundResults: ftsResults.length,
        query: query.slice(0, 30),
      });

      // Step 3: Semantic ranking using embeddings (only if embeddings are available)
      const hasValidEmbedding = queryEmbedding.some((v) => v !== 0);
      
      const rankedResults = hasValidEmbedding
        ? this.semanticRank(ftsResults, queryEmbedding, limit)
        : ftsResults.slice(0, limit).map((m) => ({ ...m, score: 1.0 })); // Fallback: use FTS results with default score

      logger.info("Ranking completed", {
        resultsCount: rankedResults.length,
        usedSemanticRanking: hasValidEmbedding,
        firstScore: rankedResults[0]?.score,
      });

      // Step 4: Update access counts
      this.updateAccessCounts(rankedResults.map((r) => r.id));

      // Opportunistic background consolidation (non-blocking)
      memoryConsolidationJob.maybeRun("search");

      logger.info("Memories found", {
        total: rankedResults.length,
        topScore: rankedResults[0]?.score || 0,
      });

      const responseData = {
        success: true,
        data: {
          memories: rankedResults.map((m) => ({
            id: m.id,
            content: m.content,
            type: m.type,
            level: m.level,
            agentId: m.agentId,
            importance: m.importance,
            tags: m.tags,
            score: m.score,
            createdAt: new Date(m.createdAt).toISOString(),
            accessCount: m.accessCount,
          })),
          query,
          total: rankedResults.length,
        },
      };

      return format === "toon"
        ? { success: true, data: toTOON(responseData.data) }
        : responseData;
    } catch (error) {
      logger.error("Failed to search memories", error as Error, { query });
      return {
        success: false,
        error: `Failed to search memories: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Full-text search using SQLite FTS5
   */
  private fullTextSearch(
    query: string,
    options: {
      userId?: string;
      sessionId?: string;
      projectId?: string;
      agentId?: string;
      types?: MemoryType[];
      minImportance: number;
      includePersistent: boolean;
      limit: number;
    },
  ): Memory[] {
    const conditions: string[] = [];
    const params: any[] = [];

    // Build WHERE clause
    if (options.userId) {
      conditions.push("m.user_id = ?");
      params.push(options.userId);
    }

    if (options.projectId) {
      conditions.push("m.project_id = ?");
      params.push(options.projectId);
    }

    // Agent filtering: include both matching agentId AND null (backward compatibility)
    if (options.agentId) {
      conditions.push("(m.agent_id = ? OR m.agent_id IS NULL)");
      params.push(options.agentId);
    }

    if (options.types && options.types.length > 0) {
      conditions.push(`m.type IN (${options.types.map(() => "?").join(",")})`);
      params.push(...options.types);
    }

    conditions.push("m.importance >= ?");
    params.push(options.minImportance);

    // Session filtering
    if (!options.includePersistent && options.sessionId) {
      conditions.push("m.session_id = ?");
      params.push(options.sessionId);
    } else if (options.includePersistent) {
      // Include persistent memories (L0, L1, L2) and current session (L3)
      conditions.push("(m.level <= ? OR (m.level = ? AND m.session_id = ?))");
      params.push(
        MemoryLevel.USER, // L2 and below
        MemoryLevel.SESSION, // L3
        options.sessionId || "",
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Preprocess query for FTS5: Convert to OR for better recall
    // "morph workflow preferences" -> "morph OR workflow OR preferences"
    const ftsQuery = query
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .join(" OR ");

    // FTS5 search
    const sql = `
      SELECT 
        m.id, m.content, m.type, m.level,
        m.user_id, m.session_id, m.project_id, m.agent_id,
        m.importance, m.tags, m.embedding,
        m.created_at, m.access_count, m.last_accessed
      FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      ${whereClause}
      AND fts.content MATCH ?
      ORDER BY m.importance DESC, m.created_at DESC
      LIMIT ?
    `;

    params.push(ftsQuery);
    params.push(options.limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(this.rowToMemory);
  }

  /**
   * Rank results by semantic similarity
   */
  private semanticRank(
    memories: Memory[],
    queryEmbedding: number[],
    limit: number,
  ): Memory[] {
    // Calculate cosine similarity for each memory
    const scored = memories.map((memory) => {
      // Parse embedding from Buffer
      const embeddingBuffer = (memory as any).embedding;
      const embedding = embeddingBuffer
        ? Array.from(new Float32Array(embeddingBuffer.buffer))
        : null;

      // Check if embedding is valid (not all zeros)
      const isValidEmbedding = embedding && embedding.some((v) => v !== 0);

      // Check if dimensions match AND embedding is valid
      const canCalculateSimilarity =
        isValidEmbedding && embedding.length === queryEmbedding.length;

      const semanticScore = canCalculateSimilarity
        ? this.cosineSimilarity(queryEmbedding, embedding)
        : 0.5; // Default score for incompatible or missing embeddings

      const temporalScore = this.calculateTemporalScore(memory);
      const accessBoost = this.calculateAccessBoost(memory.accessCount || 0);
      const typeBoost = this.calculateTypeBoost(memory.type);

      // Stability-plasticity balance:
      // - semantic: 65% (plasticity)
      // - temporal recency: 20%
      // - access reinforcement: 10%
      // - type prior: 5%
      const score =
        semanticScore * 0.65 +
        temporalScore * 0.2 +
        accessBoost * 0.1 +
        typeBoost * 0.05;

      return { ...memory, score };
    });

    // Sort by score (descending) and return top N
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Adaptive forgetting curve inspired by Ebbinghaus.
   * Recent memories score higher; old untouched memories decay smoothly.
   */
  private calculateTemporalScore(memory: Memory): number {
    const now = Date.now();
    const reference = memory.lastAccessed || memory.createdAt;
    const ageHours = Math.max(0, (now - reference) / (1000 * 60 * 60));

    // half-life ~72h: score halves every 3 days without reinforcement
    const halfLifeHours = 72;
    const decay = Math.pow(0.5, ageHours / halfLifeHours);
    return Math.max(0.1, Math.min(1, decay));
  }

  /**
   * Frequently accessed memories get reinforcement but with saturation.
   */
  private calculateAccessBoost(accessCount: number): number {
    // log curve saturates after repeated accesses
    const normalized = Math.log1p(Math.max(0, accessCount)) / Math.log(20);
    return Math.max(0.1, Math.min(1, normalized));
  }

  /**
   * Small priors for memory types that are usually more reusable.
   */
  private calculateTypeBoost(type: MemoryType): number {
    switch (type) {
      case MemoryType.DECISION:
        return 1.0;
      case MemoryType.PATTERN:
        return 0.9;
      case MemoryType.PREFERENCE:
        return 0.85;
      case MemoryType.CODE:
        return 0.8;
      case MemoryType.CONVERSATION:
      default:
        return 0.7;
    }
  }

  /**
   * Update access counts for retrieved memories
   */
  private updateAccessCounts(memoryIds: string[]): void {
    if (memoryIds.length === 0) return;

    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed = ?
      WHERE id = ?
    `);

    const transaction = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(now, id);
      }
    });

    transaction(memoryIds);
  }

  /**
   * Convert database row to Memory object
   */
  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      type: row.type as MemoryType,
      level: row.level as MemoryLevel,
      userId: row.user_id,
      sessionId: row.session_id,
      projectId: row.project_id,
      agentId: row.agent_id,
      importance: row.importance,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at,
      accessCount: row.access_count || 0,
      lastAccessed: row.last_accessed || null,
      embedding: row.embedding, // Keep for semantic ranking
    };
  }
}
