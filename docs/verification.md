# Verification

## Required Checks

Run these after importer or UI changes:

```bash
npm run verify
```

`npm run verify` runs the required automated checks: `npm test` and `npm run build`.

## Browser Check

Start the dev server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

Confirm:

- Session list loads from `~/.codex`.
- Sidebar session activity badges appear and the list refreshes without stealing focus from the selected session.
- Selecting a session renders a non-empty context timeline.
- Summary cards show latest input tokens, estimated trace tokens, cache share, top category, and top tool.
- Breakdown and Top Tools panels are non-empty.
- Event table filters work.
- Background refresh of the selected session does not reset event filters or close the payload drawer.
- Clicking an event opens the raw payload drawer.
- No Next.js error overlay is present.
- Browser console has no errors.

## Browser Testing Direction

Use browser checks in layers:

- Use Playwright CLI for fast exploratory checks while developing UI or interaction changes.
- Add committed smoke tests only for stable app-spine behavior: boot, fixture-backed session load, session selection, key panels, event table, payload drawer, and console-error detection.
- Back smoke tests with small synthetic Codex fixtures instead of live `~/.codex` data so they are deterministic and privacy-safe.
- Keep Computer Use as a fallback for desktop-level flows that Playwright cannot inspect, not as the default web-app test path.

Do not add smoke coverage just to mirror manual clicking. Add it when the behavior is stable enough to be a regression guard.

## Current Verification Notes

The initial implementation was verified against local Codex data:

- API discovered 170 Codex sessions.
- Current planning/build session imported successfully.
- Browser rendered timeline, analysis, and top tools.
- No browser console errors after adding `app/icon.svg`.

## Known Tooling Notes

- `agent-browser` was not available in the shell during initial verification.
- The bundled Playwright skill was used instead.
- `npm install` reported 5 moderate audit advisories and a Node-engine warning from an ESLint subdependency on Node 23. These did not block tests or production build.
