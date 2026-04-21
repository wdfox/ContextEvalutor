# Codex Importer

## Discovered Local Sources

On this machine, Codex data exists under `~/.codex`.

Important files and directories:

- `~/.codex/state_5.sqlite`: thread/session index.
- `~/.codex/session_index.jsonl`: lightweight session index.
- `~/.codex/sessions/YYYY/MM/DD/*.jsonl`: active/recent rollout traces.
- `~/.codex/archived_sessions/*.jsonl`: archived rollout traces.
- `~/.codex/logs_2.sqlite`: app logs, not used by V1.

V1 uses `state_5.sqlite` first and falls back to scanning JSONL files if SQLite is unavailable.

## SQLite Fields Used

The `threads` table provides:

- `id`
- `title`
- `source`
- `cwd`
- `model`
- `created_at`
- `updated_at`
- `created_at_ms`
- `updated_at_ms`
- `tokens_used`
- `rollout_path`
- `archived`

`rollout_path` is the bridge from session metadata to the full JSONL trace.

## Live Activity Signals

Codex does not expose an authoritative "current active session" flag, so V1 infers activity from:

- SQLite `updated_at`/`updated_at_ms`.
- Rollout file mtime.
- Rollout file size.
- Archived state.

The importer reports `lastActivityAt`, `rolloutMtimeMs`, `rolloutSizeBytes`, and `activityStatus` for each session. Non-archived sessions are classified as likely live when activity is within roughly 2 minutes, recent within roughly 30 minutes, and idle otherwise. Archived sessions always keep the archived status even if their files are fresh.

## JSONL Event Shapes

Observed event and payload types include:

- `session_meta`
- `turn_context`
- `message`
- `user_message`
- `agent_message`
- `reasoning`
- `function_call`
- `function_call_output`
- `exec_command_end`
- `mcp_tool_call_end`
- `token_count`
- `tool_search_call`
- `tool_search_output`
- `task_started`
- `task_complete`

## Token Accounting

Codex `token_count` events include exact provider-reported samples:

- cumulative `total_token_usage`
- latest-call `last_token_usage`
- `model_context_window`

V1 uses:

- `last_token_usage.input_tokens` as the latest current context-window usage sample.
- `total_token_usage.total_tokens` as cumulative run usage.
- `gpt-tokenizer` estimates for per-event attribution.

Per-event token attribution is directional, not billing truth.

## Event Categories

Normalized categories:

- `setup`
- `user`
- `assistant`
- `reasoning`
- `cli`
- `mcp`
- `tool-output`
- `token-sample`
- `other`

Tool calls and outputs are linked by `call_id` where possible, so outputs can inherit the originating tool name.

## Known Risks

- Codex local storage is private/internal and may change.
- Some events have encrypted or summarized content.
- Tool payloads can be large and sensitive.
- Exact per-event token contribution is not directly available in Codex traces.
- Long automation titles can include full prompt text, so UI needs truncation/redaction work before public sharing.
