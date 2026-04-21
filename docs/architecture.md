# Architecture

## Current Shape

Context Evaluator is a local Next.js app with Node route handlers for filesystem access.

```text
Next.js UI
  -> /api/sessions
  -> /api/sessions/[id]
  -> lib/codex-importer.ts
  -> ~/.codex/state_5.sqlite and rollout JSONL files
```

## Key Modules

- `app/page.tsx`: session browser, summary cards, timeline, breakdowns, event table, raw payload drawer.
- `app/api/sessions/route.ts`: lists discovered Codex sessions.
- `app/api/sessions/[id]/route.ts`: parses and analyzes a single session.
- `lib/codex-importer.ts`: Codex session discovery, JSONL parsing, event categorization, token samples, analysis.
- `lib/token-estimator.ts`: token and byte estimation helpers.
- `lib/types.ts`: shared normalized types.

## Runtime Boundaries

The app uses API routes because browser-only code cannot scan `~/.codex`. The frontend should stay unaware of raw filesystem details and consume normalized JSON from route handlers.

## Data Flow

1. Session list API reads `~/.codex/state_5.sqlite`.
2. SQLite rows provide session id, title, source, cwd, model, token total, timestamps, and rollout path.
3. Single-session API reads the rollout JSONL path.
4. Parser normalizes raw lines into `TraceEvent` records.
5. Analyzer computes token samples, category totals, tool totals, timeline, largest events, insights, and warnings.
6. UI renders the analysis without persisting anything.

## Caching

V1 only uses in-memory analysis caching by rollout path and file mtime. There is no app database.

## Design Bias

Prefer small adapter seams for source-specific behavior. The Codex importer should remain replaceable when adding OpenTelemetry, OpenAI Agents SDK, LangSmith/Phoenix, or manual JSON imports.
