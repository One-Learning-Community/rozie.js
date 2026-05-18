// All .rozie snippets the playground exposes in its picker dropdown.
//
// Sourced from three places:
//   1. The Sortable.rozie spike (canonical lives in .planning/spikes/ which
//      is gitignored, so we keep a copy in src/snippets/ that the build
//      bundles via the existing `?raw` import).
//   2. examples/*.rozie — top-level reference components (Counter, Modal, etc.)
//   3. examples/demos/*.rozie — composed-feature demos (DropdownDemo, ...)
//
// Note: some snippets import sibling components (ModalConsumer needs Modal +
// WrapperModal). The playground compiles in single-buffer mode with
// resolverRoot:'/', so cross-file imports won't resolve — those snippets will
// surface a compile error in the Output tab. That's acceptable feedback; the
// user can pick a self-contained snippet instead.

import sortableSpike from './snippets/Sortable.rozie.txt?raw';

const exampleFiles = import.meta.glob('../../*.rozie', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const demoFiles = import.meta.glob('../../demos/*.rozie', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export interface Snippet {
  /** Display label shown in the dropdown. */
  label: string;
  /** Stable key used as the option value. */
  key: string;
  /** Raw .rozie source. */
  source: string;
}

function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.rozie$/, '');
}

function entriesFrom(map: Record<string, string>, prefix: string): Snippet[] {
  return Object.entries(map)
    .map(([path, source]) => {
      const name = basename(path);
      return {
        key: prefix ? `${prefix}/${name}` : name,
        label: prefix ? `${prefix}/${name}` : name,
        source,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const SNIPPETS: Snippet[] = [
  { key: 'spike/Sortable', label: 'spike/Sortable', source: sortableSpike },
  ...entriesFrom(exampleFiles, ''),
  ...entriesFrom(demoFiles, 'demos'),
];

export const DEFAULT_SNIPPET_KEY = 'spike/Sortable';

export function findSnippet(key: string): Snippet | undefined {
  return SNIPPETS.find((s) => s.key === key);
}
