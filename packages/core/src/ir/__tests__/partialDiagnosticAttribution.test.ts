/**
 * Quick task 260703-vk4 — Task 3: fixture proving partial-origin diagnostic
 * attribution (filename + code-frame source text) end-to-end through
 * `compile()`.
 *
 * ROZ137 CAVEAT (see 260703-vk4-PLAN.md): `exposeReservedMemberValidator`
 * anchors on the HOST `$expose({ name })` prop (never spliced), so it cannot
 * demonstrate partial attribution. This suite uses a BODY-ANCHORED case
 * instead: a `.rzts` partial exports `doubled = $computed(() => $data.count)`
 * where the host `<data>` block declares no `count` — `unknownRefValidator`
 * (ROZ101 UNKNOWN_DATA_REF) fires on the `$data.count` MemberExpression node,
 * which lives entirely inside the spliced partial body.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../compile.js';
import { createSourceResolver } from '../../diagnostics/sourceResolver.js';
import { offsetToLineCol } from '../../diagnostics/offsetToLineCol.js';

function makeTmpDir(label: string): { dir: string; cleanup: () => void } {
  // realpathSync: on macOS, `tmpdir()` (/tmp/...) is a symlink into
  // /private/tmp/... — the resolver/fs layer we go through resolves symlinks,
  // so the diagnostic's `filename` comes back fully-resolved. Resolve here too
  // so path equality assertions aren't sensitive to that OS quirk.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `rozie-vk4-${label}-`)));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('partial-origin diagnostic attribution (260703-vk4)', () => {
  it('attributes an unknown-$data-ref diagnostic anchored in a spliced .rzts partial to the PARTIAL, not the host', () => {
    const { dir, cleanup } = makeTmpDir('unknown-data-ref');
    try {
      const partialText = [
        `export const doubled = $computed(() => $data.count);`,
        '',
      ].join('\n');
      const partialPath = join(dir, 'logic.rzts');
      writeFileSync(partialPath, partialText, 'utf8');

      const hostSource = `<rozie name="Host">

<data>
{
}
</data>

<script>
import { doubled } from './logic.rzts';
</script>

<template>
<div>{{ doubled }}</div>
</template>

</rozie>`;
      const hostPath = join(dir, 'Host.rozie');
      writeFileSync(hostPath, hostSource, 'utf8');

      const result = compile(hostSource, {
        target: 'vue',
        filename: hostPath,
        resolverRoot: dir,
      });

      const roz101 = result.diagnostics.find((d) => d.code === 'ROZ101');
      expect(roz101).toBeDefined();

      // Assertion 1 — filename attributes to the PARTIAL, not the host.
      expect(roz101!.filename).toBe(partialPath);
      expect(roz101!.filename).not.toBe(hostPath);

      // Assertion 2 — rendering against a resolver built from the host
      // produces a code frame sliced from the PARTIAL's own text, at a
      // correct line/column (not a nonsense position against the host source).
      const resolveSource = createSourceResolver(hostPath, hostSource);
      const resolvedText = resolveSource(roz101!.filename);
      expect(resolvedText).toBe(partialText);

      const lc = offsetToLineCol(partialText, roz101!.loc.start);
      expect(partialText.split('\n')[lc.line - 1]).toContain('$data.count');
    } finally {
      cleanup();
    }
  });

  it('sanity: a HOST-origin diagnostic in a sibling fixture still attributes to the host (no over-attribution)', () => {
    const { dir, cleanup } = makeTmpDir('host-origin-control');
    try {
      // No partial involved — an unknown $data ref written directly in the
      // host <script> must still attribute to the host file.
      const hostSource = `<rozie name="HostOnly">

<data>
{
}
</data>

<script>
const doubled = $computed(() => $data.count);
</script>

<template>
<div>{{ doubled }}</div>
</template>

</rozie>`;
      const hostPath = join(dir, 'HostOnly.rozie');
      writeFileSync(hostPath, hostSource, 'utf8');

      const result = compile(hostSource, {
        target: 'vue',
        filename: hostPath,
        resolverRoot: dir,
      });

      const roz101 = result.diagnostics.find((d) => d.code === 'ROZ101');
      expect(roz101).toBeDefined();
      expect(roz101!.filename).toBe(hostPath);
    } finally {
      cleanup();
    }
  });
});
