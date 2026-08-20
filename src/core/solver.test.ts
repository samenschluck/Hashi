import { describe, expect, it } from 'vitest';
import { ConstraintStore } from './deductions.ts';
import { requiredDeductionLevel } from './difficulty.ts';
import { parseBoard } from './parse.ts';
import { countSolutions, hasUniqueSolution, isValidSolution, solve } from './solver.ts';

describe('Solver auf handgeschriebenen Boards', () => {
  it('loest den einfachsten Fall: zwei Inseln, eine Doppelbruecke', () => {
    const board = parseBoard('2...2');
    const result = solve(board);

    expect(result.count).toBe(1);
    expect([...result.solutions[0]!]).toEqual([2]);
  });

  it('erzwingt den Ring statt zweier getrennter Doppelbruecken', () => {
    // Ueber die Inselzahlen allein waeren zwei waagerechte Doppelbruecken moeglich.
    // Nur die Zusammenhangsbedingung schliesst das aus.
    const board = parseBoard(`
      2.2
      ...
      2.2
    `);
    const result = solve(board);

    expect(result.count).toBe(1);
    expect([...result.solutions[0]!]).toEqual([1, 1, 1, 1]);
    expect(requiredDeductionLevel(board)).toBe(2);
  });

  it('erkennt ein Board ohne Loesung, wenn sich die einzigen Bruecken kreuzen wuerden', () => {
    const board = parseBoard(`
      .1.
      1.1
      .1.
    `);
    expect(solve(board).count).toBe(0);
  });

  it('erkennt ein Board ohne Loesung bei ungerader Summe der Inselwerte', () => {
    // Jede Bruecke steuert zwei Brueckenenden bei — eine ungerade Summe ist unmoeglich.
    const board = parseBoard('1...1...1');
    expect(solve(board).count).toBe(0);
  });

  it('findet genau zwei Loesungen und bricht dort ab', () => {
    // Dieses Board hat nachweislich zwei gueltige Loesungen: die Kante zwischen
    // der 3 und der 4 kann einfach oder doppelt sein, der Rest gleicht das aus.
    const board = parseBoard(`
      ......1
      .......
      1..3..2
      .......
      3..4...
      .......
      1..1...
    `);

    const result = solve(board, { maxSolutions: 5 });
    expect(result.count).toBe(2);

    for (const solution of result.solutions) {
      expect(isValidSolution(board, solution)).toBe(true);
    }
    expect([...result.solutions[0]!]).not.toEqual([...result.solutions[1]!]);

    // Fuer die Eindeutigkeitspruefung reicht der Abbruch bei zwei Loesungen.
    expect(countSolutions(board, 2)).toBe(2);
    expect(hasUniqueSolution(board)).toBe(false);
  });

  it('liefert unabhaengig von der Deduktionstiefe dasselbe Ergebnis', () => {
    const board = parseBoard(`
      2.3.2
      .....
      .....
      .....
      2.3.2
    `);
    const counts = [1, 2, 3, 4].map(
      (level) => solve(board, { level: level as 1 | 2 | 3 | 4, maxSolutions: 5 }).count,
    );
    expect(new Set(counts).size).toBe(1);
  });
});

describe('isValidSolution', () => {
  const board = parseBoard(`
    2.2
    ...
    2.2
  `);

  it('weist eine Belegung mit zwei getrennten Netzen zurueck', () => {
    const counts = new Uint8Array(board.edges.length);
    for (const edge of board.edges) {
      // Nur die waagerechten Kanten doppelt: Zahlen stimmen, Netz zerfaellt.
      counts[edge.id] = edge.horizontal ? 2 : 0;
    }
    expect(counts.reduce<number>((sum, value) => sum + value, 0)).toBe(4);
    expect(isValidSolution(board, counts)).toBe(false);
  });

  it('weist eine Belegung mit kreuzenden Bruecken zurueck', () => {
    const crossBoard = parseBoard(`
      .2.
      2.2
      .2.
    `);
    const counts = new Uint8Array(crossBoard.edges.length).fill(1);
    expect(isValidSolution(crossBoard, counts)).toBe(false);
  });
});

describe('Deduktionsregeln', () => {
  it('D2: eine Insel, deren Bedarf die Restkapazitaet ausschoepft, erzwingt alle Kanten', () => {
    // Die 4 in der Mitte hat genau zwei Nachbarn, also fuehren zu beiden zwei Bruecken.
    const board = parseBoard('2...4...2');
    const store = new ConstraintStore(board);
    store.beginRecordingPlacements();
    const result = store.propagate(1, true);

    expect(result.status).toBe('ok');
    expect(result.firstPlacement).not.toBeNull();
    expect(result.firstPlacement!.value).toBe(2);
    expect(result.firstPlacement!.ruleId).toBe('D2_FORCED_ALL');
  });

  it('D5: zwei benachbarte Einsen duerfen sich nicht verbinden, solange andere Inseln offen sind', () => {
    // Klassischer 1–1-Fall: die Verbindung der beiden Einsen waere sofort
    // abgeschlossen und der Rest des Feldes abgehaengt.
    const board = parseBoard(`
      1.1
      ...
      2.2
    `);
    const store = new ConstraintStore(board);
    store.propagate(2);

    const between = board.edges.find(
      (edge) => board.islands[edge.a]!.required === 1 && board.islands[edge.b]!.required === 1,
    );
    expect(between).toBeDefined();
    expect(store.upperBound(between!.id)).toBe(0);
    expect(store.usageOf('D5_NO_ISOLATION')).toBeGreaterThan(0);

    // Ohne die Isolationsregel bliebe die Kante offen — sie ist hier der Schluessel.
    const basicOnly = new ConstraintStore(board);
    basicOnly.propagate(1);
    expect(basicOnly.upperBound(between!.id)).toBe(1);
  });
});
