export type EventCategory =
  | "setup"
  | "user"
  | "assistant"
  | "reasoning"
  | "cli"
  | "mcp"
  | "tool-output"
  | "token-sample"
  | "other";

export type TraceSession = {
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

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

export type TokenSample = {
  index: number;
  timestamp: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  lastInputTokens: number;
  lastCachedInputTokens: number;
  lastOutputTokens: number;
  lastReasoningOutputTokens: number;
  lastTotalTokens: number;
  contextWindow: number | null;
  contextPercent: number | null;
};

export type TraceEvent = {
  id: string;
  timestamp: string;
  line: number;
  eventType: string;
  payloadType: string;
  category: EventCategory;
  role: string | null;
  source: string | null;
  toolName: string | null;
  callId: string | null;
  estimatedTokens: number;
  byteSize: number;
  preview: string;
  raw: unknown;
};

export type CategoryTotal = {
  category: EventCategory;
  estimatedTokens: number;
  byteSize: number;
  events: number;
};

export type ToolTotal = {
  toolName: string;
  category: EventCategory;
  estimatedTokens: number;
  byteSize: number;
  calls: number;
  outputs: number;
};

export type TimelinePoint = {
  index: number;
  timestamp: string;
  totalEstimatedTokens: number;
  exactInputTokens: number | null;
  contextPercent: number | null;
} & Record<EventCategory, number>;

export type ContextAnalysis = {
  session: TraceSession;
  events: TraceEvent[];
  tokenSamples: TokenSample[];
  categoryTotals: CategoryTotal[];
  toolTotals: ToolTotal[];
  largestEvents: TraceEvent[];
  timeline: TimelinePoint[];
  insights: string[];
  warnings: string[];
  totals: {
    estimatedTokens: number;
    exactInputTokens: number | null;
    exactTotalTokens: number | null;
    contextWindow: number | null;
    contextPercent: number | null;
    cacheRatio: number | null;
    eventCount: number;
    toolCallCount: number;
    mcpCallCount: number;
  };
};
