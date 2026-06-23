// models.mts — list the Copilot models available to the installed login (#0017).
//
// `qa-focus models` (or `qa-focus --list-models`) prints the model ids you can pass to `--model`.
// It opens a short-lived client to the installed `copilot` CLI, lists models, prints, and exits —
// no browser, no run. The id is what `--model` (→ COPILOT_MODEL) takes; omit it for the default.
import { resolveCopilotCli } from '../src/copilot-path.mjs';
import { listCopilotModels, formatModelList } from '../src/models.mjs';

async function main(): Promise<void> {
  const models = await listCopilotModels(resolveCopilotCli());
  console.log(formatModelList(models));
}

main().catch((e) => { console.error('[models] FAILED:', e?.message || e); process.exit(1); });
