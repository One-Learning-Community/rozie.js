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
 *  - ROZ005  Premature block close (literal `</script>` inside the block body)
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

/**
 * Block bodies that contain JS or CSS source (NOT HTML) and must be treated
 * as opaque text by the splitter. A `<` inside a JS comment / string / type
 * annotation in one of these bodies must NOT be tokenized as a nested HTML
 * tag — otherwise htmlparser2 fires phantom `onopentagend` / `onclosetag`
 * events that desync the `depth` counter so the matching `</block>` close
 * tag is skipped and the block silently vanishes from the BlockMap (260526-uj3).
 *
 * `<script>` and `<style>` are NOT in this set because htmlparser2's
 * Tokenizer already auto-enters RAWTEXT mode for them (hardcoded internally
 * in v12 — `specialStartSequences` map). Their bodies are scanned linearly
 * for the literal `</script>` / `</style>` close sequence; nested open tags
 * never fire. The four blocks here have no htmlparser2-side raw-text
 * treatment, so the splitter applies the equivalent opaque-body discipline
 * itself via the `inOpaqueBlock` flag below.
 *
 * `<template>` is intentionally EXCLUDED — its body is real HTML and must
 * be tokenized normally so nested-element / consumer-side-fill detection in
 * the downstream parsers (e.g. ROZ050 attribute checks, slot-fill scoping)
 * sees the correct events.
 */
const OPAQUE_BLOCK_NAMES = new Set<string>([
  'props',
  'data',
  'listeners',
  'components',
]);

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
  // Phase 15: holds chunks for the `inherit-listeners` attr on the <rozie>
  // tag. Same null-vs-empty discriminant as `savedInheritAttrsChunks`. Per
  // Pitfall 6 this is a PARALLEL local variable to `savedInheritAttrsChunks`
  // — deliberately NOT genericized into a flags-record (the attribute set is
  // tiny and stable; the parallel form keeps the onattribend/onopentagend
  // call-sites locally readable and matches the Phase 14 precedent).
  let savedInheritListenersChunks: string[] | null = null;
  // Phase 26 (D-12): holds chunks for the `safe-interpolation` attr on the
  // <rozie> tag. Same null-vs-empty discriminant as the inherit-* flags. Per
  // the Phase 14/15 precedent this is a PARALLEL local variable — deliberately
  // NOT genericized. CRITICAL difference from inherit-attrs: this attribute can
  // force-ON as well as force-OFF (the envelope overrides the global option in
  // BOTH directions), so the parse below treats present/`"true"` as true.
  let savedSafeInterpolationChunks: string[] | null = null;
  // Item 3 (engine-CSS shadow bridge): holds chunks for the
  // `adopt-document-styles` attr on the <rozie> tag. Same null-vs-empty
  // discriminant + PARALLEL-local form as the inherit-* / safe-interpolation
  // flags. A boolean feature toggle: present (with or without a value, unless
  // it is the literal `"false"`) → true.
  let savedAdoptDocumentStylesChunks: string[] | null = null;
  let collectingAttribValue = false;
  let unknownTagStart = -1; // tracks <` position of an unknown top-level block, -1 = none
  // Opaque-block mode: true between the opening and closing tag of a block
  // whose body is JS/CSS source (not HTML). See OPAQUE_BLOCK_NAMES above.
  // While set, all `onopentagend`/`onclosetag` events EXCEPT the matching
  // `</currentBlock>` close are ignored — phantom tags from `<` in JS
  // comments/strings/type annotations do not corrupt the `depth` counter.
  // (260526-uj3 forward-work — fixes silent block-vanish on angle-bracket
  // content in props/data/listeners/components bodies.)
  let inOpaqueBlock = false;
  // Premature-close detection (ROZ005, 260603). A block body containing the
  // literal close sequence of its OWN tag (`'</script>'` inside a JS string or
  // comment in <script>, `'</props>'` inside <props>, …) terminates the block
  // at that sequence — htmlparser2's RAWTEXT scan (for <script>/<style>) and
  // the opaque-block discipline above both end at the first literal close,
  // exactly like HTML itself (and Vue/Svelte SFCs). The reliable signature of
  // that failure: the REAL close tag then arrives as a stray — a close event
  // for an already-populated block while no block is open. We report the root
  // cause once per block (code-framed at the premature close, where the author
  // needs to edit) instead of letting the desynced tokenizer state surface as
  // a misleading ROZ003/ROZ031 cascade.
  const prematurelyClosedBlocks = new Set<BlockName>();
  // Offset of the FIRST premature close — every envelope-structure diagnostic
  // (ROZ002/003/004) located after this point is desync noise and is filtered
  // out in a post-pass.
  let firstPrematureCloseOffset = -1;

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
        // Inside an opaque block, any opening-tag event is a phantom from JS
        // content (`<SortableList>` in a comment, `if (x<y)` etc). Ignore the
        // event entirely so attribute-collection state is not clobbered, and
        // so the matching `onopentagend` is also a no-op via the guard below.
        if (inOpaqueBlock) return;
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
        savedInheritListenersChunks = null;
        savedSafeInterpolationChunks = null;
        savedAdoptDocumentStylesChunks = null;
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
        if (inRozieOpenTag && pendingAttribName === 'inherit-listeners') {
          // Phase 15: save the `inherit-listeners` attribute chunks on the
          // <rozie> tag. Same null-vs-empty discriminant + onopentagend
          // parsing pattern as `inherit-attrs` (Phase 14). Per Pitfall 6 this
          // is a PARALLEL save, not a flags-record refactor.
          savedInheritListenersChunks = [...pendingAttribValueChunks];
        }
        if (inRozieOpenTag && pendingAttribName === 'safe-interpolation') {
          // Phase 26 (D-12): save the `safe-interpolation` attribute chunks on
          // the <rozie> tag. Same null-vs-empty discriminant + onopentagend
          // parsing pattern as inherit-attrs (Phase 14). A present-without-value
          // boolean attribute (`<rozie safe-interpolation>`) fired no
          // onattribdata, so the snapshot is `[]` — distinct from `null`
          // (attribute absent).
          savedSafeInterpolationChunks = [...pendingAttribValueChunks];
        }
        if (inRozieOpenTag && pendingAttribName === 'adopt-document-styles') {
          // Item 3: save the `adopt-document-styles` attribute chunks on the
          // <rozie> tag. Same null-vs-empty discriminant + onopentagend parse
          // as the inherit-* flags. A present-without-value boolean attribute
          // (`<rozie adopt-document-styles>`) fires no onattribdata → `[]`,
          // distinct from `null` (attribute absent).
          savedAdoptDocumentStylesChunks = [...pendingAttribValueChunks];
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
        // Inside an opaque block, the matching `onopentagname` was a no-op
        // (see guard above), so this paired event is a phantom too. Do NOT
        // increment depth — that would force the matching `</block>` close
        // to arrive at the wrong depth and silently drop the block.
        if (inOpaqueBlock) return;
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
              // Phase 15: parse the `inherit-listeners` attribute. Same
              // null/empty discriminant + WR-05 case-insensitive parse as
              // `inherit-attrs`: `null` chunks = attribute absent (omit the
              // key — exactOptionalPropertyTypes conditional spread, treated
              // as `true` downstream); `"false"` (case-insensitive) → `false`;
              // everything else (present-without-value `[]`, `"true"`, or any
              // other value) → `true`, the safe default (threat T-15-V5-01).
              // INDEPENDENT of `inherit-attrs` — both flags are stamped
              // separately and downstream tracks them independently (SPEC R5).
              let inheritListeners: boolean | undefined;
              if (savedInheritListenersChunks !== null) {
                const raw = savedInheritListenersChunks
                  .join('')
                  .trim()
                  .toLowerCase();
                inheritListeners = raw !== 'false';
              }
              savedInheritListenersChunks = null;
              // Phase 26 (D-12): parse the `safe-interpolation` attribute. Same
              // null/empty discriminant + WR-05 case-insensitive parse as
              // inherit-attrs: `null` chunks = attribute absent (omit the key —
              // exactOptionalPropertyTypes conditional spread → resolves to
              // undefined → falls through to the global option/default in
              // lower.ts); `"false"` (case-insensitive, incl. `"False"`/`"FALSE"`)
              // → `false` (force-OFF); everything else (present-without-value
              // `[]`, `"true"`, or any other value) → `true` (force-ON).
              //
              // CRITICAL difference from inherit-attrs (D-12): because the
              // envelope attr wins over the global option in BOTH directions,
              // `true` here is a meaningful FORCE-ON (overrides a global
              // safeInterpolation:false), not merely a redundant default. The
              // precedence (`ast.blocks.rozie?.safeInterpolation ?? opts...`) is
              // resolved in lower.ts (Plan 03); this task only populates the field.
              let safeInterpolation: boolean | undefined;
              if (savedSafeInterpolationChunks !== null) {
                const raw = savedSafeInterpolationChunks.join('').trim().toLowerCase();
                safeInterpolation = raw !== 'false';
              }
              savedSafeInterpolationChunks = null;
              // Item 3: parse the `adopt-document-styles` attribute. `null`
              // chunks = attribute absent (omit the key — resolves to `false`
              // downstream in lower.ts); `"false"` (case-insensitive) → `false`;
              // everything else (present-without-value `[]`, `"true"`, or any
              // other value) → `true`. Boolean feature toggle, same WR-05
              // case-insensitive parse as the inherit-* flags.
              let adoptDocumentStyles: boolean | undefined;
              if (savedAdoptDocumentStylesChunks !== null) {
                const raw = savedAdoptDocumentStylesChunks
                  .join('')
                  .trim()
                  .toLowerCase();
                adoptDocumentStyles = raw !== 'false';
              }
              savedAdoptDocumentStylesChunks = null;
              result.rozie = {
                name: nameValue,
                ...(inheritAttrs !== undefined ? { inheritAttrs } : {}),
                ...(inheritListeners !== undefined ? { inheritListeners } : {}),
                ...(safeInterpolation !== undefined ? { safeInterpolation } : {}),
                ...(adoptDocumentStyles !== undefined ? { adoptDocumentStyles } : {}),
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
            // Enter opaque-body mode for blocks whose contents are JS/CSS
            // source (not HTML). Subsequent open/close events fired by
            // htmlparser2 from phantom angle-brackets in the body (JS
            // comments, generic type params like `Array<X>`, etc.) are
            // ignored until the matching `</blockName>` close fires.
            // `<script>` and `<style>` are NOT opaque here because
            // htmlparser2's own RAWTEXT mode already swallows their bodies.
            // `<template>` stays in normal HTML mode (real nested elements).
            if (OPAQUE_BLOCK_NAMES.has(blockName)) {
              inOpaqueBlock = true;
            }
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
        const tagName = source.slice(start, endIndex).toLowerCase();
        // Inside an opaque block, the only close event we honour is the
        // matching `</blockName>` close. Phantom closes from `<` in JS
        // bodies (`</something>` text inside a string literal, etc.) are
        // ignored. Once the real close fires, leave opaque mode and fall
        // through to the normal close-handling logic below.
        if (inOpaqueBlock) {
          if (tagName !== currentBlock) return;
          inOpaqueBlock = false;
        }

        // ROZ005 — stray close of an already-populated block while no block is
        // open: the signature of a premature close (literal `</tagName>` inside
        // the block's own body). Report the ROOT cause, pointed at the
        // premature close tag (the spot the author must escape), not at this
        // stray close. Once per block.
        if (
          currentBlock === null &&
          tagName !== 'rozie' &&
          BLOCK_NAMES.has(tagName as 'rozie') &&
          result[tagName as BlockName] !== undefined &&
          !prematurelyClosedBlocks.has(tagName as BlockName)
        ) {
          const blockName = tagName as BlockName;
          const entry = result[blockName];
          if (entry !== undefined) {
            prematurelyClosedBlocks.add(blockName);
            if (firstPrematureCloseOffset === -1) {
              firstPrematureCloseOffset = entry.contentLoc.end;
            }
            pushDiag({
              code: RozieErrorCode.PREMATURE_BLOCK_CLOSE,
              severity: 'error',
              message: `Literal '</${blockName}>' inside the <${blockName}> block body terminated the block early. Block bodies end at the first '</${blockName}>' close sequence — regardless of JS/CSS strings or comments — exactly like HTML.`,
              // The premature close tag spans [contentLoc.end, loc.end) —
              // contentLoc.end is the '<' of the close that cut the block short.
              loc: { start: entry.contentLoc.end, end: entry.loc.end },
              hint: `Escape the forward slash so the sequence no longer matches the closing tag: '<\\/${blockName}>'. This is the same escape HTML, Vue, and Svelte require.`,
              ...(filename !== undefined ? { filename } : {}),
            });
          }
        }

        depth--;

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

  // Post-pass: collateral-noise suppression for premature block closes (ROZ005).
  // Once a block has been cut short, everything the tokenizer saw AFTER the
  // premature close is desynced — the leftover block body re-tokenizes as
  // top-level HTML, so envelope-structure diagnostics (ROZ002/003/004) located
  // past that point report phantom problems in content that is actually fine
  // (e.g. "Unknown top-level block: <button>" for an element inside the
  // author's own <template>). Keep only the diagnostics that describe real
  // structure: everything before the first premature close, plus ROZ005 itself.
  if (firstPrematureCloseOffset !== -1) {
    const STRUCTURE_NOISE_CODES = new Set<string>([
      RozieErrorCode.MULTIPLE_ROZIE_ENVELOPES,
      RozieErrorCode.UNKNOWN_TOP_LEVEL_BLOCK,
      RozieErrorCode.DUPLICATE_BLOCK,
    ]);
    result.diagnostics = result.diagnostics.filter(
      (d) =>
        !(STRUCTURE_NOISE_CODES.has(d.code) && d.loc.start >= firstPrematureCloseOffset),
    );
  }

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
