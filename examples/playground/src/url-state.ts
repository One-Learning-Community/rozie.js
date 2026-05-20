// URL-hash persistence for the playground editor.
//
// Encodes the active snippet key, target, and live editor buffer into the
// location hash so a browser refresh keeps unsaved edits and the address
// bar doubles as a shareable link. No server, no storage — the state is
// fully self-contained in the URL.
//
// Encoding: JSON -> deflate-raw (CompressionStream) -> base64url. The result
// is opaque in the address bar (the "obfuscated URL" a sharer expects) and
// compact enough that a typical .rozie snippet stays well under any URL
// length limit.
//
// Siblings of a multi-file bundle are intentionally NOT encoded — only the
// entry buffer the user actually edits. A restored link re-attaches the
// bundle's siblings from the named snippet (see main.ts).

import type { CompileTarget } from '@rozie/core';

export interface PlaygroundUrlState {
  /** Snippet key the editor started from — used for sibling resolution and to reflect the picker. */
  snippet: string;
  target: CompileTarget;
  /** Live editor buffer (the bundle entry's source). */
  code: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Compress + encode playground state into a URL-hash-safe string. */
export async function encodeState(state: PlaygroundUrlState): Promise<string> {
  const json = JSON.stringify(state);
  const stream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buffer));
}

/**
 * Decode a URL-hash string back into playground state. Returns null on any
 * malformed input — a hand-edited or truncated hash falls back cleanly to
 * the default snippet rather than throwing.
 */
export async function decodeState(
  encoded: string,
): Promise<PlaygroundUrlState | null> {
  try {
    const stream = new Blob([base64UrlToBytes(encoded)])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    const json = await new Response(stream).text();
    const parsed: unknown = JSON.parse(json);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as PlaygroundUrlState).snippet === 'string' &&
      typeof (parsed as PlaygroundUrlState).target === 'string' &&
      typeof (parsed as PlaygroundUrlState).code === 'string'
    ) {
      return parsed as PlaygroundUrlState;
    }
    return null;
  } catch {
    return null;
  }
}
