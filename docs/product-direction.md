# Product Direction

## Core Thesis

Context Evaluator helps builders and teams understand how agents use their context window so they can set better practices around tools, skills, MCP servers, retrieval, and third-party integrations.

The product should answer questions like:

- Where is my context going?
- What is using it up?
- What tools, MCPs, apps, or calls are the biggest context consumers?
- When does performance start to degrade as the window fills?
- Is an MCP server, CLI, or API call more context-efficient for a given workflow?
- What is the marginal value of a tool call or piece of context?

## V1 Wedge

V1 focuses on one clear question: "Where did my context go in this Codex session?"

This is the right starting point because it is:

- Visually legible.
- Directly useful during dogfooding.
- Data-foundational for later marginal-value and degradation analysis.
- Strong for public-build demos.

## Surface Strategy

The current local web app is the best first build surface because it is fast to iterate and good for rich visualizations.

The more magical final surface is likely:

- A macOS menu bar app for ambient current-session context awareness.
- A larger native or web explorer window for deep inspection of previous conversations.

The menu bar should eventually show:

- Current session name.
- Latest input tokens and context-window percent.
- Biggest active context consumers.
- Recent tool-call burst.
- Warnings when a session gets heavy.
- One-click entry into the full explorer.

The larger explorer should show:

- Previous conversations.
- Context timeline.
- Tool/type breakdowns.
- Raw event drilldown.
- Compare sessions.
- Public-share and export modes.

## Product Principle

Keep the context engine separate from the surface. The engine imports traces, normalizes events, estimates token attribution, and computes stats. Then a web app, menu bar app, CLI report, or native window can all sit on top.
