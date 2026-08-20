import { describe, expect, it } from 'vitest';
import { findEdge } from './geometry.ts';
import { parseBoard } from './parse.ts';
import { PuzzleState } from './puzzleState.ts';

describe('PuzzleState', () => {
  it('schaltet eine Kante von keiner ueber eine zu zwei Bruecken und zurueck', () => {
    const state = new PuzzleState(parseBoard('2...2'));

    expect(state.getCount(0)).toBe(0);
    state.cycle(0);
    expect(state.getCount(0)).toBe(1);
    state.cycle(0);
    expect(state.getCount(0)).toBe(2);
    state.cycle(0);
    expect(state.getCount(0)).toBe(0);
  });

  it('verhindert kreuzende Bruecken', () => {
    const board = parseBoard(`
      .1.
      1.1
      .1.
    `);
    const state = new PuzzleState(board);
    const horizontal = board.edges.find((edge) => edge.horizontal)!;
    const vertical = board.edges.find((edge) => !edge.horizontal)!;

    expect(state.set(horizontal.id, 1)).not.toBeNull();
    expect(state.isBlocked(vertical.id)).toBe(true);
    expect(state.set(vertical.id, 1)).toBeNull();
    expect(state.getCount(vertical.id)).toBe(0);
  });

  it('erlaubt Ueberfuellung, meldet sie aber als Fehler', () => {
    // Es gibt keine Verlierbedingung: ein falscher Zug wird markiert, nicht verboten.
    const state = new PuzzleState(parseBoard('1...1'));
    state.set(0, 2);

    expect(state.getCount(0)).toBe(2);
    expect(state.islandStatus(0)).toBe('overfilled');
    expect(state.validate()).toEqual([
      { kind: 'overfilled', ref: 0 },
      { kind: 'overfilled', ref: 1 },
    ]);
  });

  it('nimmt Zuege zurueck und stellt sie wieder her', () => {
    const state = new PuzzleState(parseBoard('2...2'));
    state.set(0, 2);
    state.set(0, 1);

    expect(state.canUndo).toBe(true);
    state.undo();
    expect(state.getCount(0)).toBe(2);
    state.undo();
    expect(state.getCount(0)).toBe(0);
    expect(state.canUndo).toBe(false);

    state.redo();
    expect(state.getCount(0)).toBe(2);
    state.redo();
    expect(state.getCount(0)).toBe(1);
    expect(state.canRedo).toBe(false);
  });

  it('verwirft den Redo-Stapel nach einem neuen Zug', () => {
    const state = new PuzzleState(parseBoard('2...2'));
    state.set(0, 2);
    state.undo();
    state.set(0, 1);

    expect(state.canRedo).toBe(false);
    expect(state.getCount(0)).toBe(1);
  });

  it('erkennt die Loesung nur bei erfuellten Zahlen UND einem einzigen Netz', () => {
    const board = parseBoard(`
      1.1
      ...
      1.1
    `);
    const state = new PuzzleState(board);

    const top = findEdge(board, 0, 1)!;
    const bottom = findEdge(board, 2, 3)!;
    state.set(top, 1);
    state.set(bottom, 1);

    // Alle Inselzahlen stimmen — aber es sind zwei getrennte Netze.
    expect(state.allIslandsSatisfied()).toBe(true);
    expect(state.isConnected()).toBe(false);
    expect(state.isSolved()).toBe(false);
  });

  it('erkennt eine korrekte Loesung', () => {
    const board = parseBoard(`
      2.2
      ...
      2.2
    `);
    const state = new PuzzleState(board);
    for (const edge of board.edges) {
      state.set(edge.id, 1);
    }
    expect(state.isSolved()).toBe(true);
  });

  it('stellt einen gespeicherten Stand wieder her', () => {
    const board = parseBoard(`
      2.2
      ...
      2.2
    `);
    const state = new PuzzleState(board);
    state.set(0, 1);
    state.set(1, 2);
    const snapshot = state.snapshot();

    const restored = new PuzzleState(board);
    restored.restore(snapshot);

    expect([...restored.bridgeCounts]).toEqual([...snapshot]);
    expect(restored.degreeOf(0)).toBe(state.degreeOf(0));
    expect(restored.canUndo).toBe(false);
  });

  it('weist einen Stand mit falscher Kantenzahl zurueck', () => {
    const state = new PuzzleState(parseBoard('2...2'));
    expect(() => {
      state.restore([0, 0, 0]);
    }).toThrow(/passt nicht zum Board/);
  });
});
