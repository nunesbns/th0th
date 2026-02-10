# BEIR Benchmark Report - Sicad Backend Fixture

Date: 2026-02-10

## What was created

- Fixture generator script: `packages/core/src/scripts/create-sicad-beir-fixture.ts`
- New root script: `bench:fixture:sicad`
- Fixture output (runtime): `/tmp/beir/sicad-backend`

The fixture converts the Sicad Backend repository into BEIR format:

- `corpus.jsonl`
- `queries.jsonl`
- `qrels/test.tsv`

## Fixture generation run

Command:

```bash
bun run bench:fixture:sicad -- \
  --sourceRepo /home/joaov/projetos/Sicad-Backend \
  --outputDir /tmp/beir/sicad-backend
```

Output summary:

- Corpus docs: `166`
- Queries: `10`
- Qrels rows: `31`

## Benchmark run

Command:

```bash
bun run bench:beir -- \
  --datasetDir /tmp/beir/sicad-backend \
  --datasetName sicad-backend \
  --projectId beir-sicad-backend-ollama \
  --k 10 \
  --maxQueries 10 \
  --forceReindex true
```

Environment and embedding setup:

- `.env` auto-loaded from monorepo root
- Provider: `ollama`
- Model: `nomic-embed-text:latest`
- Dimensions: `768`

## Results

```json
{
  "dataset": "sicad-backend",
  "projectId": "beir-sicad-backend-ollama",
  "evaluatedQueries": 10,
  "k": 10,
  "metrics": {
    "Recall@10": 0.4833333333333333,
    "nDCG@10": 0.3942131888235686,
    "MRR@10": 0.4625
  },
  "performance": {
    "indexingMs": 17178,
    "avgQueryLatencyMs": 203.5,
    "p95QueryLatencyMs": 289
  }
}
```

## Notes

- This is a domain fixture benchmark (Sicad codebase), useful for iterative tuning of retrieval quality in your target project.
- During the run, one FTS warning appeared (`fts5: syntax error near ","`) for keyword parsing; benchmark still completed with vector + hybrid retrieval.
