// @rozie/target-react test setup — Plan 04-04 populates with
// @testing-library/react cleanup hooks so DOM doesn't leak between tests.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
