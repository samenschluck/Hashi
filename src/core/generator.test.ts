import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, DIFFICULTIES, MAX_ISLAND_VALUE } from '../config/game.ts';
import { classifyDifficulty } from './difficulty.ts';
import { buildBoard } from './geometry.ts';
import { generate, tryGenerate } from './generator.ts';
import { isValidSolution, solve } from './solver.ts';

/**
 * Kernaussage dieses Tests: jedes ausgelieferte Raetsel hat genau eine Loesung.
 * Ohne diese Garantie ist das Tipp-System wertlos, weil es keinen eindeutig
 * richtigen naechsten Zug gaebe.
 *
 * Der Umfang ist bewusst hoch (200 Raetsel je Grad) — die Eindeutigkeit ist die
 * eine Eigenschaft, bei der eine Stichprobe von zehn Stueck nichts beweist.
 */
const SAMPLE_SIZE = 200;

describe('Generator', () => {
  it('erzeugt zum selben Seed dasselbe Raetsel', () => {
    const first = generate('reproduzierbar', 'medium');
    const second = generate('reproduzierbar', 'medium');

    expect(second.islands).toEqual(first.islands);
    expect(second.solution).toEqual(first.solution);
  });

  it('erzeugt zu verschiedenen Seeds verschiedene Raetsel', () => {
    const first = generate('seed-a', 'medium');
    const second = generate('seed-b', 'medium');
    expect(second.islands).not.toEqual(first.islands);
  });

  it.each([...DIFFICULTIES])(
    'erzeugt %s-Raetsel mit garantiert eindeutiger Loesung',
    { timeout: 120_000 },
    (difficulty) => {
      const size = BOARD_SIZE[difficulty];

      for (let index = 0; index < SAMPLE_SIZE; index++) {
        const puzzle = tryGenerate(`einzigartig-${difficulty}#${String(index)}`, difficulty);
        expect(puzzle, `Seed ${String(index)} lieferte kein Raetsel`).not.toBeNull();

        const board = buildBoard(puzzle!.width, puzzle!.height, puzzle!.islands);

        // Die mitgelieferte Loesung muss gueltig sein …
        expect(
          isValidSolution(board, puzzle!.solution),
          `Seed ${String(index)}: mitgelieferte Loesung ist ungueltig`,
        ).toBe(true);

        // … und es darf keine zweite geben.
        const result = solve(board, { maxSolutions: 2 });
        expect(result.count, `Seed ${String(index)}: Loesungsanzahl`).toBe(1);
        expect([...result.solutions[0]!]).toEqual([...puzzle!.solution]);

        // Groesse und Einstufung muessen zum angeforderten Grad passen.
        expect(puzzle!.width).toBe(size);
        expect(puzzle!.height).toBe(size);
        expect(classifyDifficulty(board)).toBe(difficulty);

        for (const island of puzzle!.islands) {
          expect(island.required).toBeGreaterThanOrEqual(1);
          expect(island.required).toBeLessThanOrEqual(MAX_ISLAND_VALUE);
        }
      }
    },
  );

  it('meldet einen Fehler, wenn das Versuchsbudget nicht reicht', () => {
    expect(() => generate('unmoeglich', 'expert', { maxAttempts: 0 })).toThrow(/Versuchsbudget/);
  });
});
