// vendor-drift.test.ts — the D-04 cross-family-vendoring drift guard.
//
// data-table's header menu (Phase 72) composes the shipped @rozie-ui/popover
// primitive by VENDORING its `.rozie` source at codegen time (Option B; the
// command-palette→combobox precedent, Phase 999.4): the canonical
// `packages/ui/popover/src/Popover.rozie` (+ `src/internal/middleware.ts`) is
// copied (with a generated banner) into `packages/ui/data-table/src/Popover.rozie`,
// which is committed-generated and recompiled as a sibling into every leaf. That
// makes the vendored copy the machine half of "fix Popover once → re-vendor
// everywhere": a forgotten re-codegen OR a hand-edit drifts the committed copy
// and would silently ship stale behaviour — the EXACT bug class fixed by the
// comparison-page surface-hash guard (2026-06-25, quick 260625-n4i).
//
// This guard hashes ONLY the `<rozie>…</rozie>` ENVELOPE SPAN of each file —
// NOT the whole file — so the generated banner the vendored copy carries (and
// the canonical lacks) does NOT cause a false failure (Pitfall 3, banner-vs-
// bytes). It hashes RAW ENVELOPE BYTES (createHash('sha256')), NOT an IR-surface
// extraction: a surface-only hash would miss behaviour / `<style>` / comment
// drift that "fix once" must still catch (RESEARCH §Anti-Patterns). It reuses
// the surface-hash.mjs SHAPE (createHash + a vitest gate), not its IR logic —
// mirroring command-palette's vendor-drift.test.ts verbatim.
//
// Authored RED-FIRST per project emitter discipline (snapshot tests cement
// bugs): the guard was proven to FAIL on the vendored copy's absence BEFORE
// the clean vendor (Task 2) made it pass.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));

// Canonical primitive source stays in-place in its own family (D-01 precedent);
// the vendored copy lives next to DataTable.rozie in this package's src/.
const CANONICAL = resolve(HERE, '..', '..', 'popover', 'src', 'Popover.rozie');
const VENDORED = resolve(HERE, '..', 'src', 'Popover.rozie');

// Match the `<rozie>…</rozie>` envelope span only — greedy to the LAST closing
// tag so the full body (script/template/style) is hashed, while any banner or
// comment OUTSIDE the envelope (e.g. the generated "do not edit" banner the
// vendored copy carries) is excluded by construction.
const ENVELOPE = /<rozie[\s\S]*<\/rozie>/;

/** sha256 of the `<rozie>…</rozie>` envelope bytes of a `.rozie` file. */
const hash = (p: string): string =>
  createHash('sha256').update(ENVELOPE.exec(readFileSync(p, 'utf8'))![0]).digest('hex');

describe('vendored Popover drift guard (D-04)', () => {
  it('vendored data-table/src/Popover.rozie envelope matches canonical @rozie-ui/popover', () => {
    expect(
      hash(VENDORED),
      'vendored Popover drifted from @rozie-ui/popover — the committed ' +
        'packages/ui/data-table/src/Popover.rozie envelope no longer matches the ' +
        'canonical packages/ui/popover/src/Popover.rozie. Do NOT hand-edit the vendored ' +
        'copy (it is GENERATED): edit the canonical popover source, then re-vendor with ' +
        '`pnpm --filter @rozie-ui/data-table build` and commit the regenerated copy.',
    ).toBe(hash(CANONICAL));
  });
});
