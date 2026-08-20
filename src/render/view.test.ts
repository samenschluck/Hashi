import { describe, expect, it } from 'vitest';
import { parseBoard } from '../core/parse.ts';
import {
  cellToScreen,
  clampPan,
  computeView,
  directionOf,
  edgeInDirection,
  hitTestIsland,
  screenToCell,
} from './view.ts';

const board = parseBoard(`
  2.2.2
  .....
  2...2
`);

describe('computeView', () => {
  it('zentriert das quadratische Brett in einer breiten Flaeche', () => {
    const view = computeView(board, { width: 800, height: 300 });

    // Die kuerzere Seite bestimmt die Zellgroesse.
    expect(view.cell).toBeCloseTo(300 / 5);

    const left = cellToScreen(view, 0, 0);
    const right = cellToScreen(view, 4, 0);
    expect((left.x + right.x) / 2).toBeCloseTo(400);
  });

  it('zentriert das Brett auch in einer hohen Flaeche', () => {
    const view = computeView(board, { width: 300, height: 800 });
    const top = cellToScreen(view, 0, 0);
    const bottom = cellToScreen(view, 0, 2);
    expect((top.y + bottom.y) / 2).toBeCloseTo(400);
  });

  it('rechnet Bildschirmpunkte verlustfrei in Gitterpositionen zurueck', () => {
    const view = computeView(board, { width: 400, height: 400 }, 1.7, 12, -8);
    const point = cellToScreen(view, 3, 1);
    const back = screenToCell(view, point.x, point.y);
    expect(back.x).toBeCloseTo(3);
    expect(back.y).toBeCloseTo(1);
  });

  it('kommt mit einer Flaeche der Groesse null zurecht', () => {
    const view = computeView(board, { width: 0, height: 0 });
    expect(view.cell).toBe(0);
    expect(screenToCell(view, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe('clampPan', () => {
  it('haelt ein Brett, das komplett hineinpasst, in der Mitte', () => {
    expect(clampPan({ width: 500, height: 500 }, 300, 300, 120, -90)).toEqual({
      panX: 0,
      panY: 0,
    });
  });

  it('erlaubt Verschieben nur so weit, wie das Brett ueberhaengt', () => {
    const result = clampPan({ width: 400, height: 400 }, 600, 600, 1000, -1000);
    expect(result.panX).toBe(100);
    expect(result.panY).toBe(-100);
  });
});

describe('hitTestIsland', () => {
  const view = computeView(board, { width: 400, height: 400 });

  it('trifft die Insel genau in ihrer Mitte', () => {
    const center = cellToScreen(view, 2, 0);
    expect(hitTestIsland(board, view, center.x, center.y)).toBe(1);
  });

  it('trifft auch mit etwas Abstand — die Flaeche ist groesser als der Kreis', () => {
    const center = cellToScreen(view, 2, 0);
    expect(hitTestIsland(board, view, center.x + view.cell * 0.45, center.y)).toBe(1);
  });

  it('liefert nichts, wenn weit daneben getippt wird', () => {
    const center = cellToScreen(view, 2, 0);
    expect(hitTestIsland(board, view, center.x, center.y + view.cell * 1.5)).toBeNull();
  });

  it('bleibt eindeutig: genau zwischen zwei Inseln wird nichts getroffen', () => {
    // Die Toleranz ist bewusst kleiner als eine Zelle, damit sich die
    // Trefferbereiche zweier Inseln nie ueberlappen koennen.
    const first = cellToScreen(view, 0, 0);
    const second = cellToScreen(view, 2, 0);
    const middle = { x: (first.x + second.x) / 2, y: first.y };
    expect(hitTestIsland(board, view, middle.x, middle.y)).toBeNull();

    // Nahe genug an der ersten Insel wird dagegen sicher getroffen.
    expect(hitTestIsland(board, view, first.x + view.cell * 0.5, first.y)).toBe(0);
  });
});

describe('directionOf', () => {
  it('erkennt achsennahe Bewegungen grosszuegig', () => {
    expect(directionOf(100, 0)).toBe('right');
    expect(directionOf(100, 40)).toBe('right');
    expect(directionOf(-100, -30)).toBe('left');
    expect(directionOf(20, 100)).toBe('down');
    expect(directionOf(-20, -100)).toBe('up');
  });

  it('verweigert die Deutung bei zu schraeger Bewegung', () => {
    expect(directionOf(100, 100)).toBeNull();
    expect(directionOf(0, 0)).toBeNull();
  });
});

describe('edgeInDirection', () => {
  it('findet den Nachbarn in der gewuenschten Richtung', () => {
    // Insel 1 ist die mittlere Zwei der oberen Reihe.
    const right = edgeInDirection(board, 1, 'right');
    const left = edgeInDirection(board, 1, 'left');
    expect(right).not.toBeNull();
    expect(left).not.toBeNull();
    expect(right).not.toBe(left);

    // Nach unten gibt es von dort keine Verbindung.
    expect(edgeInDirection(board, 1, 'down')).toBeNull();
  });
});
