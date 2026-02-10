/**
 * Core Types for th0th MCP Server
 * 
 * This file contains all fundamental type definitions following
 * the hierarchical memory architecture described in docs/02-architecture.md
 */

/**
 * Memory Hierarchy Levels
 * 
 * Level 4: Working Memory (Context Window)
 * Level 3: Session Memory (Local SQLite)
 * Level 2: User Memory (Local SQLite)
 * Level 1: Project Memory (Vector DB + SQLite)
 * Level 0: Persistent Memory (Files)
 */
export enum MemoryLevel {
  PERSISTENT = 0,  // Files, git history
  PROJECT = 1,     // Indexed code, ASTs
  USER = 2,        // User preferences, patterns
  SESSION = 3,     // Current conversation
  WORKING = 4      // Active tokens in LLM
}

/**
 * Memory Types
 */
export enum MemoryType {
  PREFERENCE = 'preference',
  CONVERSATION = 'conversation',
  CODE = 'code',
  DECISION = 'decision',
  PATTERN = 'pattern'
}

/**
 * Base Memory Interface
 */
export interface Memory {
  id: string;
  type: MemoryType;
  level: MemoryLevel;
  content: string;
  metadata: MemoryMetadata;
  embedding?: number[];
  importance: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * Memory Metadata
 */
export interface MemoryMetadata {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  tags?: string[];
  references?: string[]; // File paths or other memory IDs
  context?: Record<string, unknown>;
  accessCount?: number; // For popularity boosting
  createdAt?: Date | string; // For recency boosting
  
  // Code-specific metadata
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  language?: string;
  functionName?: string;
  className?: string;
}

/**
 * Cache Entry Interface
 */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  level: CacheLevel;
  ttl: number; // seconds
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number; // bytes
}

/**
 * Cache Levels (L1 = fastest)
 */
export enum CacheLevel {
  L1 = 1, // In-memory Map
  L2 = 2  // SQLite
}

/**
 * Compressed Content
 */
export interface CompressedContent {
  original: string;
  compressed: string;
  compressionRatio: number; // 0-1
  tokensSaved: number;
  strategy: CompressionStrategy;
  metadata: CompressionMetadata;
}

/**
 * Compression Strategies
 */
export enum CompressionStrategy {
  CODE_STRUCTURE = 'code_structure',     // Keep only signatures
  CONVERSATION_SUMMARY = 'conversation_summary', // Summarize dialogue
  SEMANTIC_DEDUP = 'semantic_dedup',     // Remove redundant info
  HIERARCHICAL = 'hierarchical'          // Multi-level compression
}

/**
 * Compression Metadata
 */
export interface CompressionMetadata {
  language?: string;
  originalTokens: number;
  compressedTokens: number;
  preservedElements: string[];
  timestamp: Date;
}

/**
 * Score Explanation
 */
export interface ScoreExplanation {
  finalScore: number;
  vectorScore?: number;
  keywordScore?: number;
  rrfScore?: number;
  vectorRank?: number;
  keywordRank?: number;
  combinedRank?: number;
  breakdown: string;
}

/**
 * Search Result
 */
export interface SearchResult {
  id: string;
  content: string;
  score: number; // relevance score 0-1
  source: SearchSource;
  metadata: MemoryMetadata;
  highlights?: string[];
  explanation?: ScoreExplanation;
}

/**
 * Search Sources
 */
export enum SearchSource {
  VECTOR = 'vector',
  KEYWORD = 'keyword',
  HYBRID = 'hybrid',
  CACHE = 'cache'
}

/**
 * Security Context
 */
export interface SecurityContext {
  userId: string;
  projectId: string;
  sessionId: string;
  permissions: Permission[];
}

/**
 * Permissions
 */
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

/**
 * Retrieval Options
 */
export interface RetrievalOptions {
  maxResults?: number;
  minScore?: number;
  sources?: SearchSource[];
  useCache?: boolean;
  compress?: boolean;
  explainScores?: boolean;
  securityContext?: SecurityContext;
}

/**
 * Storage Options
 */
export interface StorageOptions {
  level: MemoryLevel;
  ttl?: number;
  importance?: number;
  generateEmbedding?: boolean;
  securityContext: SecurityContext;
}

/**
 * MCP Tool Response
 */
export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tokensSaved?: number;
    compressionRatio?: number;
    cacheHit?: boolean;
    latency?: number;
  };
}
