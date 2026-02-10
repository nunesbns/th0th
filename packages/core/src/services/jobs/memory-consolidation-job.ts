import { Database } from "bun:sqlite";
import path from "path";
import { config, logger, MemoryLevel } from "@th0th/shared";

interface ConsolidationStats {
  promoted: number;
  decayed: number;
  pruned: number;
}

/**
 * Background consolidation for long-running memory quality.
 * - Promotes high-value session memories to user level
 * - Decays stale low-value memories
 * - Prunes very old low-signal memories
 */
export class MemoryConsolidationJob {
  private running = false;
  private lastRunAt = 0;
  private readonly minIntervalMs = 5 * 60 * 1000;

  maybeRun(trigger: "store" | "search" = "store"): void {
    const now = Date.now();
    if (this.running || now - this.lastRunAt < this.minIntervalMs) {
      return;
    }

    this.lastRunAt = now;
    void this.runOnce(trigger);
  }

  private async runOnce(trigger: "store" | "search"): Promise<void> {
    this.running = true;
    const startedAt = Date.now();
    const dbPath = path.join(config.get("dataDir"), "memories.db");

    let db: Database | null = null;
    try {
      db = new Database(dbPath);
      db.exec("PRAGMA busy_timeout = 3000");

      const stats = db.transaction(() => this.consolidate(db!))();

      logger.info("Memory consolidation completed", {
        trigger,
        ...stats,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      logger.warn("Memory consolidation skipped", {
        trigger,
        error: (error as Error).message,
      });
    } finally {
      this.running = false;
      db?.close();
    }
  }

  private consolidate(db: Database): ConsolidationStats {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const promoted = this.promoteSessionMemories(db, now, day);
    const decayed = this.decayStaleMemories(db, now, day);
    const pruned = this.pruneOldLowSignalMemories(db, now, day);

    return { promoted, decayed, pruned };
  }

  private promoteSessionMemories(db: Database, now: number, day: number): number {
    db.prepare(
      `
        UPDATE memories
        SET level = ?,
            importance = MIN(1.0, importance + 0.08),
            updated_at = ?
        WHERE id IN (
          SELECT id
          FROM memories
          WHERE level = ?
            AND type IN ('conversation', 'decision', 'pattern')
            AND created_at < ?
            AND (importance + MIN(access_count, 12) * 0.04) >= 0.85
          LIMIT 120
        )
      `,
    ).run(MemoryLevel.USER, now, MemoryLevel.SESSION, now - day);

    return this.changes(db);
  }

  private decayStaleMemories(db: Database, now: number, day: number): number {
    db.prepare(
      `
        UPDATE memories
        SET importance = MAX(0.1, importance * 0.92),
            updated_at = ?
        WHERE importance < 0.8
          AND created_at < ?
          AND (last_accessed IS NULL OR last_accessed < ?)
      `,
    ).run(now, now - 7 * day, now - 7 * day);

    return this.changes(db);
  }

  private pruneOldLowSignalMemories(db: Database, now: number, day: number): number {
    const staleIds = (
      db
        .prepare(
          `
            SELECT id
            FROM memories
            WHERE created_at < ?
              AND importance < 0.25
              AND access_count < 2
            LIMIT 200
          `,
        )
        .all(now - 45 * day) as Array<{ id: string }>
    ).map((row) => row.id);

    if (staleIds.length === 0) {
      return 0;
    }

    const placeholders = staleIds.map(() => "?").join(",");

    db.prepare(
      `
        DELETE FROM memories_fts
        WHERE rowid IN (
          SELECT rowid
          FROM memories
          WHERE id IN (${placeholders})
        )
      `,
    ).run(...staleIds);

    db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).run(
      ...staleIds,
    );

    return this.changes(db);
  }

  private changes(db: Database): number {
    const row = db.prepare("SELECT changes() as count").get() as {
      count: number;
    };
    return row.count;
  }
}

export const memoryConsolidationJob = new MemoryConsolidationJob();
