# Repository Guidelines

Keep this file lightweight. It is the quick orientation for agents working in this repo.

## Where to Start

- Read `README.md` for the project overview and commands.
- Read `ROADMAP.md` for current work in progress and future direction.
- Read `docs/` for focused context:
  - `docs/product-direction.md`
  - `docs/architecture.md`
  - `docs/codex-importer.md`
  - `docs/data-model.md`
  - `docs/verification.md`

## Repo Shape

- Next.js App Router local web app.
- `app/page.tsx` is the main UI.
- `app/api/` contains local API routes.
- `lib/codex-importer.ts` is the importer and analysis engine.
- `lib/types.ts` defines normalized trace/session/analysis shapes.
- `tests/` covers parser and category behavior.

## Development Guidelines

- Keep trace data local by default. Do not add upload, external telemetry, or persistent app storage without an explicit product decision.
- Treat Codex storage as private/internal and subject to change.
- Be explicit when values are estimated rather than exact.
- Keep source-specific importer behavior isolated so new trace sources can be added later.
- Prefer small, focused UI changes that preserve the local-first exploratory workflow.
- When finishing a meaningful task, update relevant README/docs/roadmap notes so the repo stays understandable for the next session.

## Branching

- Keep `main` stable and shippable.
- Use short-lived branches for meaningful work: `feature/<short-name>`, `fix/<short-name>`, `docs/<short-name>`, or `chore/<short-name>`.
- Keep each branch scoped to one coherent task or experiment.
- Before starting work, check `git status --short --branch` and avoid mixing unrelated local changes.
- For meaningful code/product work, create a new branch from `main` or ask the user which branch to use before editing.
- If already on a non-`main` branch, continue there only if the branch clearly matches the requested work; otherwise ask first.
- Commit only reviewed, intentional files. Do not stage generated artifacts such as `.next/`, `.playwright-cli/`, or `node_modules/`.
- At the end of a meaningful task, summarize changed files and verification, then ask whether to commit, push, or open a PR unless the user already gave explicit git instructions.
- Push branches and open a PR for larger feature work, risky importer changes, or anything that benefits from review/history. Tiny docs-only follow-ups can be committed directly to `main` only if the user asks.

## Verification

For code changes, run:

```bash
npm test
npm run build
```

For UI changes, also run `npm run dev` and verify the app in a browser at `http://localhost:3000`.
