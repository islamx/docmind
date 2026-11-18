import { defineConfig } from 'vitest/config';

/** Server-side function tests: plain Node, no DOM, no Angular builder. */
export default defineConfig({
  test: { include: ['api/**/*.spec.ts'], environment: 'node', globals: true },
});
