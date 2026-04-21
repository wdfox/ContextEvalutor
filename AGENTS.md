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

## Verification

For code changes, run:

```bash
npm test
npm run build
```

For UI changes, also run `npm run dev` and verify the app in a browser at `http://localhost:3000`.
