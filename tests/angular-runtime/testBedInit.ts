import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

/**
 * Guard `TestBed.initTestEnvironment` — it throws on a second call within
 * one process, and Vitest can reuse a worker across test files.
 *
 * Uses the AOT testing platform (`@angular/platform-browser/testing`'s
 * `BrowserTestingModule` / `platformBrowserTesting`), NOT the "Dynamic" /
 * JIT testing platform (`@angular/platform-browser-dynamic/testing`). Every
 * component this harness mounts is already ngtsc-AOT-compiled by the Vite
 * pipeline (vitest.config.ts's `angular({ jit: false })`) before it ever
 * reaches TestBed, so there is no JIT compiler to bootstrap — using the
 * dynamic/JIT testing platform here would be a needless and misleading
 * dependency for a harness whose entire point is proving the AOT path.
 */
export function ensureTestBedInit(): void {
  const g = globalThis as unknown as { __rozieAngularTestBedInit?: boolean };
  if (!g.__rozieAngularTestBedInit) {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    g.__rozieAngularTestBedInit = true;
  }
}
