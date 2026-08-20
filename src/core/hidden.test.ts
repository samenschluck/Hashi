import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../config/game.ts';
import { ConstraintStore } from './deductions.ts';
import { boardFromPuzzle, buildBoard } from './geometry.ts';
import { tryGenerate } from './generator.ts';
import { parseBoard } from './parse.ts';
import { isValidSolution, solve } from './solver.ts';
import { PuzzleState } from './puzzleState.ts';

describe('Inseln mit verborgener Zahl', () => {
  it('liest und schreibt sie im ASCII-Format', () => {
    const board = parseBoard(`
      c.2
      ...
      1.1
    `);
    const hiddenIsland = board.islands.find((island) => island.hidden);
    expect(hiddenIsland).toBeDefined();
    expect(hiddenIsland!.required).toBe(3);
    expect(board.hidden[hiddenIsland!.id]).toBe(1);
  });

  it('behandelt die verborgene Zahl nicht als Bedingung', () => {
    // Die Insel oben links ist in Wahrheit eine 2. Verborgen zaehlt nur noch,
    // dass ueberhaupt eine Bruecke an ihr haengt.
    const board = parseBoard(`
      b.1
      ...
      1..
    `);
    const counts = new Uint8Array(board.edges.length);
    for (const edge of board.edges) {
      counts[edge.id] = 1;
    }

    expect(isValidSolution(board, counts)).toBe(true);

    // Ohne Bruecke ist die verborgene Insel dagegen nicht erfuellt: der Rest
    // des Feldes waere von ihr abgeschnitten.
    const empty = new Uint8Array(board.edges.length);
    expect(isValidSolution(board, empty)).toBe(false);
  });

  it('leitet an einer verborgenen Insel nichts aus dem Inselgrad ab', () => {
    const sichtbar = parseBoard(`
      4.2
      ...
      2..
    `);
    const verborgen = parseBoard(`
      d.2
      ...
      2..
    `);

    const mitZahl = new ConstraintStore(sichtbar);
    mitZahl.propagate(1);
    // Eine 4 mit zwei Nachbarn erzwingt beide Doppelbruecken.
    expect(mitZahl.usageOf('D2_FORCED_ALL')).toBeGreaterThan(0);

    const ohneZahl = new ConstraintStore(verborgen);
    ohneZahl.propagate(1);
    for (const edge of verborgen.edges) {
      const beruehrtVerborgene = verborgen.hidden[edge.a] === 1 || verborgen.hidden[edge.b] === 1;
      if (beruehrtVerborgene) {
        // Von der verborgenen Seite kommt keine Einschraenkung.
        expect(ohneZahl.upperBound(edge.id)).toBe(2);
      }
    }
  });

  it('gilt im Spielstand als erfuellt, sobald eine Bruecke anliegt', () => {
    const board = parseBoard(`
      b.1
      ...
      1..
    `);
    const state = new PuzzleState(board);
    const hiddenId = board.islands.findIndex((island) => island.hidden);

    expect(state.islandStatus(hiddenId)).toBe('open');
    for (const edge of board.edges) {
      state.set(edge.id, 1);
    }
    expect(state.allIslandsSatisfied()).toBe(true);
    // Eine verborgene Insel faerbt sich nie ein — das waere ein Hinweis auf ihre Zahl.
    expect(state.islandStatus(hiddenId)).toBe('open');
  });

  it('verdeckt nie so, dass das Raetsel mehrdeutig wird', () => {
    // Der gefaehrlichste Fehler bei dieser Erweiterung: Verdecken entfernt eine
    // Bedingung und kann dadurch zusaetzliche Loesungen eroeffnen. Der Generator
    // muss deshalb nach jedem Verdecken neu zaehlen.
    for (const difficulty of DIFFICULTIES) {
      const puzzle = tryGenerate(`hidden-unique-${difficulty}`, difficulty);
      expect(puzzle).not.toBeNull();

      const board = boardFromPuzzle(puzzle!);
      expect(solve(board, { maxSolutions: 2 }).count).toBe(1);
      expect(isValidSolution(board, puzzle!.solution)).toBe(true);
    }
  });

  it('wird mehrdeutig, wenn man von Hand die falsche Insel verdeckt', () => {
    // Gegenprobe zum Test darueber: dass die Pruefung ueberhaupt etwas faengt.
    const sichtbar = buildBoard(1, 5, [
      { x: 0, y: 0, required: 1 },
      { x: 0, y: 2, required: 2 },
      { x: 0, y: 4, required: 1 },
    ]);
    expect(solve(sichtbar, { maxSolutions: 3 }).count).toBe(1);

    const verborgen = buildBoard(1, 5, [
      { x: 0, y: 0, required: 1 },
      { x: 0, y: 2, required: 2, hidden: true },
      { x: 0, y: 4, required: 1 },
    ]);
    // Ohne die 2 in der Mitte ist auch „je eine Doppelbruecke" keine Loesung
    // mehr, wohl aber jede Kombination, die die Einsen erfuellt — hier bleibt
    // es zufaellig eindeutig, weil die Einsen alles festlegen.
    expect(solve(verborgen, { maxSolutions: 3 }).count).toBe(1);

    const beideVerborgen = buildBoard(1, 5, [
      { x: 0, y: 0, required: 1, hidden: true },
      { x: 0, y: 2, required: 2, hidden: true },
      { x: 0, y: 4, required: 1 },
    ]);
    // Jetzt ist die obere Verbindung nicht mehr festgelegt: eine oder zwei
    // Bruecken sind beide zulaessig.
    expect(solve(beideVerborgen, { maxSolutions: 3 }).count).toBeGreaterThan(1);
  });
});
