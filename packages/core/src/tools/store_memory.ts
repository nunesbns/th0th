/**
 * Store Memory Tool
 *
 * Armazena memórias no sistema hierárquico local (SQLite).
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

interface StoreMemoryParams {
  content: string;
  type: MemoryType;
  userId?: string;
  sessionId?: string;
  projectId?: string;
  agentId?: string; // OpenCode agent name (e.g., "orchestrator", "implementer")
  importance?: number; // 0-1
  tags?: string[];
  format?: "json" | "toon";
}

/**
 * Local Memory Store usando SQLite
 */
export class StoreMemoryTool implements IToolHandler {
  name = "store_memory";
  description = "Store memory in the hierarchical memory system (local SQLite)";
  inputSchema = {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Content to store",
      },
      type: {
        type: "string",
        enum: ["preference", "conversation", "code", "decision", "pattern"],
        description: "Type of memory",
      },
      userId: {
        type: "string",
        description: "User ID",
      },
      sessionId: {
        type: "string",
        description: "Session ID",
      },
      projectId: {
        type: "string",
        description: "Project ID",
      },
      agentId: {
        type: "string",
        description: "Agent ID (e.g., orchestrator, implementer, architect, optimizer)",
      },
      importance: {
        type: "number",
        description: "Importance score (0-1)",
        default: 0.5,
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags for categorization",
      },
      format: {
        type: "string",
        enum: ["json", "toon"],
        description: "Output format (json or toon)",
        default: "toon",
      },
    },
    required: ["content", "type"],
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

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Check if table exists and needs migration BEFORE creating it
    let needsMigration = false;
    try {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'")
        .all() as any[];

      if (tables.length > 0) {
        // Table exists, check if it has agent_id
        const columns = this.db
          .prepare("PRAGMA table_info(memories)")
          .all() as any[];
        const hasAgentId = columns.some((col) => col.name === "agent_id");
        needsMigration = !hasAgentId;
      }
    } catch (error) {
      // Ignore errors, will create table below
    }

    // Create memories table (with agent_id if new)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        level INTEGER NOT NULL,
        user_id TEXT,
        session_id TEXT,
        project_id TEXT,
        agent_id TEXT,
        importance REAL DEFAULT 0.5,
        tags TEXT, -- JSON array
        embedding BLOB,
        metadata TEXT, -- JSON
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0,
        last_accessed INTEGER
      );

      -- Indexes for fast lookups (excluding agent_id, will be added in migration if needed)
      CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_memories_project_id ON memories(project_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_level ON memories(level);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      
      -- Full-text search on content
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        tags,
        content='memories',
        content_rowid='rowid'
      );
    `);

    // Run migration if needed
    if (needsMigration) {
      logger.info("Migrating database: adding agent_id column");
      this.db.exec("ALTER TABLE memories ADD COLUMN agent_id TEXT");
      this.db.exec(
        "CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id)",
      );
      logger.info("Migration complete: agent_id column added");
    } else {
      // If new table or already migrated, ensure index exists
      this.db.exec(
        "CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id)",
      );
    }

    logger.info("Memory store initialized", { dbPath });
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const {
      content,
      type,
      userId,
      sessionId,
      projectId,
      agentId,
      importance = 0.5,
      tags = [],
      format = "toon",
    } = params as StoreMemoryParams;

    try {
      // Generate memory ID
      const id = this.generateId(type, userId, sessionId);

      // Determine memory level (considering agent hierarchy)
      const level = this.determineLevel(type, userId, sessionId, projectId, agentId);

      // Generate embedding (async, não bloqueia)
      const embedding = await this.embeddingService.embed(content);

      // Store in SQLite
      const stmt = this.db.prepare(`
        INSERT INTO memories (
          id, content, type, level,
          user_id, session_id, project_id, agent_id,
          importance, tags, embedding, metadata,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      stmt.run(
        id,
        content,
        type,
        level,
        userId || null,
        sessionId || null,
        projectId || null,
        agentId || null,
        importance,
        JSON.stringify(tags),
        Buffer.from(new Float32Array(embedding).buffer),
        JSON.stringify({ type, importance, agentId }),
        now,
        now,
      );

      // Index in FTS5
      const ftsStmt = this.db.prepare(`
        INSERT INTO memories_fts (rowid, content, tags)
        SELECT rowid, content, tags FROM memories WHERE id = ?
      `);
      ftsStmt.run(id);

      logger.info("Memory stored", {
        id,
        type,
        level,
        importance,
        hasUserId: !!userId,
        hasSessionId: !!sessionId,
        hasProjectId: !!projectId,
        agentId: agentId || "unknown",
      });

      // Trigger background consolidation opportunistically (non-blocking)
      memoryConsolidationJob.maybeRun("store");

      const responseData = {
        success: true,
        data: {
          memoryId: id,
          stored: "local",
          level,
          type,
        },
      };

      return format === "toon" 
        ? { success: true, data: toTOON(responseData.data) }
        : responseData;
    } catch (error) {
      logger.error("Failed to store memory", error as Error, { type });
      return {
        success: false,
        error: `Failed to store memory: ${(error as Error).message}`,
      };
    }
  }

  private generateId(
    type: MemoryType,
    userId?: string,
    sessionId?: string,
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const prefix = type.substring(0, 3);
    const userPart = userId ? `_${userId.substring(0, 4)}` : "";
    return `${prefix}_${timestamp}_${random}${userPart}`;
  }

  private determineLevel(
    type: MemoryType,
    userId?: string,
    sessionId?: string,
    projectId?: string,
    agentId?: string,
  ): MemoryLevel {
    // Level 4: Working memory (ephemeral)
    // Level 3: Session memory
    // Level 2: User memory
    // Level 1: Project memory
    // Level 0: Persistent memory

    // Agent hierarchy influences memory level:
    // - orchestrator decisions → L0 (persistent)
    // - architect patterns → L1 (project)
    // - implementer code → L1/L3 (project/session)
    // - optimizer suggestions → L2 (user preferences)

    if (agentId === "orchestrator" && type === "decision") {
      return MemoryLevel.PERSISTENT; // L0 - strategic decisions
    }

    if (agentId === "architect" && (type === "pattern" || type === "code")) {
      return MemoryLevel.PROJECT; // L1 - architectural patterns
    }

    if (agentId === "optimizer" && type === "preference") {
      return MemoryLevel.USER; // L2 - optimization preferences
    }

    if (projectId) return MemoryLevel.PROJECT; // L1
    if (userId && !sessionId) return MemoryLevel.USER; // L2
    if (sessionId) return MemoryLevel.SESSION; // L3

    // Default based on type
    switch (type) {
      case "preference":
        return MemoryLevel.USER;
      case "conversation":
        return MemoryLevel.SESSION;
      case "code":
      case "pattern":
        return MemoryLevel.PROJECT;
      case "decision":
        return MemoryLevel.PERSISTENT;
      default:
        return MemoryLevel.SESSION;
    }
  }
}
