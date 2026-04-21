# Context Evaluator

Context Evaluator is a local-first context visualization tool for agent conversations. The current V1 is a Next.js app that auto-discovers Codex sessions from `~/.codex`, parses Codex JSONL rollout traces, and shows how context grows over time.

The wedge is narrow on purpose: help builders answer "where did my context go?" before expanding into deeper evals, marginal-value analysis, and live session instrumentation.

## Current Surface

- Local web app at `http://localhost:3000`.
- Read-only importer for Codex session metadata and rollout JSONL files.
- Session browser, context timeline, category/tool breakdowns, event table, and raw event drawer.
- Exact Codex turn-level token samples where available.
- Estimated per-event attribution using `gpt-tokenizer`.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run verify
```

## Key Docs

- [Product direction](docs/product-direction.md)
- [Architecture](docs/architecture.md)
- [Codex importer](docs/codex-importer.md)
- [Data model](docs/data-model.md)
- [Verification](docs/verification.md)
- [Roadmap and work in progress](ROADMAP.md)

## Privacy Posture

V1 is local-first. It reads local Codex files from `~/.codex` and does not upload traces or create an app database. Full trace text is shown locally because the product is most useful when builders can inspect the actual context payloads.
