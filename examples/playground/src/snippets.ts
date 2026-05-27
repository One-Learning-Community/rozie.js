// All .rozie snippets the playground exposes in its picker dropdown.
//
// A snippet is a "bundle" — one or more .rozie files keyed by their virtual
// filename. Single-file snippets have one entry whose key matches `entry`.
// Multi-file snippets (e.g. SortableListDemo, which imports SortableList via a
// <components> block) carry the dependency in `files` so the playground's
// virtual-filesystem resolver can satisfy cross-file <components> imports
// without ever touching the real filesystem (the browser doesn't have one).
//
// Sourced from two places:
//   1. examples/*.rozie — top-level reference components (Counter, Modal, etc.)
//   2. examples/demos/*.rozie — composed-feature demos (DropdownDemo, ...)
//
// Multi-file bundles are registered explicitly below — each declares its
// entry file plus every sibling .rozie it imports.

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

// examples/match/*.rozie — the r-match feature-probe fixtures. These are
// covered by NEITHER the examples/*.rozie nor examples/demos/*.rozie glob
// (they live in a subdirectory). They are feature probes with verbose header
// comments rather than reference components, so they are NOT surfaced
// wholesale — exactly one is registered explicitly below (MATCH_SNIPPET_PATH)
// to give the playground an r-match demo without cluttering the picker.
const matchFiles = import.meta.glob('../../match/*.rozie', {
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
    entryGlobPath: '../../demos/SortableListDemo.rozie',
    dependencyGlobPaths: ['../../SortableList.rozie'],
  },
  {
    // SortableListPairDemo — two SortableList instances sharing a group;
    // drag between to move items, both bound arrays update via SortableList's
    // onAdd / onRemove cluster + module-level transfer slot.
    key: 'bundle/SortableListPairDemo',
    label: 'bundle/SortableListPairDemo',
    entryGlobPath: '../../demos/SortableListPairDemo.rozie',
    dependencyGlobPaths: ['../../SortableList.rozie'],
  },
  {
    // SortableListNestedDemo — Kanban-style board. Outer SortableList of
    // columns hosts inner KanbanColumn wrappers, each owning its own
    // SortableList of cards. Outer + inner use distinct groups so column
    // reorder and card reorder don't bleed into each other.
    key: 'bundle/SortableListNestedDemo',
    label: 'bundle/SortableListNestedDemo',
    entryGlobPath: '../../demos/SortableListNestedDemo.rozie',
    dependencyGlobPaths: [
      '../../SortableList.rozie',
      '../../KanbanColumn.rozie',
    ],
  },
  {
    // SortableListCloneDemo — palette → canvas clone-mode showcase. Two
    // SortableList instances sharing `group="palette-canvas"`; the palette
    // uses the new `cloneable: true` prop so drags deposit copies on the
    // canvas while leaving the palette intact.
    key: 'bundle/SortableListCloneDemo',
    label: 'bundle/SortableListCloneDemo',
    entryGlobPath: '../../demos/SortableListCloneDemo.rozie',
    dependencyGlobPaths: ['../../SortableList.rozie'],
  },
  {
    // SortableListFilterDemo — SortableJS `filter` selector demo. Locked
    // rows render with 🔒 + a `[data-locked]` attribute; the `filter`
    // prop prevents drag initiation on matching rows.
    key: 'bundle/SortableListFilterDemo',
    label: 'bundle/SortableListFilterDemo',
    entryGlobPath: '../../demos/SortableListFilterDemo.rozie',
    dependencyGlobPaths: ['../../SortableList.rozie'],
  },
  {
    // SortableListShowcaseDemo — the marquee piece. Live-tunable
    // SortableList with every prop exposed via a control panel; uses
    // `:key="`${$data.forceFallback}-${$data.cloneable}-${$data.swapThreshold}`"`
    // to remount on construction-time-only knob changes.
    key: 'bundle/SortableListShowcaseDemo',
    label: 'bundle/SortableListShowcaseDemo',
    entryGlobPath: '../../demos/SortableListShowcaseDemo.rozie',
    dependencyGlobPaths: ['../../SortableList.rozie'],
  },
  {
    key: 'bundle/FlatpickrDemo',
    label: 'bundle/FlatpickrDemo',
    entryGlobPath: '../../demos/FlatpickrDemo.rozie',
    dependencyGlobPaths: ['../../Flatpickr.rozie'],
  },
  {
    key: 'bundle/LeafletMapDemo',
    label: 'bundle/LeafletMapDemo',
    entryGlobPath: '../../demos/LeafletMapDemo.rozie',
    dependencyGlobPaths: ['../../LeafletMap.rozie'],
  },
  {
    key: 'bundle/LineChartDemo',
    label: 'bundle/LineChartDemo',
    entryGlobPath: '../../demos/LineChartDemo.rozie',
    dependencyGlobPaths: ['../../LineChart.rozie'],
  },
  {
    key: 'bundle/TipTapDemo',
    label: 'bundle/TipTapDemo',
    entryGlobPath: '../../demos/TipTapDemo.rozie',
    dependencyGlobPaths: ['../../TipTap.rozie'],
  },
  {
    key: 'bundle/UppyDemo',
    label: 'bundle/UppyDemo',
    entryGlobPath: '../../demos/UppyDemo.rozie',
    dependencyGlobPaths: ['../../Uppy.rozie'],
  },
  {
    key: 'bundle/FullCalendarDemo',
    label: 'bundle/FullCalendarDemo',
    entryGlobPath: '../../demos/FullCalendarDemo.rozie',
    dependencyGlobPaths: ['../../FullCalendar.rozie'],
  },
];

// Bundle entry/dep paths can resolve against either glob root: top-level
// `examples/*.rozie` (the original convention) OR `examples/demos/*.rozie`
// (the VR-rig convention for demo wrappers that import a sibling
// `<components>` engine). Look up against both maps so a bundle whose
// entry lives under demos/ — like FullCalendarDemo and LineChartDemo —
// resolves regardless of where future demos land.
function lookupRozieSource(path: string): string | undefined {
  return exampleFiles[path] ?? demoFiles[path];
}

function bundleSnippetFromDecl(decl: BundleDecl): Snippet | null {
  const entrySource = lookupRozieSource(decl.entryGlobPath);
  if (entrySource === undefined) return null;
  const files: Record<string, string> = {
    [filenameFromGlob(decl.entryGlobPath)]: entrySource,
  };
  for (const depPath of decl.dependencyGlobPaths) {
    const depSource = lookupRozieSource(depPath);
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

// One explicitly-registered r-match snippet, sourced from a real
// examples/match/*.rozie feature-probe fixture. CommaAlternatives is the
// clearest single-file demonstration of the construct (discriminant +
// comma-alternative r-case + r-default). The other match/ probes are not
// surfaced — they exist for the compile/snapshot matrix, not the picker.
const MATCH_SNIPPET_PATH = '../../match/CommaAlternatives.rozie';

const matchSnippets: Snippet[] = (() => {
  const source = matchFiles[MATCH_SNIPPET_PATH];
  if (source === undefined) return [];
  return [singleFileSnippet(MATCH_SNIPPET_PATH, source, 'match')];
})();

export const SNIPPETS: Snippet[] = [
  ...bundles,
  ...singleFileEntries(exampleFiles, ''),
  ...singleFileEntries(demoFiles, 'demos'),
  ...matchSnippets,
];

export const DEFAULT_SNIPPET_KEY = 'bundle/SortableListDemo';

export function findSnippet(key: string): Snippet | undefined {
  return SNIPPETS.find((s) => s.key === key);
}
