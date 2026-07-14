import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 18+ provides fetch/Request/Response globally, which is all the
    // worker handler needs to run under test.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The worker keeps a module-level rate-limit map, so files must not share
    // a process or that state leaks between suites.
    isolate: true,
  },
});
