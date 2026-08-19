import { beforeEach, describe, expect, it } from 'vitest';
import { parseBoard } from '../core/parse.ts';
import { cellToScreen, computeView } from '../render/view.ts';
import {
  GestureRecognizer,
  clampZoom,
  type GestureContext,
  type GestureEvent,
} from './gestures.ts';

const board = parseBoard(`
  2.2.2
  .....
  2...2
`);

const viewport = { width: 400, height: 400 };
const view = computeView(board, viewport);

const context: GestureContext = { board, view, viewport };

function at(x: number, y: number): { x: number; y: number } {
  return cellToScreen(view, x, y);
}

describe('GestureRecognizer', () => {
  let events: GestureEvent[];
  let recognizer: GestureRecognizer;

  beforeEach(() => {
    events = [];
    recognizer = new GestureRecognizer(context, (event) => events.push(event));
  });

  it('legt beim Ziehen von Insel zu Insel eine Bruecke', () => {
    const from = at(0, 0);
    const to = at(2, 0);

    recognizer.pointerDown({ pointerId: 1, ...from });
    recognizer.pointerMove({ pointerId: 1, ...to });
    recognizer.pointerUp({ pointerId: 1, ...to });

    expect(events.filter((event) => event.type === 'cycleEdge')).toHaveLength(1);
  });

  it('erkennt die Richtung auch bei schraegem Ziehen ins Leere', () => {
    const from = at(0, 0);

    recognizer.pointerDown({ pointerId: 1, ...from });
    // Deutlich nach rechts, leicht nach unten — und nicht bis zur Zielinsel.
    recognizer.pointerMove({
      pointerId: 1,
      x: from.x + view.cell * 1.2,
      y: from.y + view.cell * 0.3,
    });
    recognizer.pointerUp({
      pointerId: 1,
      x: from.x + view.cell * 1.2,
      y: from.y + view.cell * 0.3,
    });

    expect(events.filter((event) => event.type === 'cycleEdge')).toHaveLength(1);
  });

  it('legt nichts an, wenn in eine Richtung ohne Nachbarn gezogen wird', () => {
    const from = at(2, 0);

    recognizer.pointerDown({ pointerId: 1, ...from });
    recognizer.pointerMove({ pointerId: 1, x: from.x, y: from.y + view.cell * 1.5 });
    recognizer.pointerUp({ pointerId: 1, x: from.x, y: from.y + view.cell * 1.5 });

    expect(events.some((event) => event.type === 'cycleEdge')).toBe(false);
  });

  it('meldet waehrend des Ziehens eine Vorschau und nimmt sie danach zurueck', () => {
    const from = at(0, 0);
    const to = at(2, 0);

    recognizer.pointerDown({ pointerId: 1, ...from });
    recognizer.pointerMove({ pointerId: 1, ...to });

    const previews = events.filter((event) => event.type === 'preview');
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({ type: 'preview' });

    recognizer.pointerUp({ pointerId: 1, ...to });
    expect(events.filter((event) => event.type === 'preview').at(-1)).toEqual({
      type: 'preview',
      edgeId: null,
    });
  });

  it('bedient auch per Tippen auf zwei Inseln nacheinander', () => {
    const first = at(0, 0);
    const second = at(2, 0);

    recognizer.pointerDown({ pointerId: 1, ...first });
    recognizer.pointerUp({ pointerId: 1, ...first });
    expect(events.at(-1)).toEqual({ type: 'selection', islandId: 0 });

    recognizer.pointerDown({ pointerId: 2, ...second });
    recognizer.pointerUp({ pointerId: 2, ...second });

    expect(events.filter((event) => event.type === 'cycleEdge')).toHaveLength(1);
    expect(recognizer.selection).toBeNull();
  });

  it('hebt die Auswahl beim erneuten Tippen auf dieselbe Insel auf', () => {
    const first = at(0, 0);

    recognizer.pointerDown({ pointerId: 1, ...first });
    recognizer.pointerUp({ pointerId: 1, ...first });
    recognizer.pointerDown({ pointerId: 1, ...first });
    recognizer.pointerUp({ pointerId: 1, ...first });

    expect(recognizer.selection).toBeNull();
    expect(events.some((event) => event.type === 'cycleEdge')).toBe(false);
  });

  it('waehlt bei zwei nicht verbindbaren Inseln die zweite neu aus', () => {
    // Insel 0 (0,0) und Insel 4 (4,2) liegen weder in derselben Zeile noch Spalte.
    recognizer.pointerDown({ pointerId: 1, ...at(0, 0) });
    recognizer.pointerUp({ pointerId: 1, ...at(0, 0) });
    recognizer.pointerDown({ pointerId: 1, ...at(4, 2) });
    recognizer.pointerUp({ pointerId: 1, ...at(4, 2) });

    expect(events.some((event) => event.type === 'cycleEdge')).toBe(false);
    expect(recognizer.selection).toBe(4);
  });

  it('deutet ein Tippen auf freie Flaeche als Aufheben der Auswahl', () => {
    recognizer.pointerDown({ pointerId: 1, ...at(0, 0) });
    recognizer.pointerUp({ pointerId: 1, ...at(0, 0) });
    recognizer.pointerDown({ pointerId: 1, x: 5, y: 395 });
    recognizer.pointerUp({ pointerId: 1, x: 5, y: 395 });

    expect(recognizer.selection).toBeNull();
  });

  it('zoomt bei zwei Fingern und bleibt in den Grenzen', () => {
    recognizer.pointerDown({ pointerId: 1, x: 180, y: 200 });
    recognizer.pointerDown({ pointerId: 2, x: 220, y: 200 });
    recognizer.pointerMove({ pointerId: 2, x: 300, y: 200 });

    const transforms = events.filter((event) => event.type === 'transform');
    expect(transforms.length).toBeGreaterThan(0);
    const last = transforms.at(-1)!;
    expect(last.zoom).toBeGreaterThan(1);
    expect(last.zoom).toBeLessThanOrEqual(3);
  });

  it('legt keine Bruecke an, wenn die Geste abgebrochen wird', () => {
    recognizer.pointerDown({ pointerId: 1, ...at(0, 0) });
    recognizer.pointerMove({ pointerId: 1, ...at(2, 0) });
    recognizer.cancel();
    recognizer.pointerUp({ pointerId: 1, ...at(2, 0) });

    expect(events.some((event) => event.type === 'cycleEdge')).toBe(false);
  });
});

describe('clampZoom', () => {
  it('haelt den Zoom im erlaubten Bereich', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(3);
    expect(clampZoom(1.8)).toBe(1.8);
  });
});
