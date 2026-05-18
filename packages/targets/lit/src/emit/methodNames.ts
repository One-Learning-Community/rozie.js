import * as bt from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';

export function collectMethodNamesFromIR(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  const reserved = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...ir.computed.map((c) => c.name),
    ...ir.refs.map((r) => r.name),
    ...ir.props.map((p) => p.name),
  ]);
  // Tolerate IRs constructed without a parsed <script> block (unit-test
  // fixtures pass `scriptProgram: null as never`). Real compilation always
  // produces a populated scriptProgram via parseScript.
  const program = ir.setupBody?.scriptProgram?.program;
  if (!program) return names;
  for (const stmt of program.body) {
    if (bt.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (bt.isIdentifier(decl.id) && !reserved.has(decl.id.name)) {
          if (
            decl.init &&
            bt.isCallExpression(decl.init) &&
            bt.isIdentifier(decl.init.callee) &&
            decl.init.callee.name === '$computed'
          ) {
            continue;
          }
          if (
            decl.init &&
            (bt.isArrowFunctionExpression(decl.init) ||
              bt.isFunctionExpression(decl.init))
          ) {
            names.add(decl.id.name);
          }
        }
      }
    } else if (bt.isFunctionDeclaration(stmt) && stmt.id && !reserved.has(stmt.id.name)) {
      names.add(stmt.id.name);
    }
  }
  return names;
}
