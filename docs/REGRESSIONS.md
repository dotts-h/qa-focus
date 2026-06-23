# REGRESSIONS.md — qa-focus fixed bugs & their guards

> **Every fixed bug gets a guard test and a row here.** A fix with no guard is a
> bug on a timer. Each row names the symptom, the root cause in one line, and the
> exact test that now fails if it comes back. Dead-ends ("we tried X, it can't
> work because Y") are recorded too — they save the next session from re-walking
> the same path.

## Fixed bugs

| # | symptom | root cause | guard test |
|---|---------|------------|------------|
| 1 | Electron surface: `_electron.launch({args:[main.js]})` succeeds but `firstWindow()` hangs forever (main process prints "Waiting for the debugger to disconnect…", 0 windows) | Electron was pointed at a **bare `main.js` path**, which it does not treat as the app entry — the app never runs. Electron needs the **app directory** (with `package.json` `"main"`). | `tests/live-electron.spec.ts` (launches `fixtures/electron/` the directory; `fixtures/electron/package.json` provides `main`) |
| 2 | Flaky iframe gate test under overlapping runs (EADDRINUSE on a fixed fixture port) | `tests/ladder-complex.spec.ts` hard-coded port 3055; concurrent runs collided | same spec now binds `CX_PORT=0` (ephemeral) and reads the bound port from the server's stdout (also the readiness signal) |

## Dead-ends (tried and rejected)

| what we tried | why it can't work |
|---------------|-------------------|
| *(none yet)* | — |
