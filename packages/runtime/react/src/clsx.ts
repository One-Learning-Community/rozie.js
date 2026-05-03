/**
 * `clsx` re-export from the upstream `clsx` package.
 *
 * Provided here so emitted .tsx files import a single runtime package
 * (`@rozie/runtime-react`) rather than mixing `@rozie/runtime-react` for
 * hooks and `clsx` for class composition. Keeps the import surface tidy and
 * leaves room for future swapping to a smaller alternative without a
 * consumer-facing API change.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
export { default as clsx } from 'clsx';
