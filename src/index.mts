// Public entry for the qa-focus core — the portable gate / flow / healer / standards /
// provider, plus the gated tool factories, exported WITH full types (ADR 0004). This is
// the surface other repos build adapters on; the seams listed in CONTRACTS.md ship as types.

// The locator-priority gate (the non-commodity value).
export { gradeLocator, buildLocator, render, TIERS, DEGRADED } from '../extension/qa-focus/ladder.mjs';
export type { Proposal, GradeResult, Tier, FrameResolution, DebtRecord } from '../extension/qa-focus/ladder.mjs';

// Explorer→codifier flow handoff.
export { newFlow, parseSnapshotRefs, recordStep, flowToSeed, isFlow } from './flow.mjs';
export type { Flow, FlowStep } from './flow.mjs';

// Self-healing locator recovery.
export { healLocator } from './healer.mjs';
export type { HealResult } from './healer.mjs';

// Playwright-standards linter.
export { lintSpec, renderViolations, STANDARDS_PROMPT } from './standards.mjs';
export type { LintResult, Violation } from './standards.mjs';

// URL allowlist + authored auth reuse.
export { makeAllowlist, guardContext } from './allowlist.mjs';
export type { AllowPredicate } from './allowlist.mjs';
export { resolveStorageState } from './authored.mjs';

// Surface provider (web / electron / openfin).
export { openSurface } from './provider.mjs';
export type { Surface, SurfaceKind, OpenSurfaceOptions } from './provider.mjs';

// The gated-session control model (the hard leash).
export { createGatedSession } from './harness.mjs';
export type { GatedSession, GatedSessionOptions } from './harness.mjs';

// The model's capability surface — gated tool factories.
export { makeBrowserTools } from './browser-tools.mjs';
export type { BrowserToolsOptions } from './browser-tools.mjs';
export { makeCodifyTools } from './codify-tools.mjs';
export type { CodifyToolsOptions } from './codify-tools.mjs';
export type { ToolDescriptor, ToolDef, ToolResult } from './tool.mjs';

// Evidence collection.
export { newSink, attachCollectors, renderArtifact } from './evidence.mjs';
export type { Sink, Finding } from './evidence.mjs';

// Action surfaces: the @playwright/cli over CDP (web/openfin) and the in-process driver
// for Electron (no CDP endpoint) — both expose the same PwCli shape (ADR 0005).
export { makePwCli, attachCli } from './pwcli.mjs';
export type { PwCli, BrowserCtx, CliResult } from './pwcli.mjs';
export { attachInProcess } from './inproc-driver.mjs';
export { resolveCopilotCli } from './copilot-path.mjs';
