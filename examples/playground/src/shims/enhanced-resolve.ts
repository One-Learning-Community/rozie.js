// Browser shim for `enhanced-resolve`. @rozie/core constructs a Resolver
// eagerly in `ProducerResolver`'s constructor (dist:6389) even when no
// cross-file imports exist — so a throw-on-call empty stub kills the compile.
//
// The shim provides the `ResolverFactory.createResolver()` shape and returns
// a resolver whose `resolveSync` always throws. @rozie/core's `tryResolveSync`
// wrapper catches the throw and returns null (= "not found"), which the
// caller treats as a benign no-match. The playground compiles single-buffer
// IR that never contains `<components>` cross-imports, so this branch never
// fires in practice — the shim only has to satisfy module-load + constructor
// shape.

function failingResolveSync(): never {
  throw new Error('[playground shim] enhanced-resolve.resolveSync called in browser');
}

const stubResolver = {
  resolveSync: failingResolveSync,
};

export const ResolverFactory = {
  createResolver(): typeof stubResolver {
    return stubResolver;
  },
};

export default { ResolverFactory };
