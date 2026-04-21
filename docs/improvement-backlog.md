# Improvement Backlog

These are possible improvements beyond the current roadmap. They are not commitments yet; they are candidate directions to evaluate as the product matures.

## Priority Candidates

### Turn-Level Analysis

Group trace events by user turn and assistant turn so the app can answer "which turn changed the context profile?" rather than only showing individual JSONL events.

Useful outputs:

- Estimated tokens by turn.
- Exact token samples nearest each turn boundary.
- Largest tool and output contributors within a turn.
- Turn-to-turn context growth and cache share.

Why it matters: turns are closer to how builders reason about a session than raw trace lines.

### Tool Call Spans

Pair tool calls with their corresponding outputs into one normalized span.

Useful span fields:

- Tool name and category.
- Call id.
- Argument token estimate.
- Output token estimate.
- Duration when timestamps allow it.
- Success, error, or unknown status.
- Linked source event lines.

Why it matters: "top tools" becomes more actionable when calls and outputs are understood together.

### Fixture and Demo Mode

Add deterministic sample traces that can be loaded without reading private local Codex data.

Useful capabilities:

- A small built-in demo session.
- Synthetic fixtures that cover common Codex event shapes.
- Screenshot-safe data for public demos.
- Test fixtures that do not depend on `~/.codex`.

Why it matters: demos, regression tests, and onboarding should not require exposing local trace contents.

### Estimate Confidence Labels

Label values by certainty so users can distinguish exact Codex samples from directional estimates.

Suggested labels:

- `exact`: provider-reported token samples from Codex.
- `estimated`: tokenizer-based estimates.
- `inferred`: values derived from event ordering, call ids, or timestamps.
- `unknown`: unavailable or unsupported.

Why it matters: the app should earn trust by being explicit about what it knows and how it knows it.

## Additional Product Improvements

### Importer Hardening

Make the Codex importer more resilient to large traces, missing tools, and storage changes.

Candidate work:

- Stream JSONL files instead of reading whole files into memory.
- Handle missing `sqlite3` with a visible degraded-state message.
- Detect and report missing or inaccessible rollout paths.
- Add schema-change warnings for unexpected SQLite or JSONL shapes.
- Add golden tests for multiple observed real-world trace shapes.

### Event Table Upgrade

Turn the event table into a more capable analysis surface.

Candidate work:

- Sort by line, timestamp, category, tool, estimated tokens, and byte size.
- Search event previews and raw payload text.
- Filter to largest events first.
- Add pagination or virtualization for large sessions.
- Click timeline regions or breakdown rows to filter the table.

### Metric Definitions

Add lightweight explanations for key metrics and their limitations.

Metrics that need definitions:

- Latest input tokens.
- Estimated trace tokens.
- Cache share.
- Context-window percent.
- Top category.
- Top tool.
- Per-event attribution.

Why it matters: some numbers are exact, some are estimated, and some are analytical summaries. Users should not have to infer the distinction.

### Performance Profiling

Add basic visibility into importer and UI performance so large sessions remain usable.

Candidate signals:

- Rollout file size.
- Event count.
- Parse time.
- Analysis time.
- Cache hit or miss.
- Render limits or chart downsampling status.

### Better Session Filters

Improve session discovery once the session list becomes noisy.

Useful filters:

- Workspace/cwd.
- Model.
- Active, recent, archived, and automation runs.
- Date range.
- Minimum token count.
- Source type.

### Recommendation Layer

After descriptive accounting is trustworthy, add practical suggestions for reducing context pressure.

Example recommendations:

- Trim oversized command outputs.
- Prefer targeted `rg` searches over broad file dumps.
- Avoid repeated reads of unchanged files.
- Move reusable context into concise docs or skills.
- Watch for high setup cost before task-specific work starts.
- Flag low cache effectiveness when repeated context is not being reused efficiently.

Why it matters: the product becomes more valuable when it helps users decide what to change, not only what happened.

## Evaluation Questions

Before promoting any item into the roadmap, answer:

- Does this improve the core question: "where did my context go?"
- Can it be built without weakening the local-first privacy posture?
- Does it make the app more useful with current Codex traces?
- Can it be verified with deterministic fixtures?
- Is the result understandable in a screenshot or short demo?
