import { describe, expect, it } from 'vitest';
import { buildBoard, edgeCells, findEdge, otherIsland } from './geometry.ts';
import { parseBoard } from './parse.ts';

describe('buildBoard', () => {
  it('verbindet nur Inseln in derselben Zeile oder Spalte ohne Insel dazwischen', () => {
    const board = parseBoard(`
      2.2.2
      .....
      2...2
    `);

    // (0,0)-(2,0), (2,0)-(4,0), (0,0)-(0,2), (4,0)-(4,2), (0,2)-(4,2)
    expect(board.edges).toHaveLength(5);

    // (0,0) und (4,0) sind nicht verbunden — dazwischen liegt eine Insel.
    const outer = findEdge(board, 0, 2);
    expect(outer).toBeNull();
  });

  it('nummeriert Inseln nach Zeile und dann Spalte', () => {
    const board = parseBoard(`
      1.2
      ...
      3.4
    `);
    expect(board.islands.map((island) => island.required)).toEqual([1, 2, 3, 4]);
    expect(board.islands[0]).toMatchObject({ x: 0, y: 0 });
    expect(board.islands[3]).toMatchObject({ x: 2, y: 2 });
  });

  it('erkennt kreuzende Bruecken', () => {
    const board = parseBoard(`
      .1.
      1.1
      .1.
    `);

    const horizontal = board.edges.find((edge) => edge.horizontal);
    const vertical = board.edges.find((edge) => !edge.horizontal);
    expect(horizontal).toBeDefined();
    expect(vertical).toBeDefined();
    expect(board.crossings[horizontal!.id]).toEqual([vertical!.id]);
    expect(board.crossings[vertical!.id]).toEqual([horizontal!.id]);
  });

  it('meldet direkt aneinandergrenzende Inseln als Fehler', () => {
    expect(() => parseBoard('22')).toThrow(/grenzen direkt aneinander/);
    expect(() =>
      parseBoard(`
        2
        2
      `),
    ).toThrow(/grenzen direkt aneinander/);
  });

  it('unterbricht die Sichtlinie an einer Mauer', () => {
    const ohneMauer = parseBoard('2...2');
    expect(findEdge(ohneMauer, 0, 1)).not.toBeNull();

    const mitMauer = parseBoard('2.#.2');
    expect(mitMauer.edges).toHaveLength(0);
    expect(findEdge(mitMauer, 0, 1)).toBeNull();
  });

  it('sieht hinter einer Mauer keinen Nachbarn, auch nicht den uebernaechsten', () => {
    // Ohne Mauer haengt die mittlere Insel an beiden Nachbarn.
    const offen = parseBoard('1.2.1');
    expect(offen.edges).toHaveLength(2);

    // Mit Mauer bleibt nur die rechte Verbindung — und die linke Insel ist
    // voellig abgeschnitten, statt sich einen Nachbarn dahinter zu suchen.
    const gesperrt = parseBoard(`
      1.2.1
      #....
      1....
    `);
    expect(findEdge(gesperrt, 0, 3)).toBeNull();
  });

  it('laesst keine Insel auf einer Mauer zu', () => {
    expect(() => buildBoard(3, 3, [{ x: 1, y: 1, required: 1 }], [{ x: 1, y: 1 }])).toThrow(
      /gesperrter Zelle/,
    );
    expect(() => buildBoard(3, 3, [], [{ x: 5, y: 0 }])).toThrow(/Mauer ausserhalb/);
  });

  it('weist Inselwerte ausserhalb von 1..8 zurueck', () => {
    expect(() => buildBoard(3, 3, [{ x: 0, y: 0, required: 9 }])).toThrow(/1\.\.8/);
    expect(() => buildBoard(3, 3, [{ x: 0, y: 0, required: 0 }])).toThrow(/1\.\.8/);
  });

  it('liefert die von einer Bruecke belegten Zellen', () => {
    const board = parseBoard('1...1');
    expect(edgeCells(board, 0)).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(otherIsland(board, 0, 0)).toBe(1);
    expect(otherIsland(board, 0, 1)).toBe(0);
  });
});
