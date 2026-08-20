/**
 * crossRuntimeDisplayParity — Quick task 260819-qo8, Task 1.
 *
 * The `rozieDisplay` function body is duplicated across FIVE runtime packages
 * (react, solid, svelte, lit, angular) rather than living in one shared
 * dependency-free module. That duplication is PRE-EXISTING (react/solid/
 * svelte/lit were already four separate byte-identical copies before this
 * quick task added the fifth, angular, copy) and is NOT deduplicated here —
 * deduplicating it is out of scope for this task (see the plan's OUT-OF-SCOPE
 * note). This test DETECTS the five copies drifting apart; it does not
 * prevent the duplication from existing in the first place.
 *
 * It lives in `packages/targets/angular` (the Angular emitter package, which
 * has vitest wired) rather than `packages/runtime/angular` (which has no
 * vitest devDependency — adding one is out of scope) because the Angular
 * emitter is the consumer whose inlined copy this quick task replaced.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RUNTIME_PACKAGES = ['react', 'solid', 'svelte', 'lit', 'angular'] as const;

// `packages/targets/angular/src/__tests__/` → `packages/`, then into
// `runtime/<pkg>/src/rozieDisplay.ts`. Built via `path.resolve` off this
// test file's own on-disk path (not a relative `new URL(...)`) because
// Vitest/Vite can rewrite `import.meta.url` for transformed modules with an
// internal `/@fs/` module-graph prefix that `fileURLToPath` does not resolve
// back to a real filesystem path when composed via relative URL segments.
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = resolve(TEST_DIR, '../../../..');

function rozieDisplayPath(pkg: (typeof RUNTIME_PACKAGES)[number]): string {
  return resolve(PACKAGES_DIR, `runtime/${pkg}/src/rozieDisplay.ts`);
}

/**
 * Slice the file from the line starting `export function rozieDisplay`
 * through the next line that is EXACTLY `}` (the function's closing brace).
 * Doc comments and imports above the function are intentionally excluded —
 * only the function body must agree byte-for-byte across all five packages.
 */
function extractRozieDisplayBody(source: string): string {
  const lines = source.split('\n');
  const startIdx = lines.findIndex((line) => line.startsWith('export function rozieDisplay'));
  if (startIdx === -1) {
    throw new Error('Could not find `export function rozieDisplay` in source');
  }
  let endIdx = -1;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i] === '}') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    throw new Error('Could not find the closing `}` for rozieDisplay');
  }
  return lines.slice(startIdx, endIdx + 1).join('\n');
}

describe('crossRuntimeDisplayParity', () => {
  it('rozieDisplay function body is byte-identical across all five runtime packages', () => {
    const bodies = RUNTIME_PACKAGES.map((pkg) => ({
      pkg,
      body: extractRozieDisplayBody(readFileSync(rozieDisplayPath(pkg), 'utf8')),
    }));

    const [reference, ...rest] = bodies;
    for (const candidate of rest) {
      expect(candidate.body, `${candidate.pkg}/rozieDisplay.ts diverged from ${reference.pkg}/rozieDisplay.ts`).toBe(
        reference.body,
      );
    }
  });
});
