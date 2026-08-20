import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../config/game.ts';
import { buildBoard } from './geometry.ts';
import { generate } from './generator.ts';
import { packPuzzle, unpackPuzzle } from './serialization.ts';
import { isValidSolution } from './solver.ts';

describe('Raetsel packen und entpacken', () => {
  it.each([...DIFFICULTIES])('erhaelt ein %s-Raetsel unveraendert', (difficulty) => {
    const original = generate(`pack-${difficulty}`, difficulty);
    const restored = unpackPuzzle(packPuzzle(original), difficulty, original.width);

    expect(restored.islands).toEqual(original.islands);
    expect(restored.solution).toEqual(original.solution);
    expect(restored.width).toBe(original.width);

    // Entscheidend: die Kantenreihenfolge muss nach dem Entpacken dieselbe sein,
    // sonst zeigt die gespeicherte Loesung auf die falschen Kanten.
    const board = buildBoard(restored.width, restored.height, restored.islands);
    expect(isValidSolution(board, restored.solution)).toBe(true);
  });

  it('meldet unvollstaendige Inseldaten', () => {
    expect(() =>
      unpackPuzzle({ id: 'x', seed: 'x', islands: [0, 0], solution: '' }, 'easy', 7),
    ).toThrow(/unvollstaendig/);
  });

  it('meldet einen ungueltigen Brueckenwert', () => {
    expect(() =>
      unpackPuzzle({ id: 'x', seed: 'x', islands: [0, 0, 2, 2, 0, 2], solution: '5' }, 'easy', 7),
    ).toThrow(/Ungueltiger Brueckenwert/);
  });
});
