// @rozie/runtime-react test setup — Plan 04-04 P3.
// Cleanup react-testing-library mounts between tests so DOM doesn't leak
// (and document-level listeners attached by useOutsideClick get torn down).
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
