# Experiment: Polling-Based Live Mode

Date: 2026-04-21

## What We Tried

We prototyped a selected-session Live Mode that:

- Added heuristic session activity metadata from Codex SQLite rows and rollout file stats.
- Marked recent non-archived sessions as likely live.
- Added a Live Mode toggle that polled the selected session analysis every few seconds.
- Upgraded the selected session to live after the browser observed file or metadata growth.
- Added a jump-to-latest-live affordance when another likely-live session was newer.

## What Worked

- Codex local storage provides enough signals to infer recent activity directionally.
- `threads.updated_at`, `tokens_used`, rollout file mtime, file size, and event count all moved during active turns.
- Polling the selected session technically refreshed the timeline, event table, and token totals without a full page reload.
- The distinction between likely live and observed live is useful because Codex does not expose an authoritative active-session flag.

## What Felt Wrong

- The Live toggle felt bolted onto the existing historical explorer instead of becoming a natural current-session experience.
- The session picker remained the weak foundation; active/current/recent/archived semantics need to be clearer before Live Mode can feel trustworthy.
- A user-managed Live Mode control asks the user to understand implementation mechanics.
- The experience wanted an ambient "current session cockpit" rather than a manual refresh mode on top of an old-session browser.

## Product Lessons

- Treat "live" as an ambient state the app earns through observation, not as a feature users have to manage.
- Design the current-session surface first, then decide how historical exploration connects to it.
- Keep activity detection language humble: likely live, recently active, idle, archived.
- Preserve local-first behavior. The prototype did not require external telemetry or persistent app storage, and that remains the right constraint.

## Suggested Next Attempt

Start with a session picker and current-session cockpit redesign:

- Make the newest likely-active session the first-viewport focus.
- Separate current, recent, archived, and automation runs visually.
- Show activity freshness, context-window pressure, top context consumers, and recent tool bursts without requiring a Live toggle.
- Let the explorer remain available for historical drilldown, but do not make it carry the whole live experience.

## Decision

Do not carry the prototype implementation forward. Keep this note as the reusable artifact and restart the feature from a product-shape pass later.
