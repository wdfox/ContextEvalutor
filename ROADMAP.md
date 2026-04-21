# Roadmap and Work in Progress

## Now

- Keep V1 focused on Codex trace import and "where did my context go?" analysis.
- Improve confidence in event categorization and token attribution as more real traces are inspected.
- Make the UI good enough for public-build screenshots and short demos.

## Next

- Add live current-session mode by watching or polling the latest active Codex rollout file.
- Add a clearer session picker for active, recent, archived, and automation runs.
- Add export/share mode with redaction controls for public posts.
- Add comparison between two runs: top context consumers, tool mix, cache ratio, and context-window pressure.
- Add richer "context health" warnings: oversized tool outputs, repetitive reads, high setup cost, and low cache effectiveness.

## Later

- Package a macOS menu bar companion that shows current session context usage ambiently.
- Open the full explorer from the menu bar app for deep inspection.
- Support additional trace sources: manual JSON import, OpenTelemetry GenAI traces, OpenAI Agents SDK traces, LangSmith/Phoenix exports, and CLI/API instrumentation.
- Add ablation and marginal-value experiments once descriptive accounting is trustworthy.

## Product Direction

The likely magical UX is not only a dashboard. It is a local context cockpit:

- A menu bar item shows the current session name, context-window usage, top active context consumers, and warnings.
- A larger native or web window lets builders explore previous conversations, tool calls, raw payloads, comparisons, and exportable findings.

The current web app should remain the fastest way to prove the data model, importer, charts, and analysis before investing in native packaging.
