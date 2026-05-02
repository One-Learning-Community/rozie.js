#!/usr/bin/env node
// @rozie/cli — bin entry. Thin shebang wrapper that delegates to runCli().
// Kept tiny so the dist artefact stays grep-friendly and so commander's
// own error handling (process.exit on parse failure) is the only exit path.
import { runCli } from './index.js';

runCli(process.argv).catch((err) => {
  // Defensive: runCli already prints user-facing diagnostics + exits with the
  // right code. This catch only fires for genuinely unexpected errors (bugs
  // in the CLI itself). Print stack to stderr and exit 1 so CI signals red.
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
