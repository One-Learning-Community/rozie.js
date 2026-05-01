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

/** The seven recognized top-level block tags. */
const BLOCK_NAMES = new Set([
  'rozie',
  'props',
  'data',
  'script',
  'listeners',
  'template',
  'style',
] as const);

type BlockName = 'props' | 'data' | 'script' | 'listeners' | 'template' | 'style';

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
  let rozieTagStart = 0; // '<' of the <rozie> opening tag

  // <rozie name="..."> attribute extraction (only at depth 0)
  // and unknown-block (ROZ003) tracking inside envelope.
  let inRozieOpenTag = false;
  let pendingAttribName = '';
  let pendingAttribValueChunks: string[] = [];
  let savedNameChunks: string[] = []; // holds chunks for the 'name' attr once onattribend fires
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
        pendingAttribName = '';
        pendingAttribValueChunks = [];
        savedNameChunks = [];
        collectingAttribValue = false;
      },

      onattribname(start, endIndex) {
        if (!inRozieOpenTag) return;
        pendingAttribName = source.slice(start, endIndex).toLowerCase();
        pendingAttribValueChunks = [];
        collectingAttribValue = true;
      },

      onattribdata(start, endIndex) {
        // May fire MULTIPLE times per attribute (Pitfall 3 — chunked values).
        if (!inRozieOpenTag || !collectingAttribValue) return;
        pendingAttribValueChunks.push(source.slice(start, endIndex));
      },

      onattribend(_quote, _endIndex) {
        if (!inRozieOpenTag) return;
        if (pendingAttribName === 'name') {
          // Save the chunks for the 'name' attribute now, before the next onattribname
          // clears pendingAttribValueChunks. onopentagend reads from savedNameChunks.
          savedNameChunks = [...pendingAttribValueChunks];
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
              result.rozie = {
                name: nameValue,
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
          } else {
            // Unknown top-level block — ROZ003.
            const isRefs = pendingTagName === 'refs';
            pushDiag({
              code: RozieErrorCode.UNKNOWN_TOP_LEVEL_BLOCK,
              severity: 'error',
              message: `Unknown top-level block: <${pendingTagName}>. Recognized blocks are: <props>, <data>, <script>, <listeners>, <template>, <style>.`,
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
      },

      onselfclosingtag(_endIndex) {
        // Self-closing tags do NOT increment depth and do NOT begin a block.
        inRozieOpenTag = false;
        unknownTagStart = -1;
      },

      onclosetag(start, endIndex) {
        // start = name start; '</' is at start - 2; '>' is at endIndex; full close-tag span is [start-2, endIndex+1)
        depth--;
        const tagName = source.slice(start, endIndex).toLowerCase();

        if (currentBlock !== null && tagName === currentBlock) {
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
            };
            result[currentBlock] = entry;
          }
          currentBlock = null;
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
