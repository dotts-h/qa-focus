# qa-focus — agentic QA in GitHub Copilot Chat (VS Code)

An `@qa-focus` **chat participant** for GitHub Copilot Chat. It is a first-class participant that
**owns its loop** — *not* a Language Model Tool and *not* an MCP server (the control-inverted postures
the project rejects, [ADR 0001](../docs/adr/0001-no-mcp-use-playwright-cli.md) /
[ADR 0003](../docs/adr/0003-distribution-native-adapters-no-mcp.md) /
[ADR 0007](../docs/adr/0007-vscode-surface-chat-participant.md)). On a request it drives the
git-installed [qa-focus CLI](../README.md) (explore / codify — the gate, leash, and model live there)
and streams the run into the chat.

## Use

Install the CLI first (no npm registry — [ADR 0006](../docs/adr/0006-no-npm-publish-distribute-from-github.md)):

```bash
npm i -g github:dotts-h/qa-focus
npx playwright install chromium
```

Then in Copilot Chat:

```
@qa-focus https://your.app add a task and verify it appears
@qa-focus explore https://your.app <goal>
@qa-focus codify  https://your.app <goal>
@qa-focus help
```

## Build / run from source

```bash
cd vscode && npm install && npm run build   # → out/extension.js
```

Open the `vscode/` folder in VS Code and press **F5** (Extension Development Host) to load the
participant, or package it with `vsce package` and install the `.vsix`.

The model is the qa-focus `copilot` login (no BYOK). Driving the model via VS Code's native
`vscode.lm` instead of the embedded CLI is a documented future option (ADR 0007). The pure request
parser (`src/request.ts`) is unit-tested in the repo's root suite (`tests/vscode-participant.spec.ts`).
