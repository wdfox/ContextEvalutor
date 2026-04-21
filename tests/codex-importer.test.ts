import { execFile } from "node:child_process";
import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { categorizeEvent, classifyActivityStatus, listCodexSessions, parseRolloutFile } from "../lib/codex-importer";

const execFileAsync = promisify(execFile);

describe("categorizeEvent", () => {
  it("maps core Codex event shapes into context categories", () => {
    expect(categorizeEvent("session_meta", "session_meta", {}, null)).toBe("setup");
    expect(categorizeEvent("response_item", "message", { role: "user" }, null)).toBe("user");
    expect(categorizeEvent("response_item", "message", { role: "assistant" }, null)).toBe("assistant");
    expect(categorizeEvent("response_item", "reasoning", {}, null)).toBe("reasoning");
    expect(categorizeEvent("response_item", "function_call", { name: "exec_command" }, "exec_command")).toBe("cli");
    expect(categorizeEvent("event_msg", "mcp_tool_call_end", {}, "_fetch")).toBe("mcp");
    expect(categorizeEvent("response_item", "function_call_output", {}, "exec_command")).toBe("tool-output");
    expect(categorizeEvent("event_msg", "token_count", {}, null)).toBe("token-sample");
  });
});

describe("activity metadata", () => {
  it("classifies likely-live, recent, idle, and archived sessions", () => {
    const now = Date.UTC(2026, 3, 21, 12, 0, 0);

    expect(classifyActivityStatus(now - 90_000, false, now)).toBe("likely-live");
    expect(classifyActivityStatus(now - 15 * 60_000, false, now)).toBe("recent");
    expect(classifyActivityStatus(now - 45 * 60_000, false, now)).toBe("idle");
    expect(classifyActivityStatus(now - 30_000, true, now)).toBe("archived");
    expect(classifyActivityStatus(null, false, now)).toBe("idle");
  });

  it("uses rollout file stats for fallback session ordering and activity status", async () => {
    const codexHome = await mkdtemp(path.join(os.tmpdir(), "context-evaluator-codex-home-"));
    const activeDir = path.join(codexHome, "sessions", "2026", "04", "21");
    const archivedDir = path.join(codexHome, "archived_sessions");
    await mkdir(activeDir, { recursive: true });
    await mkdir(archivedDir, { recursive: true });

    const older = path.join(activeDir, "rollout-2026-04-21T09-00-00-older.jsonl");
    const newer = path.join(activeDir, "rollout-2026-04-21T10-00-00-newer.jsonl");
    const archived = path.join(archivedDir, "rollout-2026-04-21T11-00-00-archived.jsonl");
    await writeFile(older, "{}\n", "utf8");
    await writeFile(newer, "{}\n{}\n", "utf8");
    await writeFile(archived, "{}\n", "utf8");

    const olderTime = new Date(Date.now() - 20 * 60_000);
    const newerTime = new Date(Date.now() - 30_000);
    const archivedTime = new Date(Date.now() - 10_000);
    await utimes(older, olderTime, olderTime);
    await utimes(newer, newerTime, newerTime);
    await utimes(archived, archivedTime, archivedTime);

    const sessions = await listCodexSessions(codexHome);

    expect(sessions[0].rolloutPath).toBe(archived);
    expect(sessions[0]).toMatchObject({
      archived: true,
      activityStatus: "archived",
      rolloutSizeBytes: 3,
    });
    expect(sessions[1].rolloutPath).toBe(newer);
    expect(sessions[1]).toMatchObject({
      activityStatus: "likely-live",
      rolloutSizeBytes: 6,
    });
    expect(sessions[2].rolloutPath).toBe(older);
    expect(sessions[2].activityStatus).toBe("recent");
  });

  it("uses SQLite metadata and rollout stats when the Codex thread index exists", async () => {
    const codexHome = await mkdtemp(path.join(os.tmpdir(), "context-evaluator-codex-home-"));
    const sessionDir = path.join(codexHome, "sessions", "2026", "04", "21");
    const archivedDir = path.join(codexHome, "archived_sessions");
    await mkdir(sessionDir, { recursive: true });
    await mkdir(archivedDir, { recursive: true });

    const stalePath = path.join(sessionDir, "rollout-2026-04-21T08-00-00-stale.jsonl");
    const livePath = path.join(sessionDir, "rollout-2026-04-21T09-00-00-live.jsonl");
    const archivedPath = path.join(archivedDir, "rollout-2026-04-21T10-00-00-archived.jsonl");
    await writeFile(stalePath, "{}\n", "utf8");
    await writeFile(livePath, "{}\n{}\n{}\n", "utf8");
    await writeFile(archivedPath, "{}\n{}\n", "utf8");

    const staleTime = new Date(Date.now() - 45 * 60_000);
    const liveTime = new Date(Date.now() - 30_000);
    const archivedTime = new Date(Date.now() - 20_000);
    await utimes(stalePath, staleTime, staleTime);
    await utimes(livePath, liveTime, liveTime);
    await utimes(archivedPath, archivedTime, archivedTime);

    const dbPath = path.join(codexHome, "state_5.sqlite");
    await execFileAsync("sqlite3", [
      dbPath,
      `CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        source TEXT,
        cwd TEXT,
        model TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        created_at_ms INTEGER,
        updated_at_ms INTEGER,
        tokens_used INTEGER,
        rollout_path TEXT,
        archived INTEGER
      );`,
    ]);

    const now = Date.now();
    const staleUpdatedMs = now - 60 * 60_000;
    const liveUpdatedMs = now - 20 * 60_000;
    const archivedUpdatedMs = now - 15_000;
    await execFileAsync("sqlite3", [
      dbPath,
      `INSERT INTO threads VALUES
        ('stale', 'Stale SQLite Session', 'codex', '/tmp/stale', 'gpt-test', ${Math.floor(staleUpdatedMs / 1000)}, ${Math.floor(staleUpdatedMs / 1000)}, ${staleUpdatedMs}, ${staleUpdatedMs}, 10, '${stalePath}', 0),
        ('live', 'Live SQLite Session', 'codex', '/tmp/live', 'gpt-test', ${Math.floor(liveUpdatedMs / 1000)}, ${Math.floor(liveUpdatedMs / 1000)}, ${liveUpdatedMs}, ${liveUpdatedMs}, 20, '${livePath}', 0),
        ('archived', 'Archived SQLite Session', 'codex', '/tmp/archived', 'gpt-test', ${Math.floor(archivedUpdatedMs / 1000)}, ${Math.floor(archivedUpdatedMs / 1000)}, ${archivedUpdatedMs}, ${archivedUpdatedMs}, 30, '${archivedPath}', 1);`,
    ]);

    const sessions = await listCodexSessions(codexHome);
    const live = sessions.find((session) => session.id === "live");
    const archived = sessions.find((session) => session.id === "archived");

    expect(sessions[0].id).toBe("archived");
    expect(live).toMatchObject({
      title: "Live SQLite Session",
      activityStatus: "likely-live",
      rolloutSizeBytes: 9,
    });
    expect(live?.lastActivityAt).toBeGreaterThan(liveUpdatedMs);
    expect(archived).toMatchObject({
      activityStatus: "archived",
      rolloutSizeBytes: 6,
    });
  });
});

describe("parseRolloutFile", () => {
  it("parses JSONL, links call ids, captures token samples, and tolerates malformed lines", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "context-evaluator-"));
    const file = path.join(dir, "rollout-test.jsonl");
    const lines = [
      {
        timestamp: "2026-04-19T10:00:00.000Z",
        type: "session_meta",
        payload: { type: "session_meta", cwd: "/tmp/project" },
      },
      {
        timestamp: "2026-04-19T10:01:00.000Z",
        type: "response_item",
        payload: { type: "message", role: "user", content: "Please inspect the repo." },
      },
      {
        timestamp: "2026-04-19T10:02:00.000Z",
        type: "response_item",
        payload: {
          type: "function_call",
          name: "exec_command",
          call_id: "call_1",
          arguments: "{\"cmd\":\"ls\"}",
        },
      },
      {
        timestamp: "2026-04-19T10:02:01.000Z",
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call_1",
          output: "package.json\napp\nlib",
        },
      },
      {
        timestamp: "2026-04-19T10:03:00.000Z",
        type: "event_msg",
        payload: {
          type: "mcp_tool_call_end",
          call_id: "call_2",
          invocation: { server: "Notion", tool: "_fetch", arguments: { id: "page" } },
          result: { Ok: [{ text: "notion result" }] },
        },
      },
      {
        timestamp: "2026-04-19T10:04:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 1000,
              cached_input_tokens: 250,
              output_tokens: 100,
              reasoning_output_tokens: 10,
              total_tokens: 1100,
            },
            last_token_usage: {
              input_tokens: 500,
              cached_input_tokens: 100,
              output_tokens: 20,
              reasoning_output_tokens: 0,
              total_tokens: 520,
            },
            model_context_window: 2000,
          },
        },
      },
    ];

    await writeFile(
      file,
      `${lines.map((line) => JSON.stringify(line)).join("\n")}\n{not json}\n`,
      "utf8",
    );

    const parsed = await parseRolloutFile(file);
    expect(parsed.events).toHaveLength(6);
    expect(parsed.warnings).toContain("Skipped malformed JSONL line 7.");
    expect(parsed.tokenSamples).toHaveLength(1);
    expect(parsed.tokenSamples[0]).toMatchObject({
      inputTokens: 1000,
      cachedInputTokens: 250,
      lastInputTokens: 500,
      lastCachedInputTokens: 100,
      contextWindow: 2000,
      contextPercent: 0.25,
    });

    const output = parsed.events.find((event) => event.payloadType === "function_call_output");
    expect(output?.toolName).toBe("exec_command");
    expect(output?.category).toBe("tool-output");

    const mcp = parsed.events.find((event) => event.payloadType === "mcp_tool_call_end");
    expect(mcp?.toolName).toBe("_fetch");
    expect(mcp?.category).toBe("mcp");
  });
});
