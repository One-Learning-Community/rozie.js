/**
 * STRICT FALLBACK splitter — INACTIVE BY DEFAULT (per D-04 / D-05).
 *
 * This file is committed as a one-line-import-swap escape hatch in case the
 * htmlparser2-based primary path (`splitBlocks.ts`) encounters non-trivial
 * difficulty during the 3-day spike (any of the 5 reference files cannot
 * split cleanly, htmlparser2 emits unrecoverable token errors on Rozie
 * syntax, source locations require manual offset reconciliation).
 *
 * As of Plan 01-02 the primary path is operational against all 5 reference
 * examples — the fallback was NOT triggered.
 *
 * Activation procedure (D-04):
 *   1. In `packages/core/src/parse.ts` (Plan 04), change the import from
 *        import { splitBlocks } from './splitter/splitBlocks.js';
 *      to
 *        import { splitBlocksFallback as splitBlocks } from './splitter/splitBlocks.fallback.js';
 *   2. Document the deviation in `.planning/PROJECT.md` Key Decisions table
 *      with a date stamp and the failure mode that triggered it.
 *   3. Add a corresponding `splitter-fallback.test.ts` file mirroring
 *      `splitter.test.ts` and regenerate the snapshots — the fallback's
 *      output should be byte-equivalent for all 5 reference examples.
 *
 * Strategy: `@vue/compiler-sfc.parse()` handles top-level `<script>`,
 * `<template>`, `<style>` directly. Our first-class blocks (`<props>`,
 * `<data>`, `<listeners>`) land in `descriptor.customBlocks: SFCBlock[]`.
 * We translate them into our `BlockMap` shape, preserving byte-accurate
 * offsets via `SFCBlock.loc.{start,end}.offset`. The `<rozie name="...">`
 * envelope is recovered with a small anchored regex over the source head
 * because Vue's parser doesn't have a notion of a custom-named root.
 *
 * @experimental — shape may change before v1.0
 */
import { parse as parseSFC } from '@vue/compiler-sfc';
import type { BlockEntry, BlockMap } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export type SplitBlocksResult = BlockMap & { diagnostics: Diagnostic[] };

/**
 * Strict fallback splitter. Identical signature to `splitBlocks` from
 * `splitBlocks.ts` so the activation is a single import edit per D-04/D-05.
 *
 * @experimental — shape may change before v1.0
 */
export function splitBlocksFallback(source: string, filename?: string): SplitBlocksResult {
  const result: SplitBlocksResult = { diagnostics: [] };

  // Vue's SFC parser. Pass filename for error messages; sourceMap off (we use
  // byte offsets directly via SFCBlock.loc).
  const parseOpts: { filename?: string; sourceMap?: boolean } = { sourceMap: false };
  if (filename !== undefined) parseOpts.filename = filename;
  const { descriptor, errors } = parseSFC(source, parseOpts);

  // Lift Vue's parse errors into Rozie diagnostics. We use ROZ001 as the
  // generic "structural problem" code at this fallback-layer; Plan 04's
  // central registry can refine this when activation actually happens.
  for (const err of errors) {
    result.diagnostics.push({
      code: RozieErrorCode.MISSING_ROZIE_ENVELOPE,
      severity: 'error',
      message: `[fallback parser] ${err.message ?? String(err)}`,
      loc: { start: 0, end: 0 },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  // Vue treats <script>, <template>, <style> as first-class.
  // Note: Vue exposes `script` and `scriptSetup` separately; Rozie has only
  // one <script> block, so prefer scriptSetup if present (rare in .rozie),
  // else descriptor.script.
  const scriptBlock = descriptor.scriptSetup ?? descriptor.script;
  if (scriptBlock) {
    const entry = sfcBlockToEntry(source, scriptBlock);
    if (entry) result.script = entry;
  }
  if (descriptor.template) {
    const entry = sfcBlockToEntry(source, descriptor.template);
    if (entry) result.template = entry;
  }
  // Rozie only allows one <style> block (always scoped); take the first.
  const styleBlock = descriptor.styles[0];
  if (styleBlock) {
    const entry = sfcBlockToEntry(source, styleBlock);
    if (entry) result.style = entry;
  }
  if (descriptor.styles.length > 1) {
    result.diagnostics.push({
      code: RozieErrorCode.DUPLICATE_BLOCK,
      severity: 'error',
      message: `Duplicate <style> block. Each .rozie file may contain at most one <style> block.`,
      loc: { start: 0, end: 0 },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  // Our first-class blocks (<props>, <data>, <listeners>, <components>) land in customBlocks.
  for (const cb of descriptor.customBlocks) {
    const tag = cb.type;
    if (tag === 'props' || tag === 'data' || tag === 'listeners' || tag === 'components') {
      if (result[tag] !== undefined) {
        result.diagnostics.push({
          code: RozieErrorCode.DUPLICATE_BLOCK,
          severity: 'error',
          message: `Duplicate <${tag}> block. Each .rozie file may contain at most one <${tag}> block.`,
          loc: { start: cb.loc.start.offset, end: cb.loc.end.offset },
          ...(filename !== undefined ? { filename } : {}),
        });
        continue;
      }
      const entry = sfcBlockToEntry(source, cb);
      if (entry) result[tag] = entry;
    } else {
      const isRefs = tag === 'refs';
      result.diagnostics.push({
        code: RozieErrorCode.UNKNOWN_TOP_LEVEL_BLOCK,
        severity: 'error',
        message: `Unknown top-level block: <${tag}>. Recognized blocks are: <props>, <data>, <script>, <listeners>, <template>, <style>, <components>.`,
        loc: { start: cb.loc.start.offset, end: cb.loc.end.offset },
        ...(isRefs
          ? { hint: 'Refs are derived from `ref="..."` attributes inside the <template> block — there is no <refs> block.' }
          : {}),
        ...(filename !== undefined ? { filename } : {}),
      });
    }
  }

  // Recover <rozie name="..."> envelope. Vue's SFC parser doesn't have the
  // notion of a named root tag, so we extract it via an anchored regex over
  // the source head. The regex is bounded (no nested quantifiers) — ReDoS-safe.
  const rozieMatch = source.match(/<rozie\b[^>]*\bname\s*=\s*["']([^"']+)["'][^>]*>/);
  if (rozieMatch && typeof rozieMatch.index === 'number') {
    const tagStart = rozieMatch.index;
    const tagOpenEnd = source.indexOf('>', tagStart) + 1;
    const closeIdx = source.lastIndexOf('</rozie>');
    const envelopeEnd = closeIdx >= 0 ? closeIdx + '</rozie>'.length : tagOpenEnd;
    result.rozie = {
      name: rozieMatch[1] ?? 'Anonymous',
      loc: { start: tagStart, end: envelopeEnd },
    };
  } else {
    result.diagnostics.push({
      code: RozieErrorCode.MISSING_ROZIE_ENVELOPE,
      severity: 'error',
      message: 'Missing <rozie> envelope. A .rozie file must wrap its blocks in a <rozie name="..."> root element.',
      loc: { start: 0, end: 0 },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  return result;
}

/**
 * Convert a Vue `SFCBlock` to a Rozie `BlockEntry`.
 *
 * Vue's `SFCBlock.loc` is the CONTENT span (between '>' of the opening tag
 * and '<' of the closing tag). We reconstruct the full-tag `loc` by walking
 * outward from the content boundaries to the surrounding `<` and `>`.
 *
 * Returns `null` if the block boundaries can't be reconstructed (defensive —
 * shouldn't happen on well-formed input).
 */
function sfcBlockToEntry(
  source: string,
  block: { content: string; loc: { start: { offset: number }; end: { offset: number } } },
): BlockEntry | null {
  const contentStart = block.loc.start.offset;
  const contentEnd = block.loc.end.offset;

  // Walk back from contentStart to find '<' of the opening tag.
  let openLt = contentStart - 1;
  while (openLt >= 0 && source.charCodeAt(openLt) !== 60 /* '<' */) {
    openLt--;
  }
  if (openLt < 0) return null;

  // Walk forward from contentEnd to find '>' of the closing tag.
  let closeGt = contentEnd;
  while (closeGt < source.length && source.charCodeAt(closeGt) !== 62 /* '>' */) {
    closeGt++;
  }
  if (closeGt >= source.length) return null;

  return {
    content: block.content,
    contentLoc: { start: contentStart, end: contentEnd },
    loc: { start: openLt, end: closeGt + 1 },
  };
}
