// compileImport — thin indirection between the visitor in index.ts and
// the fs-side writeSibling helper. Per CONTEXT.md recommended structure,
// this layer exists so future cache strategies (content-hash sidecar v2,
// in-memory LRU) can land without touching the visitor file or the
// fs primitives. v1 is a one-liner.
import { writeSiblingIfStale, type RozieBabelTarget } from './writeSibling.js';

/**
 * Read the .rozie at `roziePath`, compile it for `target`, and write the
 * sibling `siblingPath` (plus React sidecars when applicable). Idempotent
 * via mtime check. Errors are bubbled up unchanged for the visitor to
 * re-shape into a Babel error via `path.buildCodeFrameError`.
 */
export function compileImport(
  roziePath: string,
  siblingPath: string,
  target: RozieBabelTarget,
): void {
  writeSiblingIfStale(roziePath, siblingPath, target);
}
