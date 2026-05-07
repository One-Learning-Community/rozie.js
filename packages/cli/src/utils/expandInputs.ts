// expandInputs — D-88 input expansion for `rozie build <inputs...>`.
//
// Each positional arg auto-detects as one of:
//   - file       → resolved to absolute path, validated to end with `.rozie`
//   - directory  → fast-glob `${dir}/**/*.rozie`
//   - glob       → fast-glob direct (detected via `fg.isDynamicPattern`)
//
// Phase 06.2 P3 D-122: composing components emit as plain imports; downstream
// bundlers handle transitive resolution. v1's "one input file → one output
// unit" assumption holds — `<components>{ Foo: './Foo.rozie' }` does NOT
// auto-include `./Foo.rozie` in the input list. Authors enumerate the full
// component graph via the variadic args / glob pattern. v2 may add a
// `--resolve-transitive` flag.
//
// Carries forward security posture from `packages/unplugin/src/transform.ts`:
//   - Null-byte injection rejected (lines 235-237 of transform.ts)
//   - Top-level symlink args refused; recursive glob walk skips symlinks
//   - The same ignore set used by `walkRozieFiles` (node_modules, .git, …)
//
// Results are deduplicated via a Set and sorted by absolute path so the
// downstream (input × target) tuple list is deterministic.
import fg from 'fast-glob';
import { lstatSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';

/**
 * D-88: expand variadic positional args into a deduped, sorted list of
 * absolute `.rozie` paths. Throws on invalid inputs.
 *
 * @public — used by `runBuildMatrix` (commands/build.ts) and CLI tests.
 */
export async function expandInputs(args: string[]): Promise<string[]> {
  const out = new Set<string>();
  for (const arg of args) {
    // Carry forward null-byte rejection from unplugin/transform.ts:235-237
    // (T-05-04b-03 mitigation). ROZ853 surface in CLI; here we throw a plain
    // Error so the caller (runBuildMatrix) can re-shape into a build exit.
    if (arg.includes('\0')) {
      throw new Error(
        `[ROZ853] rozie build: refusing input with null byte: ${JSON.stringify(arg)}`,
      );
    }

    // 1. Glob — fast-glob detects magic chars (`*`, `?`, `[]`, `{}`, …).
    if (fg.isDynamicPattern(arg)) {
      const matches = await fg(arg, {
        absolute: true,
        onlyFiles: true,
        followSymbolicLinks: false,
      });
      for (const match of matches) {
        if (match.endsWith('.rozie')) out.add(match);
      }
      continue;
    }

    // 2. File or directory — lstat (NOT stat) so a symlink doesn't get
    //    transparently followed. The walkRozieFiles posture in
    //    packages/unplugin/src/transform.ts:737 is the canonical reference.
    const abs = pathResolve(arg);
    let stat;
    try {
      stat = lstatSync(abs);
    } catch {
      throw new Error(`[ROZ851] rozie build: cannot stat input '${arg}'`);
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        `[ROZ851] rozie build: refusing symlink input '${arg}' (defense-in-depth from walkRozieFiles)`,
      );
    }

    if (stat.isDirectory()) {
      const matches = await fg(`${abs}/**/*.rozie`, {
        absolute: true,
        onlyFiles: true,
        followSymbolicLinks: false,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/.turbo/**',
          '**/.planning/**',
        ],
      });
      for (const match of matches) out.add(match);
    } else if (stat.isFile()) {
      if (!abs.endsWith('.rozie')) {
        throw new Error(`[ROZ854] rozie build: file '${arg}' is not a .rozie file`);
      }
      out.add(abs);
    } else {
      throw new Error(`[ROZ851] rozie build: cannot stat input '${arg}'`);
    }
  }
  return [...out].sort();
}
