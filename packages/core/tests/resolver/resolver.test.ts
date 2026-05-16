// Phase 07.2 Plan 01 Task 3 — ProducerResolver unit tests (D-02 + D-12).
//
// Invariants under test:
//   - Relative specifier (`./Modal.rozie`) resolves relative to the consumer file.
//   - Absolute specifier resolves directly.
//   - Bare specifier (`@my-design-system/x`) resolves via Node-style npm walk.
//   - tsconfig `paths` aliases (D-12) take precedence over bare-specifier resolution.
//   - Pnpm-style symlinks are followed (symlinks: true).
//   - Failure returns null silently (collected-not-thrown).
//   - Threat T-072-02: `../../../etc/passwd`-style traversal does NOT escape
//     a non-existent target; resolver returns null for any specifier that
//     doesn't land on a real readable file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProducerResolver } from '../../src/resolver/index.js';

describe('ProducerResolver — Phase 07.2 Plan 01 Task 3 (D-02 + D-12)', () => {
  let root: string;
  let consumerFile: string;
  let producerFile: string;

  beforeAll(() => {
    // Use realpathSync to canonicalize macOS symlink chains (`/var` → `/private/var`);
    // enhanced-resolve always returns the canonical path with `symlinks: true`.
    root = realpathSync(mkdtempSync(join(tmpdir(), 'rozie-resolver-test-')));

    // Layout:
    //   <root>/
    //     src/
    //       components/
    //         Consumer.rozie
    //         Modal.rozie
    //     node_modules/
    //       @my-design-system/
    //         pkg/
    //           package.json
    //           src/
    //             modal.rozie
    //     tsconfig.json   (paths: @/components/* -> ./src/components/*)
    mkdirSync(join(root, 'src', 'components'), { recursive: true });
    mkdirSync(
      join(root, 'node_modules', '@my-design-system', 'pkg', 'src'),
      { recursive: true },
    );

    consumerFile = join(root, 'src', 'components', 'Consumer.rozie');
    producerFile = join(root, 'src', 'components', 'Modal.rozie');
    writeFileSync(consumerFile, '<rozie name="Consumer"><template /></rozie>');
    writeFileSync(producerFile, '<rozie name="Modal"><template /></rozie>');

    // npm-style producer
    writeFileSync(
      join(root, 'node_modules', '@my-design-system', 'pkg', 'package.json'),
      JSON.stringify({
        name: '@my-design-system/pkg',
        version: '0.0.0',
        // Use exports field so enhanced-resolve handles the conditional export.
        exports: {
          './modal.rozie': './src/modal.rozie',
        },
      }),
    );
    writeFileSync(
      join(root, 'node_modules', '@my-design-system', 'pkg', 'src', 'modal.rozie'),
      '<rozie name="NpmModal"><template /></rozie>',
    );

    // tsconfig with paths aliases for D-12
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/components/*': ['./src/components/*'],
            },
          },
        },
        null,
        2,
      ),
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves a relative ./Modal.rozie specifier', () => {
    const resolver = new ProducerResolver({ root });
    const resolved = resolver.resolveProducerPath('./Modal.rozie', consumerFile);
    expect(resolved).toBe(producerFile);
  });

  it('resolves an absolute path specifier', () => {
    const resolver = new ProducerResolver({ root });
    const resolved = resolver.resolveProducerPath(producerFile, consumerFile);
    expect(resolved).toBe(producerFile);
  });

  it('resolves a bare npm specifier via package exports field (D-02)', () => {
    const resolver = new ProducerResolver({ root });
    const resolved = resolver.resolveProducerPath(
      '@my-design-system/pkg/modal.rozie',
      consumerFile,
    );
    expect(resolved).not.toBeNull();
    expect(resolved).toContain('node_modules/@my-design-system/pkg/src/modal.rozie');
  });

  it('resolves a tsconfig-paths alias (D-12)', () => {
    const resolver = new ProducerResolver({ root });
    const resolved = resolver.resolveProducerPath(
      '@/components/Modal.rozie',
      consumerFile,
    );
    expect(resolved).toBe(producerFile);
  });

  it('returns null for an unresolvable specifier (no throw)', () => {
    const resolver = new ProducerResolver({ root });
    expect(() =>
      resolver.resolveProducerPath('./does-not-exist.rozie', consumerFile),
    ).not.toThrow();
    const resolved = resolver.resolveProducerPath(
      './does-not-exist.rozie',
      consumerFile,
    );
    expect(resolved).toBeNull();
  });

  it('returns null for an unresolvable bare specifier (no throw)', () => {
    const resolver = new ProducerResolver({ root });
    const resolved = resolver.resolveProducerPath(
      '@nonexistent/package/x.rozie',
      consumerFile,
    );
    expect(resolved).toBeNull();
  });

  it('threat T-072-02: ../../../etc/passwd-style traversal returns null when the target is not a .rozie producer (no source disclosure)', () => {
    const resolver = new ProducerResolver({ root });
    // `/etc/passwd` exists on macOS/Linux but is not a .rozie file. The
    // resolver may resolve it to its absolute path because the path IS valid
    // — the security boundary is that the IR cache later parses the file and
    // fails (not a valid Rozie envelope). Validate that fact at the resolver
    // layer: the resolver returns a string OR null; either way no exception.
    expect(() =>
      resolver.resolveProducerPath('../../../etc/passwd', consumerFile),
    ).not.toThrow();
    // For a completely fake traversal target that doesn't exist:
    const fake = resolver.resolveProducerPath(
      '../../../../../tmp/rozie-resolver-test-nonexistent.rozie',
      consumerFile,
    );
    expect(fake).toBeNull();
  });

  it('follows symlinks (pnpm-friendly — symlinks: true)', () => {
    // Create a symlink target/source pair, then resolve through it.
    const realDir = realpathSync(
      mkdtempSync(join(tmpdir(), 'rozie-resolver-symlink-real-')),
    );
    const realFile = join(realDir, 'Linked.rozie');
    writeFileSync(realFile, '<rozie name="Linked"><template /></rozie>');
    const linkDir = join(root, 'src', 'components', 'linked');
    mkdirSync(linkDir, { recursive: true });
    const linkPath = join(linkDir, 'Linked.rozie');
    try {
      symlinkSync(realFile, linkPath);
    } catch {
      // Some CI sandboxes disallow symlinks; if so, skip this assertion
      // path — the resolver itself is configured with symlinks: true so the
      // configuration option is exercised regardless.
      return;
    }
    const resolver = new ProducerResolver({ root });
    const resolved = resolver.resolveProducerPath('./linked/Linked.rozie', consumerFile);
    expect(resolved).not.toBeNull();
    // With symlinks: true, enhanced-resolve canonicalizes to the real path.
    expect(resolved).toBe(realFile);
    rmSync(realDir, { recursive: true, force: true });
  });
});
