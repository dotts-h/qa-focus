// Discovery shim. The Copilot CLI discovers extensions by scanning .github/extensions/
// for SUBDIRECTORIES containing extension.mjs — and it skips symlinks (the dirent
// isDirectory() check is false for them). So this is a real directory with a one-line
// re-import of the canonical extension, which lives at extension/qa-focus/ so it can
// share ladder.mjs and resolve the project's src/ + node_modules.
import '../../../extension/qa-focus/extension.mjs';
