/**
 * Get Optimized Context Tool
 *
 * Busca código relevante + comprime semanticamente para economizar tokens.
 * Combina search_project + compress_context automaticamente.
 */

import { IToolHandler } from "@th0th/shared";
import { ToolResponse } from "@th0th/shared";
import { SearchProjectTool } from "./search_project.js";
import { CompressContextTool } from "./compress_context.js";
import { logger } from "@th0th/shared";
import { estimateTokens } from "@th0th/shared";

interface GetOptimizedContextParams {
  query: string;
  projectId: string;
  projectPath?: string;
  maxTokens?: number;
  maxResults?: number;
  workingMemoryBudget?: number;
}

export class GetOptimizedContextTool implements IToolHandler {
  name = "get_optimized_context";
  description =
    "Retrieve and compress context with maximum token efficiency (search + compress)";
  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find relevant context",
      },
      projectId: {
        type: "string",
        description: "Project ID for code context",
      },
      projectPath: {
        type: "string",
        description: "Project path (for auto-reindex)",
      },
      maxTokens: {
        type: "number",
        description: "Maximum tokens in returned context",
        default: 4000,
      },
      maxResults: {
        type: "number",
        description: "Maximum search results to include",
        default: 5,
      },
      workingMemoryBudget: {
        type: "number",
        description:
          "Token budget for active working set before compression (defaults to 80% of maxTokens)",
      },
    },
    required: ["query", "projectId"],
  };

  private searchTool: SearchProjectTool;
  private compressTool: CompressContextTool;

  constructor() {
    this.searchTool = new SearchProjectTool();
    this.compressTool = new CompressContextTool();
  }

  async handle(params: unknown): Promise<ToolResponse> {
    const {
      query,
      projectId,
      projectPath,
      maxTokens = 4000,
      maxResults = 5,
      workingMemoryBudget,
    } = params as GetOptimizedContextParams;

    try {
      logger.info("Getting optimized context", {
        query: query.slice(0, 50),
        projectId,
        maxTokens,
        workingMemoryBudget: workingMemoryBudget || Math.floor(maxTokens * 0.8),
      });

      // Step 1: Search for relevant code
      const searchResponse = await this.searchTool.handle({
        query,
        projectId,
        projectPath,
        maxResults,
        responseMode: "full", // Need full content for compression
        autoReindex: false,
        minScore: 0.4,
      });

      if (!searchResponse.success || !searchResponse.data) {
        return {
          success: false,
          error: "Failed to search code",
        };
      }

      // Step 2: Format search results into context
      const results = (searchResponse.data as any)?.results || [];
      const wmBudget = workingMemoryBudget || Math.floor(maxTokens * 0.8);
      const workingSet = this.selectWorkingSet(results, wmBudget);

      if (workingSet.length === 0) {
        return {
          success: true,
          data: {
            context: `No relevant code found for query: "${query}"`,
            sources: [],
          },
          metadata: {
            tokensSaved: 0,
            compressionRatio: 0,
            cacheHit: false,
          },
        };
      }

      const contextParts: string[] = [
        `# Context for: ${query}\n`,
        `Found ${workingSet.length} relevant code sections (WM budget: ${wmBudget} tokens):\n`,
      ];

      workingSet.forEach((result: any, idx: number) => {
        contextParts.push(
          `## ${idx + 1}. ${result.filePath || "Unknown"} (score: ${(result.score * 100).toFixed(1)}%)`,
        );
        contextParts.push(`Lines ${result.lineStart}-${result.lineEnd}\n`);
        contextParts.push("```" + (result.language || ""));
        contextParts.push(result.content || result.preview || "(no content)");
        contextParts.push("```\n");
      });

      const rawContext = contextParts.join("\n");
      const rawTokens = estimateTokens(rawContext, "code");

      // Step 3: Compress if needed
      let finalContext = rawContext;
      let compressionRatio = 0;
      let tokensSaved = 0;

      if (rawTokens > maxTokens) {
        logger.info("Context exceeds maxTokens, compressing", {
          rawTokens,
          maxTokens,
        });

        const compressResponse = await this.compressTool.handle({
          content: rawContext,
          strategy: "code_structure",
          targetRatio: 0.6, // Compress to 40% of original
        });

        if (compressResponse.success && compressResponse.data) {
          finalContext = (compressResponse.data as any).compressed;
          compressionRatio = compressResponse.metadata?.compressionRatio || 0;
          tokensSaved = compressResponse.metadata?.tokensSaved || 0;
        }
      }

      const finalTokens = estimateTokens(finalContext, "code");

        logger.info("Optimized context retrieved", {
          rawTokens,
          finalTokens,
          tokensSaved: rawTokens - finalTokens,
          compressionRatio: compressionRatio || 0,
          sources: workingSet.length,
          wmBudget,
        });

      return {
        success: true,
        data: {
          context: finalContext,
          sources: workingSet.map((r: any) => r.filePath || "unknown"),
          resultsCount: workingSet.length,
        },
        metadata: {
          tokensSaved: rawTokens - finalTokens,
          compressionRatio: compressionRatio || 0,
          cacheHit: false,
        } as any, // Allow extra metadata fields
      };
    } catch (error) {
      logger.error("Failed to get optimized context", error as Error, {
        query,
        projectId,
      });

      return {
        success: false,
        error: `Failed to retrieve context: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Select an active working set under token budget.
   * Prioritizes top scores while keeping source diversity.
   */
  private selectWorkingSet(results: any[], tokenBudget: number): any[] {
    if (!results.length || tokenBudget <= 0) {
      return [];
    }

    const selected: any[] = [];
    const selectedFiles = new Set<string>();
    let usedTokens = 0;

    const sorted = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Pass 1: pick best from distinct files
    for (const result of sorted) {
      const filePath = result.filePath || "unknown";
      if (selectedFiles.has(filePath)) {
        continue;
      }

      const content = result.content || result.preview || "";
      const tokens = estimateTokens(content, "code");
      if (usedTokens + tokens > tokenBudget) {
        continue;
      }

      selected.push(result);
      selectedFiles.add(filePath);
      usedTokens += tokens;
    }

    // Pass 2: fill remaining budget with best leftovers
    for (const result of sorted) {
      if (selected.includes(result)) {
        continue;
      }

      const content = result.content || result.preview || "";
      const tokens = estimateTokens(content, "code");
      if (usedTokens + tokens > tokenBudget) {
        continue;
      }

      selected.push(result);
      usedTokens += tokens;
    }

    return selected;
  }
}
