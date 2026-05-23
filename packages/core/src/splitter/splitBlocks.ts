/**
 * SFC block splitter — primary path (D-04).
 *
 * Drives htmlparser2's low-level Tokenizer with a 3-state finite state machine
 * (OUTSIDE → IN_ROZIE_ENVELOPE → IN_BLOCK) to slice a `.rozie` source file
 * into its top-level blocks with byte-accurate offsets.
 *
 * Returns `BlockMap & { diagnostics: Diagnostic[] }` — diagnostics are always
 * collected, never thrown (D-08).
 *
 * ROZxxx codes owned by this module (Plan 04 will centralize the registry):
 *  - ROZ001  Missing <rozie> envelope
 *  - ROZ002  Multiple <rozie> envelopes
 *  - ROZ003  Unknown top-level block (e.g., <refs>)
 *  - ROZ004  Duplicate block (e.g., two <props> blocks)
 *
 * Tag-start offset inference (Pitfall 1 — see RESEARCH.md §"Pitfall 1"):
 * htmlparser2's `onopentagname(start, endIndex)` gives the tag NAME span — the
 * `<` is exactly one byte before `start` for opening tags (`<` + name) and two
 * bytes before for closing tags (`</` + name). We track this assumption via the
 * `lastOpenTagStart` field captured in `onopentagname` and document it
 * explicitly here. The off-by-one regression test in Plan 04 protects it.
 *
 * @experimental — shape may change before v1.0
 */
import { Tokenizer } from 'htmlparser2';
import type { BlockEntry, BlockMap } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

/** The eight recognized top-level block tags (Phase 06.2 P1 added 'components'). */
const BLOCK_NAMES = new Set([
  'rozie',
  'props',
  'data',
  'script',
  'listeners',
  'template',
  'style',
  'components',
] as const);

type BlockName =
  | 'props'
  | 'data'
  | 'script'
  | 'listeners'
  | 'template'
  | 'style'
  | 'components';

/** Hostile-input cap (T-1-02-01 mitigation). */
const MAX_DIAGNOSTICS = 1000;

export type SplitBlocksResult = BlockMap & { diagnostics: Diagnostic[] };

/**
 * Split a `.rozie` source file into typed BlockMap with byte-accurate offsets
 * for every present block.
 *
 * @param source - the raw `.rozie` file contents
 * @param filename - optional filename for diagnostic messages
 * @returns BlockMap with rozie/props/data/script/listeners/template/style entries (all optional)
 *          plus a diagnostics array (always present, possibly empty).
 *
 * @experimental — shape may change before v1.0
 *
 * Tag-start offset inference (Pitfall 1):
 *   - For opening tags `<name>`, `<` is at `nameStart - 1`.
 *   - For closing tags `</name>`, `</` is at `nameStart - 2`.
 * These hold for well-formed HTML (no whitespace between `<`/`</` and name).
 * The off-by-one regression test (Plan 04) covers this assumption.
 *
 * Diagnostics are collected, never thrown (D-08). The function always returns,
 * even on hostile input.
 */
export function splitBlocks(source: string, filename?: string): SplitBlocksResult {
  const result: SplitBlocksResult = { diagnostics: [] };

  // FSM state
  let depth = 0;
  let currentBlock: BlockName | null = null;
  let lastOpenTagStart = 0; // offset of '<' of the most recent opening tag
  let pendingTagName = '';
  let blockTagStart = 0; // '<' of the block's opening tag
  let blockContentStart = 0; // first byte after '>' of opening tag
  // Phase 9: the resolved `lang=` value for the active block, captured at
  // block-open time. `null` when the block opening tag carried no `lang`.
  // Captured per-block here (not read live from `savedLangChunks`) because a
  // nested tag inside the block would reset `savedLangChunks` before the
  // block's close tag fires.
  let blockLang: string | null = null;
  let rozieTagStart = 0; // '<' of the <rozie> opening tag

  // <rozie name="..."> attribute extraction (only at depth 0)
  // and unknown-block (ROZ003) tracking inside envelope.
  let inRozieOpenTag = false;
  // Phase 9: generic `lang=` substrate. The same chunked attribute-collection
  // machinery (`onattribname`/`onattribdata`/`onattribend`) used for the
  // `<rozie name=>` attribute is generalized to also fire inside a recognized
  // block opening tag at depth 1 (`<script>`, `<style>`, `<template>`, etc.).
  // `inBlockOpenTag` is the depth-1 block-tag analogue of `inRozieOpenTag`.
  let inBlockOpenTag = false;
  let pendingAttribName = '';
  let pendingAttribValueChunks: string[] = [];
  let savedNameChunks: string[] = []; // holds chunks for the 'name' attr once onattribend fires
  let savedLangChunks: string[] = []; // holds chunks for the 'lang' attr once onattribend fires (Phase 9)
  // Phase 14: holds chunks for the `inherit-attrs` attr on the <rozie> tag.
  // `null` = the attribute was not present on the opening tag at all (vs. an
  // empty-string value, which is a present-without-value boolean attribute).
  let savedInheritAttrsChunks: string[] | null = null;
  let collectingAttribValue = false;
  let unknownTagStart = -1; // tracks <` position of an unknown top-level block, -1 = none

  const pushDiag = (d: Diagnostic): void => {
    if (result.diagnostics.length < MAX_DIAGNOSTICS) {
      result.diagnostics.push(d);
    }
  };

  const tokenizer = new Tokenizer(
    { xmlMode: false, decodeEntities: false },
    {
      onopentagname(start, endIndex) {
        const name = source.slice(start, endIndex).toLowerCase();
        pendingTagName = name;
        // '<' is one byte before the name start for opening tags.
        lastOpenTagStart = start - 1;
        // Reset attribute-extraction state for this tag.
        inRozieOpenTag = depth === 0 && name === 'rozie';
        // Phase 9: a recognized block opening tag at depth 1 — the only other
        // site where we collect attributes (the `lang=` substrate). Note the
        // `<rozie>` tag itself is excluded here: it lives at depth 0 and its
        // attribute is `name`, handled via `inRozieOpenTag`.
        inBlockOpenTag =
          depth === 1 && name !== 'rozie' && BLOCK_NAMES.has(name as 'rozie');
        pendingAttribName = '';
        pendingAttribValueChunks = [];
        savedNameChunks = [];
        savedLangChunks = [];
        savedInheritAttrsChunks = null;
        collectingAttribValue = false;
      },

      onattribname(start, endIndex) {
        if (!inRozieOpenTag && !inBlockOpenTag) return;
        pendingAttribName = source.slice(start, endIndex).toLowerCase();
        pendingAttribValueChunks = [];
        collectingAttribValue = true;
      },

      onattribdata(start, endIndex) {
        // May fire MULTIPLE times per attribute (Pitfall 3 — chunked values).
        if ((!inRozieOpenTag && !inBlockOpenTag) || !collectingAttribValue) return;
        pendingAttribValueChunks.push(source.slice(start, endIndex));
      },

      onattribend(_quote, _endIndex) {
        if (!inRozieOpenTag && !inBlockOpenTag) return;
        if (inRozieOpenTag && pendingAttribName === 'name') {
          // Save the chunks for the 'name' attribute now, before the next onattribname
          // clears pendingAttribValueChunks. onopentagend reads from savedNameChunks.
          savedNameChunks = [...pendingAttribValueChunks];
        }
        if (inRozieOpenTag && pendingAttribName === 'inherit-attrs') {
          // Phase 14: save the `inherit-attrs` attribute chunks on the <rozie>
          // tag. A present-without-value boolean attribute (`<rozie
          // inherit-attrs>`) fired no onattribdata, so the snapshot is `[]` —
          // distinct from `null` (attribute absent), which onopentagend treats
          // as "key omitted". onopentagend joins + parses these chunks.
          savedInheritAttrsChunks = [...pendingAttribValueChunks];
        }
        if (inBlockOpenTag && pendingAttribName === 'lang') {
          // Phase 9: save the `lang` attribute chunks for the current block
          // opening tag. Same chunked push/join pattern as `name` — onattribdata
          // may have fired multiple times. onclosetag stamps it onto BlockEntry.
          savedLangChunks = [...pendingAttribValueChunks];
        }
        collectingAttribValue = false;
      },

      onopentagend(endIndex) {
        // endIndex = position of '>'
        if (depth === 0) {
          if (pendingTagName === 'rozie') {
            // Entering envelope. Capture name attribute.
            if (result.rozie) {
              // Multiple <rozie> envelopes (ROZ002).
              pushDiag({
                code: RozieErrorCode.MULTIPLE_ROZIE_ENVELOPES,
                severity: 'error',
                message: 'Multiple <rozie> envelopes found. A .rozie file must contain exactly one <rozie> root.',
                loc: { start: lastOpenTagStart, end: endIndex + 1 },
                ...(filename !== undefined ? { filename } : {}),
              });
            } else {
              const nameValue = savedNameChunks.join('') || 'Anonymous';
              savedNameChunks = [];
              rozieTagStart = lastOpenTagStart;
              // Phase 14: parse the `inherit-attrs` attribute. `null` chunks =
              // the attribute was absent → omit the key entirely
              // (exactOptionalPropertyTypes — conditional spread → treated as
              // `true` downstream). `"false"` (case-insensitive) → `false`;
              // everything else (present-without-value `[]`, `"true"`, or any
              // other value) → `true`, the safe default (threat T-14-01).
              //
              // WR-05: the comparison is case-insensitive so an author writing
              // `inherit-attrs="False"` / `"FALSE"` (HTML conventions treat
              // boolean-keyword attribute values as case-insensitive) gets the
              // disable they plainly asked for, instead of silently falling
              // through to the default-true.
              let inheritAttrs: boolean | undefined;
              if (savedInheritAttrsChunks !== null) {
                const raw = savedInheritAttrsChunks.join('').trim().toLowerCase();
                inheritAttrs = raw !== 'false';
              }
              savedInheritAttrsChunks = null;
              result.rozie = {
                name: nameValue,
                ...(inheritAttrs !== undefined ? { inheritAttrs } : {}),
                // loc start = '<' of <rozie>; loc end is patched at onclosetag time
                // to include the </rozie> close tag. Use endIndex+1 here as a conservative
                // initial value; we update it when </rozie> fires.
                loc: { start: rozieTagStart, end: endIndex + 1 },
              };
            }
          } else {
            // Top-level non-<rozie> at depth 0 — outside envelope. We accept
            // (no diagnostic at depth 0); ROZ001 fires post-tokenize if no <rozie> was seen.
          }
        } else if (depth === 1) {
          // Inside <rozie> envelope at the top level — this is where blocks live.
          if (pendingTagName === 'rozie') {
            // Nested <rozie>? Already handled above as depth==0; at depth==1 it's malformed.
            pushDiag({
              code: RozieErrorCode.MULTIPLE_ROZIE_ENVELOPES,
              severity: 'error',
              message: 'Nested <rozie> envelope is not permitted.',
              loc: { start: lastOpenTagStart, end: endIndex + 1 },
              ...(filename !== undefined ? { filename } : {}),
            });
          } else if (BLOCK_NAMES.has(pendingTagName as 'rozie')) {
            // Recognized block. Begin tracking content boundaries.
            const blockName = pendingTagName as BlockName;
            if (result[blockName] !== undefined) {
              // Duplicate block (ROZ004).
              pushDiag({
                code: RozieErrorCode.DUPLICATE_BLOCK,
                severity: 'error',
                message: `Duplicate <${blockName}> block. Each .rozie file may contain at most one <${blockName}> block.`,
                loc: { start: lastOpenTagStart, end: endIndex + 1 },
                ...(filename !== undefined ? { filename } : {}),
              });
              // Still track to consume the close tag without populating again.
            }
            currentBlock = blockName;
            blockTagStart = lastOpenTagStart;
            blockContentStart = endIndex + 1;
            // Phase 9: capture the block's resolved `lang=` value now, before
            // any nested opening tag resets `savedLangChunks`. `null` when the
            // block carried no `lang` attribute → BlockEntry.lang stays absent.
            blockLang = savedLangChunks.length > 0 ? savedLangChunks.join('') : null;
          } else {
            // Unknown top-level block — ROZ003.
            const isRefs = pendingTagName === 'refs';
            pushDiag({
              code: RozieErrorCode.UNKNOWN_TOP_LEVEL_BLOCK,
              severity: 'error',
              message: `Unknown top-level block: <${pendingTagName}>. Recognized blocks are: <props>, <data>, <script>, <listeners>, <template>, <style>, <components>.`,
              loc: { start: lastOpenTagStart, end: endIndex + 1 },
              ...(isRefs
                ? { hint: 'Refs are derived from `ref="..."` attributes inside the <template> block — there is no <refs> block.' }
                : {}),
              ...(filename !== undefined ? { filename } : {}),
            });
            // Mark this tag so we ignore its close tag (don't enter block-tracking mode).
            unknownTagStart = lastOpenTagStart;
          }
        }
        // depth > 1: nested HTML inside a block — handled by the tokenizer; we just track depth.
        depth++;
        inRozieOpenTag = false;
        inBlockOpenTag = false;
      },

      onselfclosingtag(_endIndex) {
        // Self-closing tags do NOT increment depth and do NOT begin a block.
        inRozieOpenTag = false;
        inBlockOpenTag = false;
        unknownTagStart = -1;
      },

      onclosetag(start, endIndex) {
        // start = name start; '</' is at start - 2; '>' is at endIndex; full close-tag span is [start-2, endIndex+1)
        depth--;
        const tagName = source.slice(start, endIndex).toLowerCase();

        // Phase 07.2 fix: only close `currentBlock` when this close-tag returns
        // us to envelope-top level (depth === 1 after the decrement). Without
        // this guard, a NESTED `<template>` inside a consumer-side slot fill
        // (e.g., `<Modal><template #default>x</template></Modal>` inside the
        // outer `<template>` block) would prematurely close the outer block
        // on the inner `</template>` close-tag — corrupting the template
        // content slice and emitting spurious ROZ050 diagnostics from the
        // downstream parseTemplate pass.
        if (
          currentBlock !== null &&
          tagName === currentBlock &&
          depth === 1
        ) {
          // Close the active block (if first time — duplicate-block diagnostic was emitted at open).
          if (result[currentBlock] === undefined) {
            const contentLoc = {
              start: blockContentStart,
              end: start - 2, // '<' of '</'
            };
            const blockLoc = {
              start: blockTagStart,
              end: endIndex + 1, // one byte past '>'
            };
            const entry: BlockEntry = {
              content: source.slice(contentLoc.start, contentLoc.end),
              contentLoc,
              loc: blockLoc,
              // Phase 9: only set `lang` when the block opening tag carried a
              // `lang` attribute — conditional-spread keeps the key absent
              // otherwise (required under `exactOptionalPropertyTypes: true`).
              ...(blockLang !== null ? { lang: blockLang } : {}),
            };
            result[currentBlock] = entry;
          }
          currentBlock = null;
          blockLang = null;
        } else if (tagName === 'rozie' && depth === 0 && result.rozie) {
          // Update <rozie> envelope's loc.end to include the </rozie> tag.
          result.rozie.loc.end = endIndex + 1;
        }

        if (unknownTagStart !== -1 && depth === 1) {
          // We've returned to the envelope-top level after an unknown block — clear marker.
          unknownTagStart = -1;
        }
      },

      onattribentity() {},
      ontext() {},
      oncomment() {},
      oncdata() {},
      ondeclaration() {},
      onprocessinginstruction() {},
      ontextentity() {},
      onend() {},
    },
  );

  tokenizer.write(source);
  tokenizer.end();

  // Post-pass: missing <rozie> envelope (ROZ001).
  if (!result.rozie) {
    pushDiag({
      code: RozieErrorCode.MISSING_ROZIE_ENVELOPE,
      severity: 'error',
      message: 'Missing <rozie> envelope. A .rozie file must wrap its blocks in a <rozie name="..."> root element.',
      loc: { start: 0, end: 0 },
      ...(filename !== undefined ? { filename } : {}),
    });
  }

  return result;
}
