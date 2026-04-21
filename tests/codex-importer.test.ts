import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categorizeEvent, parseRolloutFile } from "../lib/codex-importer";

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
