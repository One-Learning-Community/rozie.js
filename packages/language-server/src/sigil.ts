import type { SourceLoc } from '@rozie/core';
import type { SigilKind } from './symbols.js';

/**
 * Lexical detection of `$props.X` / `$data.X` / `$refs.X` member access in raw
 * `.rozie` text. These tokens appear across blocks (`<script>`, `<template>`
 * attribute values, `{{ }}` interpolations, `<listeners>`), so resolving them
 * by byte offset over the whole document is more robust than re-deriving each
 * embedding's expression AST — and the byte offsets map straight onto LSP
 * positions. The member declarations themselves come from `extractSymbols`.
 */

const SIGIL_MEMBER = /\$(props|data|refs)\.([A-Za-z_$][\w$]*)/g;
const SIGIL_PREFIX_AT_END = /\$(props|data|refs)\.([A-Za-z_$][\w$]*)?$/;

export interface SigilMemberRef {
  sigil: SigilKind;
  member: string;
  /** Byte span of the whole `$props.count` token. */
  tokenLoc: SourceLoc;
  /** Byte span of just the `count` member name. */
  memberLoc: SourceLoc;
}

/**
 * Find the sigil member-access token spanning [offset] (cursor anywhere in
 * `$props.count`, sigil or member). Returns null when the offset is not inside
 * such a token.
 */
export function resolveSigilMemberAt(text: string, offset: number): SigilMemberRef | null {
  SIGIL_MEMBER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SIGIL_MEMBER.exec(text)) !== null) {
    const tokenStart = match.index;
    const tokenEnd = tokenStart + match[0].length;
    if (offset < tokenStart || offset > tokenEnd) continue;
    const member = match[2] ?? '';
    const memberStart = tokenEnd - member.length;
    return {
      sigil: match[1] as SigilKind,
      member,
      tokenLoc: { start: tokenStart, end: tokenEnd },
      memberLoc: { start: memberStart, end: tokenEnd },
    };
  }
  return null;
}

export interface SigilCompletionContext {
  sigil: SigilKind;
  /** Member chars already typed after the dot (may be empty right after `.`). */
  partial: string;
  /** Absolute byte offset where `partial` begins (where a replace edit starts). */
  partialStart: number;
}

/**
 * Detect whether [offset] sits immediately after a `$props.` / `$data.` /
 * `$refs.` prefix (optionally with a partial member already typed), which is
 * the trigger for member completion.
 *
 * @param text - the full document text
 * @param offset - the cursor's byte offset
 */
export function sigilCompletionContext(
  text: string,
  offset: number,
): SigilCompletionContext | null {
  const before = text.slice(0, offset);
  const match = SIGIL_PREFIX_AT_END.exec(before);
  if (!match) return null;
  const partial = match[2] ?? '';
  return {
    sigil: match[1] as SigilKind,
    partial,
    partialStart: offset - partial.length,
  };
}
