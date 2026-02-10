/**
 * Project Routes
 *
 * POST /api/v1/project/index - Indexar projeto (assíncrono)
 * GET /api/v1/project/index/status/:jobId - Consultar status de indexação
 */

import { Elysia, t } from "elysia";
import { IndexProjectTool, GetIndexStatusTool } from "@th0th/core";

const indexProjectTool = new IndexProjectTool();
const getIndexStatusTool = new GetIndexStatusTool();

export const projectRoutes = new Elysia({ prefix: "/api/v1/project" })
  .post(
    "/index",
    async ({ body }) => {
      return await indexProjectTool.handle(body);
    },
    {
      body: t.Object({
        projectPath: t.String({
          description: "Absolute path to the project directory to index",
        }),
        projectId: t.Optional(
          t.String({ description: "Unique identifier for the project" }),
        ),
        forceReindex: t.Optional(t.Boolean({ default: false })),
        warmCache: t.Optional(
          t.Boolean({
            default: false,
            description: "Pre-cache common queries after indexing",
          }),
        ),
        warmupQueries: t.Optional(
          t.Array(t.String(), { description: "Custom queries to pre-cache" }),
        ),
      }),
      detail: {
        tags: ["project"],
        summary: "Index a project (async)",
        description:
          "Start indexing a project directory in background. Returns a jobId immediately. Use GET /index/status/:jobId to check progress.",
      },
    },
  )
  .get(
    "/index/status/:jobId",
    async ({ params }) => {
      return await getIndexStatusTool.handle({ jobId: params.jobId });
    },
    {
      params: t.Object({
        jobId: t.String({ description: "Job ID returned by POST /index" }),
      }),
      detail: {
        tags: ["project"],
        summary: "Get indexing job status",
        description:
          "Get the status and progress of an async indexing job started with POST /index",
      },
    },
  );
