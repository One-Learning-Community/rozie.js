// All .rozie snippets the playground exposes in its picker dropdown.
//
// A snippet is a "bundle" — one or more .rozie files keyed by their virtual
// filename. Single-file snippets have one entry whose key matches `entry`.
// Multi-file snippets (e.g. SortableListDemo, which imports SortableList via a
// <components> block) carry the dependency in `files` so the playground's
// virtual-filesystem resolver can satisfy cross-file <components> imports
// without ever touching the real filesystem (the browser doesn't have one).
//
// Sourced from three places:
//   1. The Sortable.rozie spike (canonical lives in .planning/spikes/ which
//      is gitignored, so we keep a copy in src/snippets/ that the build
//      bundles via the existing `?raw` import).
//   2. examples/*.rozie — top-level reference components (Counter, Modal, etc.)
//   3. examples/demos/*.rozie — composed-feature demos (DropdownDemo, ...)
//
// Multi-file bundles are registered explicitly below — each declares its
// entry file plus every sibling .rozie it imports.

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
  /** Entry .rozie filename (relative, e.g. `SortableListDemo.rozie`). */
  entry: string;
  /**
   * Virtual filesystem for this bundle — filename → source. For single-file
   * snippets this map has exactly one entry whose key matches `entry`.
   * Multi-file snippets include every sibling .rozie the entry imports via
   * a `<components>` block.
   */
  files: Record<string, string>;
}

function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.rozie$/, '');
}

function filenameFromGlob(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Make a single-file snippet bundle from a globbed example/demo entry. */
function singleFileSnippet(
  path: string,
  source: string,
  prefix: string,
): Snippet {
  const filename = filenameFromGlob(path);
  const name = basename(path);
  return {
    key: prefix ? `${prefix}/${name}` : name,
    label: prefix ? `${prefix}/${name}` : name,
    entry: filename,
    files: { [filename]: source },
  };
}

/**
 * Multi-file bundle declarations — each lists the entry file's path under
 * exampleFiles and the sibling dependency paths. The bundle's `files` map
 * keys by the filename (no path prefix) so `<components>` imports like
 * `'./SortableList.rozie'` resolve against the virtual /vfs/ root.
 */
interface BundleDecl {
  key: string;
  label: string;
  entryGlobPath: string;
  dependencyGlobPaths: string[];
}

const BUNDLE_DECLS: readonly BundleDecl[] = [
  {
    key: 'bundle/SortableListDemo',
    label: 'bundle/SortableListDemo',
    entryGlobPath: '../../SortableListDemo.rozie',
    dependencyGlobPaths: ['../../SortableList.rozie'],
  },
  {
    key: 'bundle/FlatpickrDemo',
    label: 'bundle/FlatpickrDemo',
    entryGlobPath: '../../FlatpickrDemo.rozie',
    dependencyGlobPaths: ['../../Flatpickr.rozie'],
  },
  {
    key: 'bundle/LeafletMapDemo',
    label: 'bundle/LeafletMapDemo',
    entryGlobPath: '../../LeafletMapDemo.rozie',
    dependencyGlobPaths: ['../../LeafletMap.rozie'],
  },
  {
    key: 'bundle/LineChartDemo',
    label: 'bundle/LineChartDemo',
    entryGlobPath: '../../LineChartDemo.rozie',
    dependencyGlobPaths: ['../../LineChart.rozie'],
  },
];

function bundleSnippetFromDecl(decl: BundleDecl): Snippet | null {
  const entrySource = exampleFiles[decl.entryGlobPath];
  if (entrySource === undefined) return null;
  const files: Record<string, string> = {
    [filenameFromGlob(decl.entryGlobPath)]: entrySource,
  };
  for (const depPath of decl.dependencyGlobPaths) {
    const depSource = exampleFiles[depPath];
    if (depSource === undefined) {
      // Missing dependency — skip the bundle rather than emit a half-broken one.
      return null;
    }
    files[filenameFromGlob(depPath)] = depSource;
  }
  return {
    key: decl.key,
    label: decl.label,
    entry: filenameFromGlob(decl.entryGlobPath),
    files,
  };
}

const bundles: Snippet[] = BUNDLE_DECLS.map(bundleSnippetFromDecl).filter(
  (b): b is Snippet => b !== null,
);

// Files claimed by a multi-file bundle (either as entry or dependency) are
// SKIPPED from the single-file list so they don't show up twice — the bundle
// is the canonical entry point that exercises composition.
const claimedGlobPaths = new Set<string>(
  BUNDLE_DECLS.flatMap((d) => [d.entryGlobPath, ...d.dependencyGlobPaths]),
);

const singleFileEntries = (
  map: Record<string, string>,
  prefix: string,
): Snippet[] =>
  Object.entries(map)
    .filter(([path]) => !claimedGlobPaths.has(path))
    .map(([path, source]) => singleFileSnippet(path, source, prefix))
    .sort((a, b) => a.label.localeCompare(b.label));

export const SNIPPETS: Snippet[] = [
  {
    key: 'spike/Sortable',
    label: 'spike/Sortable',
    entry: 'Sortable.rozie',
    files: { 'Sortable.rozie': sortableSpike },
  },
  ...bundles,
  ...singleFileEntries(exampleFiles, ''),
  ...singleFileEntries(demoFiles, 'demos'),
];

export const DEFAULT_SNIPPET_KEY = 'spike/Sortable';

export function findSnippet(key: string): Snippet | undefined {
  return SNIPPETS.find((s) => s.key === key);
}
