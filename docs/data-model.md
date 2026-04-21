# Data Model

The normalized model lives in `lib/types.ts`.

## TraceSession

Represents one imported conversation or rollout.

Key fields:

- `id`
- `title`
- `source`
- `cwd`
- `model`
- `createdAt`
- `updatedAt`
- `tokenTotal`
- `rolloutPath`
- `archived`
- `lastActivityAt`
- `rolloutMtimeMs`
- `rolloutSizeBytes`
- `activityStatus`

`activityStatus` is a heuristic used by the live UI. Values are:

- `likely-live`: non-archived activity within roughly 2 minutes.
- `recent`: non-archived activity within roughly 30 minutes.
- `idle`: no recent non-archived activity.
- `archived`: archived Codex session, regardless of freshness.

`lastActivityAt` uses the freshest known session timestamp from Codex metadata and rollout file stats. It is useful for sorting and live detection, but it is not an authoritative active-session signal.

## TraceEvent

Represents one normalized JSONL event.

Key fields:

- `id`
- `timestamp`
- `line`
- `eventType`
- `payloadType`
- `category`
- `role`
- `source`
- `toolName`
- `callId`
- `estimatedTokens`
- `byteSize`
- `preview`
- `raw`

## TokenSample

Represents one exact Codex `token_count` sample.

Important distinction:

- `inputTokens` is cumulative `total_token_usage.input_tokens`.
- `lastInputTokens` is latest-call `last_token_usage.input_tokens`.
- `contextPercent` uses `lastInputTokens / contextWindow`.

This avoids confusing cumulative usage with current context-window occupancy.

## ContextAnalysis

The UI consumes this shape.

Includes:

- `session`
- `events`
- `tokenSamples`
- `categoryTotals`
- `toolTotals`
- `largestEvents`
- `timeline`
- `insights`
- `warnings`
- `totals`

## Timeline

Timeline points are cumulative estimated event-token totals by category. If an exact token sample exists at the same JSONL line, the point also includes exact latest input tokens and context percent.
