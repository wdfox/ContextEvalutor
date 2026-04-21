"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  Database,
  FileJson,
  FolderSearch,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import type { ContextAnalysis, EventCategory, TraceEvent, TraceSession } from "@/lib/types";

const CATEGORY_COLORS: Record<EventCategory, string> = {
  setup: "#7658a8",
  user: "#277c62",
  assistant: "#3f68b1",
  reasoning: "#b78325",
  cli: "#2a7f92",
  mcp: "#b55145",
  "tool-output": "#6f7b86",
  "token-sample": "#999184",
  other: "#1d2320",
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  setup: "Setup",
  user: "User",
  assistant: "Assistant",
  reasoning: "Reasoning",
  cli: "CLI",
  mcp: "MCP/App",
  "tool-output": "Tool output",
  "token-sample": "Token sample",
  other: "Other",
};

const ACTIVITY_LABELS: Record<TraceSession["activityStatus"], string> = {
  "likely-live": "Live",
  recent: "Recent",
  idle: "Idle",
  archived: "Archived",
};

const POLL_INTERVAL_MS = 3000;

export default function Home() {
  const [sessions, setSessions] = useState<TraceSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ContextAnalysis | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<TraceEvent | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const lastAnalyzedSignatureRef = useRef<Record<string, string>>({});
  const inFlightAnalysisRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadSessions({ initial: true });
    const interval = window.setInterval(() => {
      void loadSessions({ background: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    void loadAnalysis(selectedId, { resetFilters: true });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !analysis || analysis.session.id !== selectedId) {
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedId);
    if (!selectedSession) {
      return;
    }

    const nextSignature = activitySignature(selectedSession);
    const lastAnalyzedSignature = lastAnalyzedSignatureRef.current[selectedId];
    if (lastAnalyzedSignature && nextSignature !== lastAnalyzedSignature) {
      void loadAnalysis(selectedId, { background: true });
    }
  }, [analysis, selectedId, sessions]);

  const filteredSessions = useMemo(() => {
    const lowered = query.toLowerCase();
    return sessions.filter((session) => {
      if (!lowered) {
        return true;
      }
      return [session.title, session.cwd, session.source, session.model ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(lowered);
    });
  }, [query, sessions]);

  const filteredEvents = useMemo(() => {
    if (!analysis) {
      return [];
    }
    return analysis.events.filter((event) => {
      const categoryMatches = categoryFilter === "all" || event.category === categoryFilter;
      const toolMatches = toolFilter === "all" || event.toolName === toolFilter;
      return categoryMatches && toolMatches;
    });
  }, [analysis, categoryFilter, toolFilter]);

  const toolNames = useMemo(() => {
    return analysis?.toolTotals.map((tool) => tool.toolName) ?? [];
  }, [analysis]);

  const liveSuggestion = useMemo(() => {
    return sessions.find((session) => session.activityStatus === "likely-live" && session.id !== selectedId) ?? null;
  }, [selectedId, sessions]);

  async function loadSessions(options: { initial?: boolean; background?: boolean } = {}) {
    if (!options.background) {
      setLoadingSessions(true);
      setError(null);
    }
    try {
      const response = await fetch("/api/sessions");
      const payload = (await response.json()) as { sessions?: TraceSession[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to list Codex sessions.");
      }
      const nextSessions = payload.sessions ?? [];
      setSessions(nextSessions);
      if (options.initial) {
        setSelectedId((current) => current ?? nextSessions[0]?.id ?? null);
      }
    } catch (loadError) {
      if (!options.background) {
        setError(loadError instanceof Error ? loadError.message : "Unable to list Codex sessions.");
      }
    } finally {
      if (!options.background) {
        setLoadingSessions(false);
      }
    }
  }

  async function loadAnalysis(
    id: string,
    options: { background?: boolean; resetFilters?: boolean } = {},
  ) {
    const requestKey = id;
    if (inFlightAnalysisRef.current.has(requestKey)) {
      return;
    }
    inFlightAnalysisRef.current.add(requestKey);
    if (!options.background) {
      setLoadingAnalysis(true);
      setError(null);
    }
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
      const payload = (await response.json()) as ContextAnalysis | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to analyze session.");
      }
      if (selectedIdRef.current !== id) {
        return;
      }
      const nextAnalysis = payload as ContextAnalysis;
      lastAnalyzedSignatureRef.current[id] = activitySignature(nextAnalysis.session);
      setAnalysis(nextAnalysis);
      if (options.resetFilters) {
        setCategoryFilter("all");
        setToolFilter("all");
      }
    } catch (loadError) {
      if (!options.background) {
        setError(loadError instanceof Error ? loadError.message : "Unable to analyze session.");
        setAnalysis(null);
      }
    } finally {
      inFlightAnalysisRef.current.delete(requestKey);
      if (!options.background) {
        setLoadingAnalysis(false);
      }
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <FolderSearch size={24} aria-hidden="true" />
          </div>
          <div>
            <h1>Context Evaluator</h1>
            <p>Local Codex trace accounting</p>
          </div>
        </div>

        <div className="sidebar-tools">
          <label>
            <span className="small-note">Search sessions</span>
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, cwd, model..."
            />
          </label>
          <button
            className="icon-button"
            onClick={() => void loadSessions()}
            title="Refresh sessions"
            aria-label="Refresh sessions"
          >
            <RefreshCcw size={18} aria-hidden="true" />
          </button>
        </div>

        {loadingSessions ? <p className="small-note">Scanning ~/.codex...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="session-list" aria-label="Codex sessions">
          {filteredSessions.map((session) => (
            <button
              className={`session-button ${session.id === selectedId ? "active" : ""}`}
              key={session.id}
              onClick={() => setSelectedId(session.id)}
            >
              <span className="session-title">{truncate(session.title, 92)}</span>
              <span className="session-meta">
                <span>{formatDate(session.lastActivityAt)}</span>
                <span>{compactNumber(session.tokenTotal)} tokens</span>
              </span>
              <span className={`activity-badge ${session.activityStatus}`}>
                {ACTIVITY_LABELS[session.activityStatus]}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="main">
        {!analysis && !loadingAnalysis ? (
          <div className="empty-state">
            <Search size={38} aria-hidden="true" />
            <h2>No session selected</h2>
            <p className="subtitle">Pick a Codex session to inspect where its context went.</p>
          </div>
        ) : null}

        {loadingAnalysis ? (
          <div className="empty-state">
            <Activity size={38} aria-hidden="true" />
            <h2>Analyzing trace</h2>
            <p className="subtitle">Parsing JSONL events and matching exact token samples.</p>
          </div>
        ) : null}

        {analysis && !loadingAnalysis ? (
          <>
            {liveSuggestion ? (
              <div className="live-suggestion">
                <div>
                  <p className="kicker">Live Session Detected</p>
                  <strong>{truncate(liveSuggestion.title, 110)}</strong>
                  <span>{formatDate(liveSuggestion.lastActivityAt)} · {compactNumber(liveSuggestion.tokenTotal)} tokens</span>
                </div>
                <button className="secondary-button" onClick={() => setSelectedId(liveSuggestion.id)}>
                  View live session
                </button>
              </div>
            ) : null}

            <header className="topbar">
              <div>
                <p className="kicker">Codex Session</p>
                <h2>{analysis.session.title}</h2>
                <p className="subtitle">
                  Exact turn-level totals from Codex token samples, with estimated per-event attribution for context
                  exploration.
                </p>
              </div>
              <div className="topbar-actions">
                <div className="path-chip" title={analysis.session.rolloutPath}>
                  <FileJson size={16} aria-hidden="true" />
                  <span>{analysis.session.rolloutPath}</span>
                </div>
                <span className={`activity-badge large ${analysis.session.activityStatus}`}>
                  {ACTIVITY_LABELS[analysis.session.activityStatus]}
                </span>
              </div>
            </header>

            <section className="summary-grid" aria-label="Summary statistics">
              <MetricCard
                label="Latest input tokens"
                value={formatMaybeNumber(analysis.totals.exactInputTokens)}
                foot={`${formatMaybePercent(analysis.totals.contextPercent)} of context window`}
              />
              <MetricCard
                label="Estimated trace tokens"
                value={compactNumber(analysis.totals.estimatedTokens)}
                foot={`${analysis.totals.eventCount} trace events`}
              />
              <MetricCard
                label="Cache share"
                value={formatMaybePercent(analysis.totals.cacheRatio)}
                foot="Latest exact token sample"
              />
              <MetricCard
                label="Top category"
                value={CATEGORY_LABELS[analysis.categoryTotals[0]?.category ?? "other"]}
                foot={`${compactNumber(analysis.categoryTotals[0]?.estimatedTokens ?? 0)} estimated tokens`}
              />
              <MetricCard
                label="Top tool"
                value={analysis.toolTotals[0]?.toolName ?? "None"}
                foot={`${compactNumber(analysis.toolTotals[0]?.estimatedTokens ?? 0)} estimated tokens`}
              />
            </section>

            <div className="content-grid">
              <div>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Context Timeline</h3>
                      <span className="small-note">Cumulative estimated tokens by event category</span>
                    </div>
                    <BarChart3 size={20} aria-hidden="true" />
                  </div>
                  <div className="chart-frame">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analysis.timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d7d1c3" />
                        <XAxis dataKey="index" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={compactNumber} />
                        <Tooltip
                          formatter={(value: number, name: EventCategory) => [
                            compactNumber(value),
                            CATEGORY_LABELS[name] ?? name,
                          ]}
                          labelFormatter={(value) => `Event ${Number(value) + 1}`}
                        />
                        {(Object.keys(CATEGORY_COLORS) as EventCategory[]).map((category) => (
                          <Area
                            key={category}
                            type="monotone"
                            dataKey={category}
                            stackId="1"
                            stroke={CATEGORY_COLORS[category]}
                            fill={CATEGORY_COLORS[category]}
                            fillOpacity={0.82}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Events</h3>
                      <span className="small-note">Open any row to inspect the full local payload</span>
                    </div>
                    <div className="table-controls">
                      <select
                        className="select-input"
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value as EventCategory | "all")}
                        aria-label="Filter category"
                      >
                        <option value="all">All categories</option>
                        {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select-input"
                        value={toolFilter}
                        onChange={(event) => setToolFilter(event.target.value)}
                        aria-label="Filter tool"
                      >
                        <option value="all">All tools</option>
                        {toolNames.map((toolName) => (
                          <option key={toolName} value={toolName}>
                            {toolName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="event-table-wrap">
                    <table className="event-table">
                      <thead>
                        <tr>
                          <th>Line</th>
                          <th>Type</th>
                          <th>Category</th>
                          <th>Tool</th>
                          <th>Est. tokens</th>
                          <th>Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEvents.map((event) => (
                          <tr key={event.id}>
                            <td>
                              <button className="event-row" onClick={() => setSelectedEvent(event)}>
                                {event.line}
                              </button>
                            </td>
                            <td>{event.payloadType}</td>
                            <td>
                              <span className="pill">{CATEGORY_LABELS[event.category]}</span>
                            </td>
                            <td>{event.toolName ?? "-"}</td>
                            <td>{compactNumber(event.estimatedTokens)}</td>
                            <td className="event-preview">{event.preview}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <aside>
                <section className="panel">
                  <div className="panel-header">
                    <h3>Breakdown</h3>
                    <Database size={20} aria-hidden="true" />
                  </div>
                  <ul className="breakdown-list">
                    {analysis.categoryTotals.map((total) => (
                      <li className="breakdown-row" key={total.category}>
                        <span className="breakdown-label">{CATEGORY_LABELS[total.category]}</span>
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{
                              width: `${Math.max(
                                3,
                                (total.estimatedTokens / (analysis.categoryTotals[0]?.estimatedTokens || 1)) * 100,
                              )}%`,
                              background: CATEGORY_COLORS[total.category],
                            }}
                          />
                        </span>
                        <span className="breakdown-value">{compactNumber(total.estimatedTokens)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h3>Interesting Analysis</h3>
                  </div>
                  <ul className="insights-list">
                    {analysis.insights.map((insight) => (
                      <li className="insight" key={insight}>
                        {insight}
                      </li>
                    ))}
                    {analysis.warnings.map((warning) => (
                      <li className="insight" key={warning}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <h3>Top Tools</h3>
                  </div>
                  <ul className="breakdown-list">
                    {analysis.toolTotals.slice(0, 8).map((tool) => (
                      <li className="breakdown-row" key={tool.toolName}>
                        <span className="breakdown-label">{tool.toolName}</span>
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{
                              width: `${Math.max(
                                3,
                                (tool.estimatedTokens / (analysis.toolTotals[0]?.estimatedTokens || 1)) * 100,
                              )}%`,
                              background: CATEGORY_COLORS[tool.category],
                            }}
                          />
                        </span>
                        <span className="breakdown-value">{compactNumber(tool.estimatedTokens)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
          </>
        ) : null}

        {selectedEvent ? <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
      </section>
    </main>
  );
}

function MetricCard({ label, value, foot }: { label: string; value: string; foot: string }) {
  const longValue = value.length > 8 || value.includes("_");
  const veryLongValue = value.length > 10 || value.includes("_");
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className={`metric-value ${longValue ? "long" : ""} ${veryLongValue ? "very-long" : ""}`}>{value}</p>
      <p className="metric-foot">{foot}</p>
    </article>
  );
}

function EventDrawer({ event, onClose }: { event: TraceEvent; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-label="Event payload">
      <section className="drawer">
        <div className="drawer-head">
          <div>
            <p className="kicker">Line {event.line}</p>
            <h3>
              {event.payloadType} · {CATEGORY_LABELS[event.category]}
            </h3>
          </div>
          <button className="icon-button" onClick={onClose} title="Close event payload" aria-label="Close event payload">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <pre>{JSON.stringify(event.raw, null, 2)}</pre>
      </section>
    </div>
  );
}

function compactNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMaybeNumber(value: number | null | undefined) {
  return value == null ? "-" : compactNumber(value);
}

function formatMaybePercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: number | null) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function activitySignature(session: TraceSession) {
  return [
    session.lastActivityAt ?? 0,
    session.updatedAt ?? 0,
    session.tokenTotal,
    session.rolloutMtimeMs ?? 0,
    session.rolloutSizeBytes ?? 0,
    session.activityStatus,
  ].join(":");
}
