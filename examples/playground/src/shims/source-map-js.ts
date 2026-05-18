// Browser shim for `source-map-js`. Postcss destructures
// `SourceMapConsumer` and `SourceMapGenerator` at the top of three of its
// modules (previous-map.js, map-generator.js, input.js). The playground
// passes `sourceMap: false` to @rozie/core so neither class is ever
// instantiated — the named bindings just have to resolve.

export class SourceMapConsumer {
  constructor(_input?: unknown) {
    throw new Error('[playground shim] source-map-js.SourceMapConsumer instantiated in browser');
  }
}

export class SourceMapGenerator {
  constructor(_opts?: unknown) {
    throw new Error('[playground shim] source-map-js.SourceMapGenerator instantiated in browser');
  }
}

export default { SourceMapConsumer, SourceMapGenerator };
