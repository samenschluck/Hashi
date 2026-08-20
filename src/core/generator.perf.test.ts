import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../config/game.ts';
import { generate } from './generator.ts';

/**
 * Laufzeitmessung der Generierung.
 *
 * Bewusst als Median statt als harte Einzelwertgrenze: auf geteilten CI-Runnern
 * schwankt eine einzelne Messung um ein Vielfaches, eine harte Grenze wuerde
 * zufaellig rot werden und damit wertlos. Der Median beschreibt, was der Spieler
 * tatsaechlich erlebt; der p95 sichert nach oben ab.
 *
 * Diese Datei laeuft nicht im Standard-Testlauf, sondern ueber `npm run test:perf`.
 */
const RUNS = 30;
const MEDIAN_BUDGET_MS = 500;
const P95_BUDGET_MS = 1500;

function quantile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index]!;
}

describe('Generierungszeit', () => {
  it.each([...DIFFICULTIES])('bleibt fuer %s im Budget', { timeout: 300_000 }, (difficulty) => {
    const durations: number[] = [];

    for (let index = 0; index < RUNS; index++) {
      const start = performance.now();
      generate(`perf-${difficulty}#${String(index)}`, difficulty);
      durations.push(performance.now() - start);
    }

    durations.sort((left, right) => left - right);
    const median = quantile(durations, 0.5);
    const p95 = quantile(durations, 0.95);

    console.info(
      `${difficulty}: Median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, Max ${durations.at(-1)!.toFixed(1)} ms`,
    );

    expect(median).toBeLessThan(MEDIAN_BUDGET_MS);
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
