import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../config/game.ts';
import { buildBoard } from './geometry.ts';
import { generate } from './generator.ts';
import { findHint, isSubsetOfSolution } from './hint.ts';
import { parseBoard } from './parse.ts';
import { PuzzleState } from './puzzleState.ts';
import { solve } from './solver.ts';
import type { BridgeCount } from './types.ts';

describe('Tipp-System', () => {
  it('nennt den naechsten zwingenden Zug mit Begruendung', () => {
    // Die 4 in der Mitte hat nur zwei Nachbarn, also fuehren zu beiden zwei Bruecken.
    const board = parseBoard('2...4...2');
    const solution = solve(board).solutions[0]!;
    const hint = findHint(board, new Uint8Array(board.edges.length), solution);

    expect(hint.kind).toBe('placement');
    expect(hint.value).toBe(2);
    expect(hint.ruleId).toBe('D2_FORCED_ALL');
    expect(hint.messageKey).toBe('hint.rule.D2_FORCED_ALL');
    expect(hint.islandId).not.toBeNull();
  });

  it('zeigt eine falsch gesetzte Bruecke statt ins Leere zu laufen', () => {
    // Ohne Verlierbedingung kann der Spieler jederzeit in eine falsche Stellung
    // laufen. Genau dann muss der Tipp auf den Fehler zeigen.
    const board = parseBoard(`
      1.1
      ...
      2.2
    `);
    const solution = solve(board).solutions[0]!;

    const wrongEdge = board.edges.find(
      (edge) => board.islands[edge.a]!.required === 1 && board.islands[edge.b]!.required === 1,
    )!;
    const counts = new Uint8Array(board.edges.length);
    counts[wrongEdge.id] = 1;

    expect(isSubsetOfSolution(counts, solution)).toBe(false);

    const hint = findHint(board, counts, solution);
    expect(hint.kind).toBe('removeWrong');
    expect(hint.edgeId).toBe(wrongEdge.id);
    expect(hint.value).toBe(0);
    expect(hint.messageKey).toBe('hint.removeWrong');
  });

  it('meldet ein bereits geloestes Raetsel', () => {
    const board = parseBoard('2...2');
    const solution = solve(board).solutions[0]!;
    expect(findHint(board, solution, solution).kind).toBe('solved');
  });

  it.each([...DIFFICULTIES])(
    'fuehrt ein %s-Raetsel allein durch Tipps bis zur Loesung',
    (difficulty) => {
      // Der schaerfste Test fuer das Tipp-System: es muss aus jeder erreichten
      // Zwischenstellung weiterkommen, sonst haengt der Spieler fest.
      const puzzle = generate(`tipps-${difficulty}`, difficulty);
      const board = buildBoard(puzzle.width, puzzle.height, puzzle.islands);
      const state = new PuzzleState(board);

      let steps = 0;
      const limit = board.edges.length * 3;

      while (!state.isSolved() && steps < limit) {
        const hint = findHint(board, state.bridgeCounts, puzzle.solution);
        expect(hint.kind).toBe('placement');
        expect(hint.edgeId).not.toBeNull();

        // Ein Tipp deckt nie mehr auf als bewiesen ist: der genannte Wert ist die
        // sichere Untergrenze, liegt also nie ueber der Loesung — und bringt den
        // Spielstand trotzdem immer einen Schritt weiter.
        expect(hint.value!).toBeLessThanOrEqual(puzzle.solution[hint.edgeId!]!);
        expect(hint.value!).toBeGreaterThan(state.getCount(hint.edgeId!));

        state.set(hint.edgeId!, hint.value as BridgeCount);
        steps++;
      }

      expect(state.isSolved()).toBe(true);
    },
  );

  it('begruendet die allermeisten Tipps mit einer benannten Regel', () => {
    const puzzle = generate('begruendung', 'medium');
    const board = buildBoard(puzzle.width, puzzle.height, puzzle.islands);
    const state = new PuzzleState(board);

    let withRule = 0;
    let total = 0;

    while (!state.isSolved()) {
      const hint = findHint(board, state.bridgeCounts, puzzle.solution);
      if (hint.kind !== 'placement') {
        break;
      }
      total++;
      if (hint.ruleId !== null) {
        withRule++;
      }
      state.set(hint.edgeId!, hint.value as BridgeCount);
    }

    expect(total).toBeGreaterThan(0);
    expect(withRule).toBe(total);
  });
});
