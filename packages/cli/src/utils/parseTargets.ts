// parseTargets — D-87 commander parser for comma-separated `--target`.
//
// `--target react,vue` → ['react', 'vue']. Unknown tokens raise a commander
// `InvalidArgumentError` which becomes a clean exit 1 with a stderr message
// rather than a stack trace. The ROZ850 prefix lets the consumer grep CI logs
// for the stable diagnostic code.
import { InvalidArgumentError } from 'commander';

export type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';

export const VALID_TARGETS = new Set<Target>(['vue', 'react', 'svelte', 'angular', 'solid', 'lit']);

/**
 * Parse the `--target` flag value as a comma-separated list of valid targets.
 * Whitespace around each token is trimmed.
 *
 * @throws InvalidArgumentError on any unknown token (commander surfaces this
 *         as exit 1 with stderr `error: option '-t, --target ...' argument
 *         '...' is invalid. [ROZ850] unknown target ...`)
 */
export function parseTargets(value: string): Target[] {
  const tokens = value.split(',').map((t) => t.trim());
  for (const t of tokens) {
    if (!VALID_TARGETS.has(t as Target)) {
      throw new InvalidArgumentError(
        `[ROZ850] unknown target '${t}' (expected vue|react|svelte|angular|solid|lit)`,
      );
    }
  }
  return tokens as Target[];
}
