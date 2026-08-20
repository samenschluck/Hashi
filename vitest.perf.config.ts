import { defineConfig } from 'vitest/config';

// Eigene Konfiguration fuer Laufzeitmessungen. Diese Tests laufen nicht im
// Standard-Testlauf, weil sie deutlich laenger dauern und auf geteilten
// CI-Runnern anfaelliger fuer Ausreisser sind.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.perf.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    // Messungen duerfen sich keine CPU teilen, sonst sind die Zahlen wertlos.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
