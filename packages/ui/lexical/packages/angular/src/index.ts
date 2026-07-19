// Public barrel for @rozie-ui/lexical-angular — the ng-packagr entryFile.
// Exports the editor shell + the four Lexical plugins + the selection-reading
// toolbar, plus the framework-neutral @mention DecoratorNode and its
// $create/$is helpers (D-07) for consumers inserting mentions. The internal
// `mountDecorators` bridge is wired by the shell and stays out of the public API.
export * from './LexicalEditor';
export * from './RichTextPlugin';
export * from './HistoryPlugin';
export * from './ListPlugin';
export * from './LinkPlugin';
export * from './Toolbar';
export * from './MentionNode';
