import { RENDER } from '../config/game.ts';
import type { Board } from '../core/types.ts';

/**
 * Abbildung zwischen Gitterkoordinaten und Bildschirmpunkten.
 *
 * Bewusst reine Rechnung ohne Canvas und ohne DOM: Trefferpruefung und Layout
 * sind damit ohne Browser testbar, und der Renderer bleibt eine reine Zeichenschicht.
 */
export interface BoardView {
  /** Kantenlaenge einer Gitterzelle in CSS-Pixeln, Zoom bereits eingerechnet. */
  readonly cell: number;
  /** Bildschirmposition der Mitte von Zelle (0, 0). */
  readonly originX: number;
  readonly originY: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export interface Viewport {
  /** Verfuegbare Flaeche in CSS-Pixeln — bereits ohne Bannerhoehe und Safe-Area. */
  readonly width: number;
  readonly height: number;
}

/**
 * Berechnet die Darstellung fuer die verfuegbare Flaeche.
 *
 * Das Brett bleibt quadratisch und wird zentriert. Am Rand bleibt eine halbe Zelle
 * Luft, damit Inseln am Spielfeldrand nicht angeschnitten werden und der
 * Trefferbereich dort genauso gross ist wie in der Mitte.
 */
export function computeView(
  board: Board,
  viewport: Viewport,
  zoom = 1,
  panX = 0,
  panY = 0,
): BoardView {
  const columns = board.width;
  const rows = board.height;
  const available = Math.max(0, Math.min(viewport.width, viewport.height));

  const baseCell = available / Math.max(columns, rows);
  const cell = baseCell * zoom;

  const boardWidth = cell * columns;
  const boardHeight = cell * rows;

  const clamped = clampPan(viewport, boardWidth, boardHeight, panX, panY);

  return {
    cell,
    originX: (viewport.width - boardWidth) / 2 + cell / 2 + clamped.panX,
    originY: (viewport.height - boardHeight) / 2 + cell / 2 + clamped.panY,
    zoom,
    panX: clamped.panX,
    panY: clamped.panY,
  };
}

/**
 * Begrenzt das Verschieben so, dass nie ins Leere gescrollt wird.
 * Passt das Brett vollstaendig in die Flaeche, bleibt es zentriert.
 */
export function clampPan(
  viewport: Viewport,
  boardWidth: number,
  boardHeight: number,
  panX: number,
  panY: number,
): { panX: number; panY: number } {
  const slackX = Math.max(0, (boardWidth - viewport.width) / 2);
  const slackY = Math.max(0, (boardHeight - viewport.height) / 2);
  // `+ 0` normalisiert die negative Null, damit Vergleiche nicht ueberraschen.
  return {
    panX: Math.min(slackX, Math.max(-slackX, panX)) + 0,
    panY: Math.min(slackY, Math.max(-slackY, panY)) + 0,
  };
}

/** Bildschirmposition einer Gitterzelle. */
export function cellToScreen(view: BoardView, x: number, y: number): { x: number; y: number } {
  return { x: view.originX + x * view.cell, y: view.originY + y * view.cell };
}

/** Gitterposition eines Bildschirmpunkts (gebrochen, nicht gerundet). */
export function screenToCell(view: BoardView, px: number, py: number): { x: number; y: number } {
  if (view.cell === 0) {
    return { x: 0, y: 0 };
  }
  return { x: (px - view.originX) / view.cell, y: (py - view.originY) / view.cell };
}

/** Radius des sichtbaren Inselkreises in CSS-Pixeln. */
export function islandRadius(view: BoardView): number {
  return view.cell * 0.38;
}

/**
 * Insel unter einem Bildschirmpunkt.
 *
 * Der Trefferbereich ist absichtlich groesser als der gezeichnete Kreis: auf
 * kleinen Boards waere er sonst deutlich unter den 48 dp, die Android als
 * Mindestgroesse fuer Bedienelemente vorgibt. Bei `width=device-width` entspricht
 * ein dp genau einem CSS-Pixel, deshalb ist hier keine Umrechnung noetig.
 *
 * Die Toleranz bleibt unter einer ganzen Zelle, damit sich die Bereiche zweier
 * Inseln nie ueberlappen — ein Tippen kann so nie mehrdeutig werden.
 */
export function hitTestIsland(
  board: Board,
  view: BoardView,
  px: number,
  py: number,
): number | null {
  const tolerance = Math.min(
    view.cell,
    Math.max(
      islandRadius(view),
      view.cell * RENDER.grabToleranceCells,
      RENDER.minTouchTargetDp / 2,
    ),
  );

  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const island of board.islands) {
    const center = cellToScreen(view, island.x, island.y);
    const dx = px - center.x;
    const dy = py - center.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= tolerance && distance < bestDistance) {
      best = island.id;
      bestDistance = distance;
    }
  }

  return best;
}

/** Die vier Achsenrichtungen, in denen Bruecken verlaufen koennen. */
export type Direction = 'left' | 'right' | 'up' | 'down';

/** Richtung eines Zugvektors, oder null wenn er zu keiner Achse passt. */
export function directionOf(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === 0) {
    return null;
  }
  const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
  const tolerance = RENDER.dragAngleToleranceDeg;

  const horizontal = angle <= tolerance;
  const vertical = angle >= 90 - tolerance;

  if (horizontal) {
    return dx > 0 ? 'right' : 'left';
  }
  if (vertical) {
    return dy > 0 ? 'down' : 'up';
  }
  return null;
}

/**
 * Kante, die von einer Insel aus in eine Richtung fuehrt.
 * Liefert null, wenn es in dieser Richtung keinen Nachbarn gibt.
 */
export function edgeInDirection(
  board: Board,
  islandId: number,
  direction: Direction,
): number | null {
  const from = board.islands[islandId]!;

  for (const edgeId of board.edgesByIsland[islandId]!) {
    const edge = board.edges[edgeId]!;
    const otherId = edge.a === islandId ? edge.b : edge.a;
    const other = board.islands[otherId]!;

    switch (direction) {
      case 'right':
        if (other.y === from.y && other.x > from.x) return edgeId;
        break;
      case 'left':
        if (other.y === from.y && other.x < from.x) return edgeId;
        break;
      case 'down':
        if (other.x === from.x && other.y > from.y) return edgeId;
        break;
      case 'up':
        if (other.x === from.x && other.y < from.y) return edgeId;
        break;
    }
  }

  return null;
}
