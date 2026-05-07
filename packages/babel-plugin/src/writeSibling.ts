// writeSibling — fs-side effects for @rozie/babel-plugin (Plan 06-04 D-92).
//
// Idempotency strategy: mtime comparison with a 100ms tolerance window.
// Per RESEARCH Pitfall 1 (atomic-save editor jitter on APFS/NFS), if the
// sibling's mtime is within 100ms BEHIND the .rozie's mtime, treat the
// sibling as up-to-date. False negatives (an unnecessary recompile) are
// preferred over false positives (silent stale output).
//
// Recovery: consumers can `rm Foo.{ext}` to force a fresh compile. The v2
// path is a content-hash sidecar (deferred per CONTEXT.md).
//
// All writes go through a single try/catch so any fs error becomes a
// stable ROZ823 diagnostic carrying the offending path.
//
// React-only sidecars: when target='react' and compile() populated
// result.types/css/globalCss, write Foo.d.ts / Foo.module.css /
// Foo.global.css alongside the primary Foo.tsx. Other targets only
// receive the primary artifact (D-84 inline-typed).
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { compile } from '@rozie/core';

/** Editor atomic-save jitter window per RESEARCH Pitfall 1. */
const MTIME_TOLERANCE_MS = 100;

export type RozieBabelTarget = 'vue' | 'react' | 'svelte' | 'angular';

/**
 * Compile the .rozie at `roziePath` and write its sibling `siblingPath`,
 * skipping the work entirely when the sibling appears up-to-date.
 *
 * @param roziePath  Absolute path to the source .rozie file on disk.
 * @param siblingPath Absolute path to the target sibling (e.g. Foo.tsx).
 * @param target Target framework — selects emit branch and sidecar layout.
 *
 * @throws Error with `[ROZ822]` prefix when compile() reports any error
 *         severity diagnostic. The message embeds each [ROZxxx] code so the
 *         babel-plugin caller can buildCodeFrameError around it.
 * @throws Error with `[ROZ823]` prefix when fs writeFileSync fails.
 */
export function writeSiblingIfStale(
  roziePath: string,
  siblingPath: string,
  target: RozieBabelTarget,
): void {
  // Idempotency check — if sibling is fresher than .rozie (or within the
  // 100ms tolerance window), skip. Saves the compile() cost on hot paths
  // (HMR, rebuild after unrelated edit, etc).
  const rozieStat = statSync(roziePath);
  if (existsSync(siblingPath)) {
    const sibStat = statSync(siblingPath);
    if (sibStat.mtimeMs >= rozieStat.mtimeMs - MTIME_TOLERANCE_MS) {
      return; // up-to-date within tolerance
    }
  }

  // Compile via the @rozie/core single source of truth (D-93 byte-identical).
  const source = readFileSync(roziePath, 'utf8');
  const result = compile(source, { target, filename: roziePath });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    const detail = errors.map((d) => `[${d.code}] ${d.message}`).join('; ');
    throw new Error(`[ROZ822] @rozie/babel-plugin: compile failed: ${detail}`);
  }

  // Write phase — primary artifact + react sidecars in a single try/catch.
  try {
    writeFileSync(siblingPath, result.code, 'utf8');
    if (target === 'react') {
      // WR-03: assert the canonical .tsx invariant before deriving sidecar
      // paths. `String.prototype.replace(/\.tsx$/, …)` is a no-op on a path
      // that doesn't end in `.tsx`, which would silently overwrite the
      // primary `.tsx` with the .d.ts/.css text. The visitor in `index.ts`
      // is the only known caller and feeds canonical extensions via
      // TARGET_EXTENSIONS, so this is defense-in-depth — bailing loudly is
      // safer than silent corruption if a future caller drifts.
      if (!siblingPath.endsWith('.tsx')) {
        throw new Error(
          `[ROZ823] @rozie/babel-plugin: react sibling path must end with .tsx, got ${siblingPath}`,
        );
      }
      const stem = siblingPath.slice(0, -'.tsx'.length);
      if (result.types) {
        writeFileSync(`${stem}.d.ts`, result.types, 'utf8');
      }
      if (result.css) {
        writeFileSync(`${stem}.module.css`, result.css, 'utf8');
      }
      if (result.globalCss) {
        writeFileSync(`${stem}.global.css`, result.globalCss, 'utf8');
      }
    }
  } catch (err) {
    throw new Error(
      `[ROZ823] @rozie/babel-plugin: failed to write sibling ${siblingPath}: ${(err as Error).message}`,
    );
  }
}
