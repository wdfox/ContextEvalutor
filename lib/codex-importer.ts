import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { byteSize, estimateTokens, stringifyForTokenEstimate } from "./token-estimator";
import type {
  CategoryTotal,
  ContextAnalysis,
  EventCategory,
  TimelinePoint,
  TokenSample,
  TokenUsage,
  ToolTotal,
  TraceEvent,
  TraceSession,
} from "./types";

const execFileAsync = promisify(execFile);
const CATEGORIES: EventCategory[] = [
  "setup",
  "user",
  "assistant",
  "reasoning",
  "cli",
  "mcp",
  "tool-output",
  "token-sample",
  "other",
];

const analysisCache = new Map<string, { mtimeMs: number; analysis: ContextAnalysis }>();

type RawCodexLine = {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

type SqlThreadRow = {
  id: string;
  title: string;
  source: string;
  cwd: string;
  model: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  tokenTotal: number;
  rolloutPath: string;
  archived: boolean;
};

export async function listCodexSessions(codexHome = defaultCodexHome()): Promise<TraceSession[]> {
  const fromSqlite = await listSessionsFromSqlite(codexHome);
  if (fromSqlite.length > 0) {
    return sortSessions(fromSqlite);
  }

  return sortSessions(await listSessionsFromFiles(codexHome));
}

export async function analyzeCodexSession(
  sessionId: string,
  codexHome = defaultCodexHome(),
): Promise<ContextAnalysis | null> {
  const sessions = await listCodexSessions(codexHome);
  const session = sessions.find((candidate) => candidate.id === sessionId);
  if (!session) {
    return null;
  }

  const stat = await fs.stat(session.rolloutPath);
  const cached = analysisCache.get(session.rolloutPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.analysis;
  }

  const { events, tokenSamples, warnings } = await parseRolloutFile(session.rolloutPath);
  const analysis = buildAnalysis(session, events, tokenSamples, warnings);
  analysisCache.set(session.rolloutPath, { mtimeMs: stat.mtimeMs, analysis });
  return analysis;
}

export async function parseRolloutFile(filePath: string): Promise<{
  events: TraceEvent[];
  tokenSamples: TokenSample[];
  warnings: string[];
}> {
  const content = await fs.readFile(filePath, "utf8");
  const events: TraceEvent[] = [];
  const tokenSamples: TokenSample[] = [];
  const warnings: string[] = [];
  const callNames = new Map<string, string>();

  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    let raw: RawCodexLine;
    try {
      raw = JSON.parse(line) as RawCodexLine;
    } catch {
      warnings.push(`Skipped malformed JSONL line ${index + 1}.`);
      return;
    }

    const payload = isObject(raw.payload) ? raw.payload : {};
    const eventType = safeString(raw.type) || "unknown";
    const payloadType = safeString(payload.type) || eventType;
    const callId = safeString(payload.call_id);
    const explicitName = getToolName(payload);
    if (callId && explicitName) {
      callNames.set(callId, explicitName);
    }

    const toolName = explicitName || (callId ? callNames.get(callId) ?? null : null);
    const timestamp = safeString(raw.timestamp) || new Date(0).toISOString();
    const category = categorizeEvent(eventType, payloadType, payload, toolName);
    const tokenSample = buildTokenSample(payload, tokenSamples.length, timestamp);

    if (tokenSample) {
      tokenSamples.push(tokenSample);
    }

    const sizeTarget = sizeTargetForEvent(payloadType, payload);
    const event: TraceEvent = {
      id: `${path.basename(filePath)}:${index + 1}`,
      timestamp,
      line: index + 1,
      eventType,
      payloadType,
      category,
      role: safeString(payload.role),
      source: safeString(payload.source) || safeString(payload.namespace),
      toolName,
      callId,
      estimatedTokens: estimateTokens(sizeTarget),
      byteSize: byteSize(sizeTarget),
      preview: buildPreview(payloadType, payload, toolName),
      raw,
    };
    events.push(event);
  });

  return { events, tokenSamples, warnings };
}

export function categorizeEvent(
  eventType: string,
  payloadType: string,
  payload: Record<string, unknown>,
  toolName: string | null,
): EventCategory {
  const role = safeString(payload.role);
  if (payloadType === "token_count") {
    return "token-sample";
  }
  if (eventType === "session_meta" || eventType === "turn_context" || payloadType === "task_started") {
    return "setup";
  }
  if (payloadType === "reasoning") {
    return "reasoning";
  }
  if (role === "user" || payloadType === "user_message") {
    return "user";
  }
  if (role === "assistant" || payloadType === "agent_message") {
    return "assistant";
  }
  if (payloadType === "mcp_tool_call_end" || isMcpTool(toolName)) {
    return "mcp";
  }
  if (payloadType === "exec_command_end" || toolName === "exec_command") {
    return payloadType === "function_call_output" ? "tool-output" : "cli";
  }
  if (payloadType === "function_call_output") {
    return "tool-output";
  }
  if (payloadType === "function_call" || payloadType.endsWith("_call")) {
    return "mcp";
  }
  return "other";
}

function buildAnalysis(
  session: TraceSession,
  events: TraceEvent[],
  tokenSamples: TokenSample[],
  warnings: string[],
): ContextAnalysis {
  const categoryTotals = buildCategoryTotals(events);
  const toolTotals = buildToolTotals(events);
  const largestEvents = [...events]
    .filter((event) => event.estimatedTokens > 0)
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, 12);
  const timeline = buildTimeline(events, tokenSamples);
  const latestSample = tokenSamples.at(-1) ?? null;
  const exactInputTokens = latestSample?.lastInputTokens ?? null;
  const exactTotalTokens = latestSample?.totalTokens ?? (session.tokenTotal > 0 ? session.tokenTotal : null);
  const contextWindow = latestSample?.contextWindow ?? null;
  const contextPercent =
    latestSample?.contextPercent ?? (exactInputTokens && contextWindow ? exactInputTokens / contextWindow : null);
  const cacheRatio =
    latestSample && latestSample.lastInputTokens > 0
      ? latestSample.lastCachedInputTokens / latestSample.lastInputTokens
      : null;
  const estimatedTokens = events.reduce((sum, event) => sum + event.estimatedTokens, 0);
  const toolCallCount = events.filter((event) => event.payloadType === "function_call").length;
  const mcpCallCount = events.filter((event) => event.category === "mcp").length;
  const enrichedWarnings = [
    ...warnings,
    ...(tokenSamples.length === 0
      ? ["No Codex token_count events found; exact context-window totals are unavailable for this run."]
      : []),
    "Per-event attribution is estimated with a tokenizer and should be read as directional, not provider billing truth.",
  ];

  return {
    session,
    events,
    tokenSamples,
    categoryTotals,
    toolTotals,
    largestEvents,
    timeline,
    insights: buildInsights(categoryTotals, toolTotals, largestEvents, latestSample),
    warnings: enrichedWarnings,
    totals: {
      estimatedTokens,
      exactInputTokens,
      exactTotalTokens,
      contextWindow,
      contextPercent,
      cacheRatio,
      eventCount: events.length,
      toolCallCount,
      mcpCallCount,
    },
  };
}

function buildCategoryTotals(events: TraceEvent[]): CategoryTotal[] {
  return CATEGORIES.map((category) => {
    const matching = events.filter((event) => event.category === category);
    return {
      category,
      estimatedTokens: matching.reduce((sum, event) => sum + event.estimatedTokens, 0),
      byteSize: matching.reduce((sum, event) => sum + event.byteSize, 0),
      events: matching.length,
    };
  })
    .filter((total) => total.events > 0)
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}

function buildToolTotals(events: TraceEvent[]): ToolTotal[] {
  const totals = new Map<string, ToolTotal>();
  events.forEach((event) => {
    if (!event.toolName) {
      return;
    }
    const existing =
      totals.get(event.toolName) ??
      ({
        toolName: event.toolName,
        category: event.category,
        estimatedTokens: 0,
        byteSize: 0,
        calls: 0,
        outputs: 0,
      } satisfies ToolTotal);

    existing.estimatedTokens += event.estimatedTokens;
    existing.byteSize += event.byteSize;
    if (event.payloadType === "function_call" || event.payloadType.endsWith("_call")) {
      existing.calls += 1;
    }
    if (event.payloadType === "function_call_output" || event.payloadType.endsWith("_end")) {
      existing.outputs += 1;
    }
    totals.set(event.toolName, existing);
  });

  return [...totals.values()].sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}

function buildTimeline(events: TraceEvent[], tokenSamples: TokenSample[]): TimelinePoint[] {
  const tokenSampleByLine = new Map<number, TokenSample>();
  let sampleIndex = 0;
  events.forEach((event) => {
    if (event.payloadType === "token_count") {
      const sample = tokenSamples[sampleIndex];
      sampleIndex += 1;
      if (sample) {
        tokenSampleByLine.set(event.line, sample);
      }
    }
  });

  const running = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<EventCategory, number>;
  const points: TimelinePoint[] = [];
  events.forEach((event, index) => {
    running[event.category] += event.estimatedTokens;
    const sample = tokenSampleByLine.get(event.line);
    points.push({
      index,
      timestamp: event.timestamp,
      totalEstimatedTokens: CATEGORIES.reduce((sum, category) => sum + running[category], 0),
      exactInputTokens: sample?.lastInputTokens ?? null,
      contextPercent: sample?.contextPercent ?? null,
      ...running,
    });
  });

  return points;
}

function buildInsights(
  categoryTotals: CategoryTotal[],
  toolTotals: ToolTotal[],
  largestEvents: TraceEvent[],
  latestSample: TokenSample | null,
): string[] {
  const insights: string[] = [];
  const topCategory = categoryTotals[0];
  if (topCategory) {
    insights.push(`${labelCategory(topCategory.category)} is the largest estimated context category in this run.`);
  }

  const topTool = toolTotals[0];
  if (topTool) {
    insights.push(`${topTool.toolName} is the largest estimated tool contributor across calls and outputs.`);
  }

  const largest = largestEvents[0];
  if (largest) {
    insights.push(`The largest individual event is line ${largest.line}: ${largest.preview}`);
  }

  if (latestSample?.contextPercent != null) {
    insights.push(
      `The latest exact Codex sample uses ${formatPercent(latestSample.contextPercent)} of the reported context window.`,
    );
  }

  if (latestSample && latestSample.lastInputTokens > 0) {
    insights.push(
      `${formatPercent(latestSample.lastCachedInputTokens / latestSample.lastInputTokens)} of latest input tokens were cache reads.`,
    );
  }

  return insights;
}

async function listSessionsFromSqlite(codexHome: string): Promise<TraceSession[]> {
  const dbPath = path.join(codexHome, "state_5.sqlite");
  try {
    await fs.access(dbPath);
    const { stdout } = await execFileAsync("sqlite3", [
      "-json",
      dbPath,
      `SELECT id, title, source, cwd, model, created_at AS createdAt, updated_at AS updatedAt,
              tokens_used AS tokenTotal, rollout_path AS rolloutPath, archived
       FROM threads
       WHERE rollout_path IS NOT NULL AND rollout_path != ''
       ORDER BY updated_at DESC;`,
    ]);
    const rows = JSON.parse(stdout || "[]") as SqlThreadRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title || "Untitled Codex Session",
      source: row.source || "codex",
      cwd: row.cwd || "",
      model: row.model,
      createdAt: normalizeEpoch(row.createdAt),
      updatedAt: normalizeEpoch(row.updatedAt),
      tokenTotal: Number(row.tokenTotal) || 0,
      rolloutPath: row.rolloutPath,
      archived: Boolean(row.archived),
    }));
  } catch {
    return [];
  }
}

async function listSessionsFromFiles(codexHome: string): Promise<TraceSession[]> {
  const files = await collectJsonlFiles([
    path.join(codexHome, "sessions"),
    path.join(codexHome, "archived_sessions"),
  ]);

  const sessions = await Promise.all(
    files.map(async (file) => {
      const stat = await fs.stat(file);
      const id = sessionIdFromPath(file);
      return {
        id,
        title: id,
        source: "codex-jsonl",
        cwd: "",
        model: null,
        createdAt: stat.birthtimeMs,
        updatedAt: stat.mtimeMs,
        tokenTotal: 0,
        rolloutPath: file,
        archived: file.includes(`${path.sep}archived_sessions${path.sep}`),
      } satisfies TraceSession;
    }),
  );
  return sessions;
}

async function collectJsonlFiles(roots: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const root of roots) {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) {
        continue;
      }
      await walk(root, files);
    } catch {
      continue;
    }
  }
  return files;
}

async function walk(dir: string, files: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }),
  );
}

function buildTokenSample(
  payload: Record<string, unknown>,
  index: number,
  timestamp: string,
): TokenSample | null {
  if (payload.type !== "token_count" || !isObject(payload.info)) {
    return null;
  }

  const info = payload.info;
  const total = parseUsage(info.total_token_usage);
  const last = parseUsage(info.last_token_usage);
  const contextWindow = numberOrNull(info.model_context_window);
  return {
    index,
    timestamp,
    inputTokens: total.inputTokens,
    cachedInputTokens: total.cachedInputTokens,
    outputTokens: total.outputTokens,
    reasoningOutputTokens: total.reasoningOutputTokens,
    totalTokens: total.totalTokens,
    lastInputTokens: last.inputTokens,
    lastCachedInputTokens: last.cachedInputTokens,
    lastOutputTokens: last.outputTokens,
    lastReasoningOutputTokens: last.reasoningOutputTokens,
    lastTotalTokens: last.totalTokens,
    contextWindow,
    contextPercent: contextWindow ? last.inputTokens / contextWindow : null,
  };
}

function parseUsage(value: unknown): TokenUsage {
  const usage = isObject(value) ? value : {};
  return {
    inputTokens: numberOrZero(usage.input_tokens),
    cachedInputTokens: numberOrZero(usage.cached_input_tokens),
    outputTokens: numberOrZero(usage.output_tokens),
    reasoningOutputTokens: numberOrZero(usage.reasoning_output_tokens),
    totalTokens: numberOrZero(usage.total_tokens),
  };
}

function sizeTargetForEvent(payloadType: string, payload: Record<string, unknown>) {
  if (payloadType === "message") {
    return payload.content ?? payload;
  }
  if (payloadType === "function_call") {
    return { name: payload.name, arguments: payload.arguments };
  }
  if (payloadType === "function_call_output") {
    return payload.output ?? payload;
  }
  if (payloadType === "mcp_tool_call_end") {
    return payload.result ?? payload;
  }
  if (payloadType === "exec_command_end") {
    return payload.aggregated_output ?? payload.stdout ?? payload.stderr ?? payload;
  }
  if (payloadType === "token_count") {
    return "";
  }
  return payload;
}

function buildPreview(payloadType: string, payload: Record<string, unknown>, toolName: string | null) {
  const prefix = toolName ? `${toolName}: ` : "";
  const content =
    payload.message ??
    payload.summary ??
    payload.content ??
    payload.output ??
    payload.aggregated_output ??
    payload.result ??
    payload.arguments ??
    payload.command ??
    payloadType;
  return truncate(`${prefix}${stringifyForTokenEstimate(content).replace(/\s+/g, " ").trim()}`, 180);
}

function getToolName(payload: Record<string, unknown>): string | null {
  const name = safeString(payload.name);
  if (name) {
    return name;
  }

  const invocation = isObject(payload.invocation) ? payload.invocation : null;
  return safeString(invocation?.tool);
}

function isMcpTool(toolName: string | null) {
  if (!toolName) {
    return false;
  }
  return toolName.startsWith("_") || toolName.includes(".");
}

function sortSessions(sessions: TraceSession[]) {
  return [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function sessionIdFromPath(filePath: string) {
  return path.basename(filePath, ".jsonl").replace(/^rollout-[^-]+-/, "");
}

function defaultCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function normalizeEpoch(value: number | null) {
  if (!value) {
    return null;
  }
  return value > 10_000_000_000 ? value : value * 1000;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function labelCategory(category: EventCategory) {
  return category.replace("-", " ");
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
