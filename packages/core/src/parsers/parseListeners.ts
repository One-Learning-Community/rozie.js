/**
 * `<listeners>` block parser (Phase 19 — element-walk form, D-01).
 *
 * Phase 19 swaps the front-end from a Babel object-literal walk to an
 * htmlparser2 `<listener>` element-walk that mirrors `parseTemplate.ts`. The
 * `<listeners>` block is now markup:
 *
 *   <listeners>
 *     <listener :target="document" @keydown.escape="close()" r-if="$props.open" />
 *     <listener :target="window" @resize.throttle(100).passive="reposition()" />
 *   </listeners>
 *
 * Per <listener> tag:
 *   - `:target` text → `window`/`document` verbatim; omitted → `$el`; ANY other
 *      value (incl `$refs.x`, arbitrary expr) → ROZ114 and the tag is skipped
 *      (D-04 — $refs deferred; the IR `decodeTarget` already supports it, so
 *      widening later is additive — the restriction is enforced HERE, not by
 *      crippling `decodeTarget`).
 *   - `r-if` text → the conditional-attach expression. Absent → no `when`.
 *   - every `@event` attribute → ONE ListenerEntry (D-04 fan-out). N events on
 *     one tag → N entries sharing target + r-if condition.
 *   - zero `@event` attributes → ROZ015 and the tag is skipped.
 *
 * THE SYNTHESIS BRIDGE (Req 6, NON-NEGOTIABLE): each entry's `value` is a Babel
 * ObjectExpression of shape `{ when?, handler }`, synthesized so the THREE
 * downstream consumers run UNCHANGED:
 *   - lowerListeners.extractObjectPropertyExpression (when/handler)
 *   - buildDepGraph.extractObjectPropertyExpression
 *   - unknownRefValidator.validateListenerEntry
 * The synthesized `when` StringLiteral carries the REAL `r-if` value byte offset
 * minus 1 in `.start`, so unknownRefValidator's `(member.value.start ?? 0) + 1`
 * quote-skip math yields a byte-accurate diagnostic loc on `r-if`.
 *
 * The `@event` parse (`name`/`modifierChainText`/`modifierChainBaseOffset`) goes
 * through the SHARED `parseEventAttrName` helper that `parseTemplate` also calls
 * — making the D-20 byte-identity guarantee STRUCTURAL.
 *
 * D-08: collected-not-thrown. NEVER throws on malformed / stray markup. A
 * non-`<listener>` element in the block, or a bare unterminated `<listener>`,
 * yields a clean diagnostic — never silent.
 *
 * ROZxxx codes owned here:
 *  - ROZ015  <listener> with zero @event attributes
 *  - ROZ114  :target other than window/document (incl $refs.x — deferred)
 * The legacy ROZ010/011/012/013 emission (object-literal walk) is RETIRED here;
 * their DEFINITIONS remain in codes.ts (D-07 — ROZ010/011 are shared with
 * parseProps/parseData/parseComponents).
 *
 * Threat model T-19-02 / T-1-03-01: attribute names/values are read as plain
 * strings into a fresh per-tag array — no `Object.assign`/runtime eval, so
 * prototype-pollution-shaped attribute names (`__proto__`) are inert text.
 *
 * @experimental — shape may change before v1.0
 */
import { Tokenizer } from 'htmlparser2';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type { Expression } from '@babel/types';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ListenersAST, ListenerEntry } from '../ast/blocks/ListenersAST.js';
import { parserPositionFor } from './parserPosition.js';
import { parseEventAttrName } from './parseEventAttr.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseListenersResult {
  node: ListenersAST | null;
  diagnostics: Diagnostic[];
}

/** A collected attribute on a pending `<listener>` tag. */
interface CollectedAttr {
  rawName: string;
  /** Absolute byte offset of the first byte of the attribute name. */
  nameStart: number;
  /** Joined attribute-value text (null if the attribute had no `=value`). */
  value: string | null;
  /** Absolute byte span of the value text (null if no value). */
  valueLoc: SourceLoc | null;
}

interface PendingAttr {
  rawName: string;
  nameStart: number;
  valueChunks: string[];
  valueStart: number | null;
  valueEnd: number | null;
}

export function parseListeners(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseListenersResult {
  const diagnostics: Diagnostic[] = [];
  const baseOffset = contentLoc.start;
  const entries: ListenerEntry[] = [];

  // Per-tag scratch state.
  let pendingTagName = '';
  let pendingTagOpenStart = 0;
  let pendingAttrs: CollectedAttr[] = [];
  let currentAttr: PendingAttr | null = null;

  const withFilename = filename !== undefined ? { filename } : {};

  const finalizeCurrentAttr = (): void => {
    if (!currentAttr) return;
    const a = currentAttr;
    pendingAttrs.push({
      rawName: a.rawName,
      nameStart: a.nameStart,
      value: a.valueStart === null ? null : a.valueChunks.join(''),
      valueLoc:
        a.valueStart === null || a.valueEnd === null
          ? null
          : { start: a.valueStart, end: a.valueEnd },
    });
    currentAttr = null;
  };

  /**
   * Parse an attribute VALUE text into a Babel Expression anchored at its real
   * source position (so handler/when diagnostics carry accurate frames). On a
   * parse failure, fall back to a synthetic Identifier so we never throw (D-08).
   */
  const parseValueExpression = (valueText: string, valueLoc: SourceLoc): Expression => {
    try {
      const pos = parserPositionFor(source, valueLoc);
      return parseExpression(valueText, {
        ...pos,
        ...(filename !== undefined ? { sourceFilename: filename } : {}),
        errorRecovery: true,
      });
    } catch {
      // Never throw — produce an inert placeholder. Downstream validation will
      // treat it as an opaque identifier read.
      const id = t.identifier(valueText.trim() || '__rozie_invalid__');
      id.start = valueLoc.start;
      id.end = valueLoc.end;
      return id;
    }
  };

  /** Finalize a single `<listener>` tag: validate target, fan out @event attrs. */
  const finalizeListenerTag = (tagName: string, tagLoc: SourceLoc): void => {
    // Case-fold the tag name (parseTemplate preserves case). Anything that is
    // not a <listener> inside <listeners> is malformed/stray markup.
    if (tagName.toLowerCase() !== 'listener') {
      diagnostics.push({
        code: RozieErrorCode.LISTENER_ELEMENT_NO_EVENT,
        severity: 'error',
        message: `<listeners> may only contain <listener> elements — found <${tagName}>.`,
        loc: tagLoc,
        ...withFilename,
        hint: 'Use `<listener :target="document" @event="handler()" />`.',
      });
      return;
    }

    // Resolve :target. Omitted → '$el'. window/document → verbatim. Otherwise → ROZ114.
    const targetAttr = pendingAttrs.find((a) => a.rawName === ':target');
    let target: string;
    if (!targetAttr || targetAttr.value === null) {
      target = '$el';
    } else if (targetAttr.value === 'window' || targetAttr.value === 'document') {
      target = targetAttr.value;
    } else {
      diagnostics.push({
        code: RozieErrorCode.UNSUPPORTED_LISTENER_TARGET,
        severity: 'error',
        message: `<listener :target="${targetAttr.value}"> is not supported — only "window" and "document" are valid targets in v1.`,
        loc: targetAttr.valueLoc ?? tagLoc,
        ...withFilename,
        hint: 'Use :target="window" or :target="document", or omit :target to bind on the component root ($el). Element/$refs targets are planned for a future release.',
      });
      return;
    }

    // Resolve r-if (the conditional-attach expression; null if absent).
    const rIfAttr = pendingAttrs.find((a) => a.rawName === 'r-if');
    const rIfText = rIfAttr && rIfAttr.value !== null ? rIfAttr.value : null;
    const rIfValueStart = rIfAttr?.valueLoc?.start ?? null;

    // Collect every @event attribute.
    const eventAttrs = pendingAttrs.filter((a) => a.rawName.startsWith('@'));
    if (eventAttrs.length === 0) {
      diagnostics.push({
        code: RozieErrorCode.LISTENER_ELEMENT_NO_EVENT,
        severity: 'error',
        message: '<listener> must declare at least one @event attribute (e.g. @click="handler()").',
        loc: tagLoc,
        ...withFilename,
        hint: 'Add an @event handler, e.g. `<listener :target="document" @keydown.escape="close()" />`.',
      });
      return;
    }

    // Fan out: one ListenerEntry per @event attribute, sharing target + r-if.
    for (const ev of eventAttrs) {
      const { name, modifierChainText, modifierChainBaseOffset } = parseEventAttrName(
        ev.rawName,
        ev.nameStart,
      );

      // Synthesize the legacy `{ when?, handler }` ObjectExpression (Req 6).
      const props: t.ObjectProperty[] = [];
      if (rIfText !== null) {
        const whenLiteral = t.stringLiteral(rIfText);
        // CRITICAL (RESEARCH A4 / T-19-03): unknownRefValidator re-parses the
        // `when` StringLiteral at `(member.value.start ?? 0) + 1` (the +1 skips
        // the opening quote of a real string literal). Our literal is synthetic
        // and carries no quote, so set `.start` to the real r-if value byte
        // offset MINUS 1 — the validator's +1 then lands on the real first byte.
        if (rIfValueStart !== null) {
          whenLiteral.start = rIfValueStart - 1;
          whenLiteral.end = (rIfAttr?.valueLoc?.end ?? rIfValueStart) + 1;
        }
        props.push(t.objectProperty(t.identifier('when'), whenLiteral));
      }

      const handlerText = ev.value ?? '';
      const handlerExpr =
        ev.value !== null && ev.valueLoc !== null
          ? parseValueExpression(handlerText, ev.valueLoc)
          : t.identifier('__rozie_empty_handler__');
      props.push(t.objectProperty(t.identifier('handler'), handlerExpr));

      const valueObj = t.objectExpression(props);

      entries.push({
        target,
        event: name,
        modifierChainText,
        modifierChainBaseOffset,
        // chain is populated later by enrichListeners (peggy grammar).
        chain: [],
        value: valueObj,
        loc: tagLoc,
      });
    }
  };

  const tokenizer = new Tokenizer(
    { xmlMode: false, decodeEntities: false },
    {
      onopentagname(start, endIndex) {
        pendingTagName = content.slice(start, endIndex);
        pendingTagOpenStart = baseOffset + start - 1; // '<' is one byte before name
        pendingAttrs = [];
        currentAttr = null;
      },

      onattribname(start, endIndex) {
        currentAttr = {
          rawName: content.slice(start, endIndex),
          nameStart: baseOffset + start,
          valueChunks: [],
          valueStart: null,
          valueEnd: null,
        };
      },

      onattribdata(start, endIndex) {
        if (!currentAttr) return;
        if (currentAttr.valueStart === null) {
          currentAttr.valueStart = baseOffset + start;
        }
        currentAttr.valueEnd = baseOffset + endIndex;
        currentAttr.valueChunks.push(content.slice(start, endIndex));
      },

      onattribend() {
        finalizeCurrentAttr();
      },

      onselfclosingtag(endIndex) {
        finalizeListenerTag(pendingTagName, {
          start: pendingTagOpenStart,
          end: baseOffset + endIndex + 1,
        });
        pendingTagName = '';
        pendingAttrs = [];
        currentAttr = null;
      },

      onopentagend(endIndex) {
        // Paired form `<listener ...></listener>`. <listener> has no child
        // semantics, so finalize immediately on the open-tag end; the matching
        // close tag is consumed as a no-op below.
        finalizeListenerTag(pendingTagName, {
          start: pendingTagOpenStart,
          end: baseOffset + endIndex + 1,
        });
        pendingTagName = '';
        pendingAttrs = [];
        currentAttr = null;
      },

      onclosetag() {
        // No-op: the tag was already finalized on onopentagend. <listener> has
        // no children so we don't track a stack.
      },

      ontext() {
        // Whitespace / stray text between <listener> tags — ignored.
      },

      onattribentity() {},
      oncomment() {},
      oncdata() {},
      ondeclaration() {},
      onprocessinginstruction() {},
      ontextentity() {},
      onend() {
        // A bare unterminated `<listener>` (no `/>`, no close tag) leaves
        // pendingTagName set without an onopentagend/onselfclosingtag firing.
        // Emit a clean diagnostic rather than silently swallowing it (Open Q2).
        if (pendingTagName !== '') {
          diagnostics.push({
            code: RozieErrorCode.LISTENER_ELEMENT_NO_EVENT,
            severity: 'error',
            message: `Unterminated <${pendingTagName}> in <listeners> — close it with \`/>\` or \`</${pendingTagName}>\`.`,
            loc: {
              start: pendingTagOpenStart,
              end: pendingTagOpenStart + pendingTagName.length + 1,
            },
            ...withFilename,
            hint: 'Use the self-closing form: `<listener :target="document" @event="handler()" />`.',
          });
        }
      },
    },
  );

  tokenizer.write(content);
  tokenizer.end();

  return {
    node: {
      type: 'ListenersAST',
      loc: contentLoc,
      entries,
    },
    diagnostics,
  };
}
