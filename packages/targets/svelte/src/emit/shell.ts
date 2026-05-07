/**
 * shell.ts — Phase 5 Plan 02a Task 3; Phase 06.1 Plan 01 Task 3
 * rearchitecture.
 *
 * Composes a Svelte 5 SFC envelope by anchoring `magic-string`'s
 * MagicString at the original `.rozie` source bytes and using
 * `ms.overwrite(...)` per block, keyed off `splitBlocks()` byte offsets
 * (Phase 06.1 P1, DX-04).
 *
 * Block order: <script lang="ts">...</script> first, top-level markup second
 * (NO `<template>` wrapper — Svelte's "top-level markup" is the bare content
 * between </script> and <style>), then a single <style> block. The .rozie
 * source has `<script>` BEFORE `<template>` (matching Svelte's emitted
 * order), so no `ms.move()` reordering is required.
 *
 * Empty styleBlock: emit no `<style>` block — remove the source style range.
 *
 * Returning a `BuildShellResult` (not a plain MagicString) lets `emitSvelte`
 * surface the byte-anchored map and the script-body output offset for P2's
 * `composeMaps()` integration.
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface ShellParts {
  /** Body of `<script lang="ts">...</script>` — emitScript output + injections. */
  script: string;
  /** Top-level markup (between </script> and <style>) — emitTemplate output. */
  template: string;
  /** Body of the single `<style>...</style>` block — empty string skips block. */
  styleBlock: string;
  /**
   * Phase 06.1 Plan 01: original `.rozie` source text — anchors the MagicString.
   */
  rozieSource: string;
  /**
   * Phase 06.1 Plan 01: block byte offsets from splitBlocks() — keys
   * ms.overwrite() calls so emitted output maps back to .rozie block lines
   * rather than collapsing to line 1 col 0.
   */
  blockOffsets: BlockMap;
  /**
   * Phase 06.1 P2 (D-101): per-expression child sourcemap from emitScript;
   * pass-through to BuildShellResult for composeMaps() consumption.
   */
  scriptMap?: EncodedSourceMap | null;
  /**
   * Phase 06.2 P2 (D-118 + updated D-117 self-import idiom): synthesized
   * component-import lines for the `<script>` block. One line per
   * IRComponent.components entry PLUS an additional line for the self-ref
   * file when `tagKind: 'self'` appears in template AND the outer component
   * name isn't already in the components table.
   *
   * Each line is `import {LocalName} from '{rewrittenPath}';\n`
   * (newline-terminated; the helper joins them with `\n` and adds a final `\n`).
   *
   * Per CONTEXT.md D-117 (UPDATED 2026-05-07): wrapper composition AND
   * self-reference share one code path — both emit a top-of-script import
   * binding. NO `<svelte:self>` rewrite anywhere.
   *
   * Empty/undefined when neither path applies.
   */
  componentImportsBlock?: string;
}

/**
 * Phase 06.1 Plan 01 D-101: buildShell return shape carries both the
 * byte-anchored MagicString AND the script-body offset within the rendered
 * shell so P2's composeMaps() can chain @babel/generator's per-expression
 * child map at the correct output position.
 */
export interface BuildShellResult {
  /** MagicString anchored to rozieSource with per-block overwrites + envelope removed. */
  ms: MagicString;
  /** Byte offset within ms.toString() where the script body begins (after `<script lang="ts">\n`). */
  scriptOutputOffset: number;
  /**
   * Phase 06.1 P2 (D-101): pass-through of emitScript's per-expression child
   * map. composeMaps() chains this into the shell map at scriptOutputOffset.
   * null when no child map produced (D-102 fallback).
   */
  scriptMap: EncodedSourceMap | null;
}

export function buildShell(parts: ShellParts): BuildShellResult {
  const blocks = parts.blockOffsets;

  // Back-compat fallback: when rozieSource is empty (old callers without
  // opts.source), construct the SFC body on an empty MagicString.
  if (parts.rozieSource.length === 0 || !blocks.script || !blocks.template) {
    return buildShellLegacy(parts);
  }

  const ms = new MagicString(parts.rozieSource);

  const scriptOpenFraming = '<script lang="ts">\n';
  const scriptCloseFraming = '\n</script>\n';

  // STEP 1: per-block overwrites at .rozie byte offsets.
  // Source layout for the 5 reference Svelte examples: <props> <data?>
  // <script> <listeners?> <template> <style?>. The Svelte target output
  // order matches: <script> first, bare markup second, <style> third —
  // so per-block source-byte anchoring is direct (no ms.move() reorder).
  // Phase 06.2 P2 (D-117/D-118): prepend component-import lines to the
  // script body. componentImportsBlock is already newline-terminated; we
  // insert a trailing blank line so the imports are visually separated
  // from the user-script body.
  const compImports = parts.componentImportsBlock ?? '';
  const scriptPrelude = compImports.length > 0 ? compImports + '\n' : '';
  ms.overwrite(
    blocks.script.loc.start,
    blocks.script.loc.end,
    `${scriptOpenFraming}${scriptPrelude}${parts.script}${scriptCloseFraming}`,
  );

  // Svelte's top-level markup has no `<template>` wrapper — overwrite the
  // .rozie <template>...</template> range with the bare markup.
  ms.overwrite(
    blocks.template.loc.start,
    blocks.template.loc.end,
    `\n${parts.template}\n`,
  );

  if (blocks.style) {
    if (parts.styleBlock.length > 0) {
      ms.overwrite(
        blocks.style.loc.start,
        blocks.style.loc.end,
        `\n<style>\n${parts.styleBlock}\n</style>\n`,
      );
    } else {
      // Empty styleBlock — remove the source range entirely.
      ms.remove(blocks.style.loc.start, blocks.style.loc.end);
    }
  }

  // STEP 2: remove non-output regions — `<rozie>` envelope tags + non-emitted
  // blocks (props/data/listeners are consumed by the IR; their source bytes
  // don't appear in output) + inter-block whitespace OUTSIDE kept ranges.
  const keptRanges: Array<[number, number]> = [];
  keptRanges.push([blocks.script.loc.start, blocks.script.loc.end]);
  keptRanges.push([blocks.template.loc.start, blocks.template.loc.end]);
  if (blocks.style && parts.styleBlock.length > 0) {
    keptRanges.push([blocks.style.loc.start, blocks.style.loc.end]);
  }
  keptRanges.sort((a, b) => a[0] - b[0]);

  let cursor = 0;
  for (const [start, end] of keptRanges) {
    if (cursor < start) ms.remove(cursor, start);
    cursor = end;
  }
  if (cursor < parts.rozieSource.length)
    ms.remove(cursor, parts.rozieSource.length);

  // STEP 3: compute scriptOutputOffset.
  const fullOutput = ms.toString();
  const scriptIdx = fullOutput.indexOf(scriptOpenFraming);
  const scriptOutputOffset =
    scriptIdx >= 0 ? scriptIdx + scriptOpenFraming.length : 0;

  return { ms, scriptOutputOffset, scriptMap: parts.scriptMap ?? null };
}

/**
 * Legacy fallback path — empty rozieSource or missing blockOffsets.
 * Constructs the SFC envelope from scratch on an empty MagicString,
 * preserving pre-Phase-06.1 behavior so old callers (tests that don't
 * thread opts.source through) keep working.
 */
function buildShellLegacy(parts: ShellParts): BuildShellResult {
  const ms = new MagicString('');
  ms.append('<script lang="ts">\n');
  // Phase 06.2 P2 (D-117/D-118): component-import lines go top-of-script.
  const compImports = parts.componentImportsBlock ?? '';
  if (compImports.length > 0) {
    ms.append(compImports);
    ms.append('\n');
  }
  ms.append(parts.script);
  ms.append('\n</script>\n\n');
  ms.append(parts.template);
  ms.append('\n');
  if (parts.styleBlock.length > 0) {
    ms.append('\n<style>\n');
    ms.append(parts.styleBlock);
    ms.append('\n</style>\n');
  }
  return { ms, scriptOutputOffset: 0, scriptMap: parts.scriptMap ?? null };
}
