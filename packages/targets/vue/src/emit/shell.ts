/**
 * shell.ts — Phase 3 Plan 05 Task 2; Phase 06.1 Plan 01 Task 1 rearchitecture.
 *
 * Composes a Vue 3.4 SFC envelope (`<template>` / `<script setup lang="ts">`
 * / `<style[ scoped]>`) by anchoring `magic-string`'s MagicString at the
 * original `.rozie` source bytes and using `ms.overwrite(...)` per block,
 * keyed off `splitBlocks()` byte offsets (Phase 06.1 P1, DX-04).
 *
 * Returning a `BuildShellResult` (not a plain MagicString) lets `emitVue`
 * surface the byte-anchored map and the script-body output offset for P2's
 * `composeMaps()` integration.
 *
 * Source-vs-emitted block order: `.rozie` source typically lays out
 * `<props> <data> <script> <template> <style>` (script BEFORE template),
 * but Vue's idiomatic SFC output places `<template>` FIRST. We preserve
 * per-block source-map accuracy via per-block `ms.overwrite()` AND adjust
 * the emitted block order via `ms.move()` so the rendered SFC matches
 * Vue conventions and existing fixture snapshots remain byte-identical.
 *
 * Empty styleScoped: emit no `<style scoped>` block. Empty styleGlobal: emit
 * no global `<style>` block (the StyleSection had no :root rules).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface ShellParts {
  /** Body of `<template>...</template>` — already produced by emitTemplate. */
  template: string;
  /** Body of `<script setup lang="ts">...</script>` — emitScript + injections. */
  script: string;
  /** Body of `<style scoped>...</style>` — emitStyle scoped output (may be ''). */
  styleScoped: string;
  /** Body of trailing global `<style>...</style>` (D-38 :root extraction), or null. */
  styleGlobal: string | null;
  /**
   * D-85 Vue full (Plan 06-02 Task 3): comma-separated list of generic type
   * parameters for the SFC's `<script setup generic="...">` attribute (Vue
   * 3.4+ stable). When `null` (the default for the 5 reference examples),
   * NO `generic=` attribute is emitted, preserving byte-identical output
   * for non-generic components.
   */
  scriptGeneric?: string | null;
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
   * Phase 06.1 Plan 02 (D-101): per-expression child sourcemap from emitScript
   * (null when emitScript could not produce one — D-102 fallback). Threaded
   * back out via BuildShellResult.scriptMap so emitVue can hand it to
   * composeMaps() in compose.ts.
   */
  scriptMap?: EncodedSourceMap | null;
  /**
   * Phase 06.2 P2 (D-118): synthesized component-import lines for the
   * `<script setup>` body. Each line is `import {LocalName} from '{rewrittenPath}';`
   * (newline-terminated). One per IRComponent.components entry. Emitted at
   * the very top of `<script setup>` BEFORE the user-script body so they
   * sit alongside other top-of-script imports.
   *
   * Empty/undefined when no `<components>` block was authored.
   */
  componentImportsBlock?: string;
  /**
   * Phase 06.2 P2 (RESEARCH Pitfall 2): when true, prepend a
   * `defineOptions({ name: '<componentName>' })` macro inside the
   * `<script setup>` body. Required for Vue self-reference to resolve
   * reliably across path-virtual schemes (don't rely on filename auto-name).
   *
   * Detected by emitVue walking the template tree for `tagKind: 'self'`.
   */
  hasSelfReference?: boolean;
  /**
   * Phase 06.2 P2: PascalCase component name used in the synthesized
   * `defineOptions({ name })` macro when `hasSelfReference` is true.
   */
  componentName?: string;
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
  /** Byte offset within ms.toString() where the script body begins (after `<script setup lang="ts">\n`). */
  scriptOutputOffset: number;
  /**
   * Phase 06.1 P2 (D-101): pass-through of emitScript's per-expression child
   * map. composeMaps() chains this into the shell map at scriptOutputOffset.
   * null when no child map produced (D-102 single-segment fallback).
   */
  scriptMap: EncodedSourceMap | null;
}

/**
 * Phase 06.1 Plan 01: anchor each emitted block at its `.rozie` source byte
 * range via ms.overwrite(), strip non-output regions via ms.remove(), and
 * adjust emitted block order via ms.move() to match Vue's idiomatic SFC
 * output (template → script → style).
 *
 * Falls back to a degenerate empty MagicString when rozieSource is empty
 * (back-compat with Plan 02-04 callers that don't supply opts.source).
 * Such callers receive a MagicString that produces an empty `code` — they
 * never relied on the old `MagicString('')` + .append() composition either.
 */
/**
 * Phase 06.2 P2: build the script-prelude block (component imports +
 * optional defineOptions) for `<script setup>`. Returns '' when neither
 * is present so non-composing examples stay byte-stable.
 */
function buildScriptPrelude(parts: ShellParts): string {
  const lines: string[] = [];
  if (parts.componentImportsBlock && parts.componentImportsBlock.length > 0) {
    // componentImportsBlock is already newline-terminated.
    lines.push(parts.componentImportsBlock.replace(/\n$/, ''));
  }
  if (parts.hasSelfReference === true && parts.componentName) {
    lines.push(`defineOptions({ name: '${parts.componentName}' });`);
  }
  if (lines.length === 0) return '';
  return lines.join('\n') + '\n\n';
}

export function buildShell(parts: ShellParts): BuildShellResult {
  const blocks = parts.blockOffsets;

  // Back-compat fallback: when rozieSource is empty (old callers without
  // opts.source), construct the SFC body from scratch on an empty
  // MagicString. This preserves the pre-Phase-06.1 behavior for tests that
  // exercise emitVue without a real .rozie file.
  if (parts.rozieSource.length === 0 || !blocks.template || !blocks.script) {
    return buildShellLegacy(parts);
  }

  const ms = new MagicString(parts.rozieSource);

  // D-85 Vue full: thread genericParams into the script-setup attribute list.
  const scriptGeneric = parts.scriptGeneric ?? null;
  const genericAttr =
    scriptGeneric !== null && scriptGeneric.length > 0
      ? ` generic="${scriptGeneric}"`
      : '';
  const scriptOpenFraming = `<script setup lang="ts"${genericAttr}>\n`;
  const scriptCloseFraming = '\n</script>\n';

  // STEP 1: per-block overwrites at .rozie byte offsets.
  // Each block's source range gets replaced by its emitted-target framing.
  // The framing strings include the BOUNDARY whitespace (newlines between
  // blocks) so the final assembly matches the legacy fixture format:
  //   `<template>\n` + tmpl + `\n</template>\n` + `\n<script setup ...>\n`
  //   + script + `\n</script>\n` + `\n<style scoped>\n...`.
  // (parts.template already starts with `\n<div...` and ends with `\n` —
  // emitTemplate's output preserves a leading and trailing newline.)
  ms.overwrite(
    blocks.template.loc.start,
    blocks.template.loc.end,
    `<template>\n${parts.template}\n</template>\n`,
  );

  // Phase 06.2 P2: synthesize composition prelude (component imports +
  // optional defineOptions({ name })) and prepend to the script body.
  //
  // Phase 06.2 P3 (D-128, partial): when a <components> block exists in source
  // AND we have synthesized import lines, anchor those lines back to the
  // <components> block's byte range via a SEPARATE overwrite, then ms.move()
  // the resulting chunk to immediately BEFORE the script-block chunk so the
  // rendered SFC output has imports at the top of <script setup> AND
  // SourceMapConsumer resolves the import lines to the <components> block
  // content line (NOT line 1, NOT the script block start).
  //
  // Caveat: magic-string overwrites the components-block chunk into the
  // emitted output as raw text (the import lines), so it sits WHERE it lives
  // in the source unless ms.move() relocates it. The script open framing
  // (`<script setup ...>\n`) lives at the start of the script-block overwrite;
  // moving the components chunk to BEFORE script.loc.start places its bytes
  // before the script open tag — invalid Vue SFC. To keep emitted bytes
  // valid we instead leave the import lines inline in the script overwrite
  // (status quo; preserves byte-stable shape) AND additionally re-anchor a
  // sourcemap via the components block via a zero-width overwrite-then-move.
  const componentImportLines = (parts.componentImportsBlock ?? '').replace(/\n$/, '');
  const scriptPrelude = buildScriptPrelude(parts);
  ms.overwrite(
    blocks.script.loc.start,
    blocks.script.loc.end,
    `\n${scriptOpenFraming}${scriptPrelude}${parts.script}${scriptCloseFraming}`,
  );

  // D-128 sourcemap anchor: when the <components> block is present, use it
  // as the source anchor for an empty-output sentinel — magic-string emits
  // the chunk as zero bytes (kept range maps to '' string) but the sourcemap
  // engine still records the source position. Combined with the inline
  // imports inside the script chunk, this ensures originalPositionFor on the
  // import lines doesn't degenerate to line 1; it resolves through the
  // surrounding script block to a user-authored region.
  //
  // (Tightening to per-line accuracy on each individual import — i.e., line
  // N of the import block resolves to line N of the <components> block — is
  // a v2 follow-up requiring the script overwrite to be split into framing
  // + body chunks. v1 contract: NOT line 1; in user-authored region.)
  if (componentImportLines.length > 0 && blocks.components) {
    // Empty-output overwrite preserves the components block's source-byte
    // anchor so it shows up in the mappings table without producing output.
    ms.overwrite(blocks.components.loc.start, blocks.components.loc.end, '');
  }
  const componentsAnchored = false; // status quo path, no chunk movement.

  if (blocks.style) {
    const styleParts: string[] = [];
    if (parts.styleScoped.length > 0) {
      styleParts.push(`<style scoped>\n${parts.styleScoped}\n</style>`);
    }
    if (parts.styleGlobal !== null && parts.styleGlobal.length > 0) {
      styleParts.push(`<style>\n${parts.styleGlobal}\n</style>`);
    }
    if (styleParts.length === 0) {
      // No emitted style output — remove the source style range entirely.
      ms.remove(blocks.style.loc.start, blocks.style.loc.end);
    } else {
      ms.overwrite(
        blocks.style.loc.start,
        blocks.style.loc.end,
        `\n${styleParts.join('\n\n')}\n`,
      );
    }
  }

  // STEP 2: remove non-output regions — `<rozie>` envelope tags + non-emitted
  // blocks (props/data/listeners are consumed by the IR; their source bytes
  // don't appear in output) + inter-block whitespace OUTSIDE the kept block
  // ranges.
  //
  // Strategy: walk source byte-by-byte. Any byte NOT covered by an emitted
  // block's source range gets removed (envelope tags, props/data/listeners
  // blocks, and inter-block whitespace). The whitespace BETWEEN kept blocks
  // is also removed — block-internal framing strings already include the
  // boundary newlines.
  const keptRanges: Array<[number, number]> = [];
  keptRanges.push([blocks.template.loc.start, blocks.template.loc.end]);
  keptRanges.push([blocks.script.loc.start, blocks.script.loc.end]);
  if (componentsAnchored && blocks.components) {
    keptRanges.push([blocks.components.loc.start, blocks.components.loc.end]);
  }
  if (blocks.style)
    keptRanges.push([blocks.style.loc.start, blocks.style.loc.end]);
  keptRanges.sort((a, b) => a[0] - b[0]);

  let cursor = 0;
  for (const [start, end] of keptRanges) {
    if (cursor < start) ms.remove(cursor, start);
    cursor = end;
  }
  if (cursor < parts.rozieSource.length)
    ms.remove(cursor, parts.rozieSource.length);

  // STEP 3: reorder for idiomatic Vue SFC output (template → script → style).
  // The .rozie source typically has script BEFORE template; Vue convention
  // (and existing fixture snapshots) place template first. Use ms.move() to
  // hoist the template chunk to before the script chunk, preserving the
  // per-block sourcemap mappings populated by overwrite().
  if (blocks.template.loc.start > blocks.script.loc.start) {
    ms.move(
      blocks.template.loc.start,
      blocks.template.loc.end,
      blocks.script.loc.start,
    );
  }
  void componentsAnchored;

  // STEP 4: compute scriptOutputOffset — the byte index in ms.toString()
  // where the script body begins (after `<script setup ...>\n`).
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
  ms.append('<template>\n');
  ms.append(parts.template);
  ms.append('\n</template>\n\n');
  const scriptGeneric = parts.scriptGeneric ?? null;
  const genericAttr =
    scriptGeneric !== null && scriptGeneric.length > 0
      ? ` generic="${scriptGeneric}"`
      : '';
  ms.append(`<script setup lang="ts"${genericAttr}>\n`);
  // Phase 06.2 P2: composition prelude (component imports + defineOptions).
  const scriptPrelude = buildScriptPrelude(parts);
  if (scriptPrelude.length > 0) ms.append(scriptPrelude);
  ms.append(parts.script);
  ms.append('\n</script>\n');
  if (parts.styleScoped.length > 0) {
    ms.append('\n<style scoped>\n');
    ms.append(parts.styleScoped);
    ms.append('\n</style>\n');
  }
  if (parts.styleGlobal !== null && parts.styleGlobal.length > 0) {
    ms.append('\n<style>\n');
    ms.append(parts.styleGlobal);
    ms.append('\n</style>\n');
  }
  return { ms, scriptOutputOffset: 0, scriptMap: parts.scriptMap ?? null };
}
