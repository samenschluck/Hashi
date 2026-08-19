import { RENDER } from '../config/game.ts';
import {
  clampPan,
  directionOf,
  edgeInDirection,
  hitTestIsland,
  type BoardView,
} from '../render/view.ts';
import { findEdge } from '../core/geometry.ts';
import type { Board } from '../core/types.ts';

export interface PointerSample {
  readonly pointerId: number;
  /** Position in CSS-Pixeln, relativ zur linken oberen Ecke der Zeichenflaeche. */
  readonly x: number;
  readonly y: number;
}

export type GestureEvent =
  /** Kante weiterschalten: keine Bruecke → eine → zwei → keine. */
  | { readonly type: 'cycleEdge'; readonly edgeId: number }
  /** Ausgewaehlte Insel fuer die Tipp-Tipp-Bedienung. */
  | { readonly type: 'selection'; readonly islandId: number | null }
  /** Vorschau waehrend des Ziehens. */
  | { readonly type: 'preview'; readonly edgeId: number | null }
  /** Zoom und Verschiebung nach einer Zwei-Finger-Geste. */
  | {
      readonly type: 'transform';
      readonly zoom: number;
      readonly panX: number;
      readonly panY: number;
    };

export interface GestureContext {
  readonly board: Board;
  readonly view: BoardView;
  readonly viewport: { readonly width: number; readonly height: number };
}

interface DragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly islandId: number | null;
  previewEdgeId: number | null;
  moved: boolean;
}

interface PinchState {
  readonly pointers: [number, number];
  startDistance: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  startMidX: number;
  startMidY: number;
}

/**
 * Erkennt aus Zeigerereignissen die Spielgesten.
 *
 * Bewusst ohne DOM-Bezug: die Erkennung bekommt nur Punkte und liefert Absichten
 * zurueck. Dadurch ist das Bediengefuehl — Toleranzen, Tippen gegen Ziehen,
 * Zwei-Finger-Zoom — ohne Browser testbar.
 *
 * Zwei gleichwertige Bedienarten:
 * - **Ziehen** von einer Insel zur Nachbarinsel legt oder veraendert die Bruecke.
 * - **Tippen** auf zwei Inseln nacheinander bewirkt dasselbe.
 */
export class GestureRecognizer {
  private context: GestureContext;
  private readonly emit: (event: GestureEvent) => void;

  private readonly active = new Map<number, PointerSample>();
  private drag: DragState | null = null;
  private pinch: PinchState | null = null;
  private selectedIsland: number | null = null;

  constructor(context: GestureContext, emit: (event: GestureEvent) => void) {
    this.context = context;
    this.emit = emit;
  }

  /** Nach Groessenaenderung, Zoom oder Puzzlewechsel aufrufen. */
  updateContext(context: GestureContext): void {
    this.context = context;
  }

  get selection(): number | null {
    return this.selectedIsland;
  }

  pointerDown(sample: PointerSample): void {
    this.active.set(sample.pointerId, sample);

    if (this.active.size === 2) {
      this.beginPinch();
      return;
    }
    if (this.active.size > 2) {
      return;
    }

    const islandId = hitTestIsland(this.context.board, this.context.view, sample.x, sample.y);

    this.drag = {
      pointerId: sample.pointerId,
      startX: sample.x,
      startY: sample.y,
      islandId,
      previewEdgeId: null,
      moved: false,
    };
  }

  pointerMove(sample: PointerSample): void {
    if (!this.active.has(sample.pointerId)) {
      return;
    }
    this.active.set(sample.pointerId, sample);

    if (this.pinch) {
      this.updatePinch();
      return;
    }

    const drag = this.drag;
    if (!drag || drag.pointerId !== sample.pointerId) {
      return;
    }

    const dx = sample.x - drag.startX;
    const dy = sample.y - drag.startY;
    const distance = Math.hypot(dx, dy);
    const activation = this.context.view.cell * RENDER.dragActivationCells;

    if (distance >= activation) {
      drag.moved = true;
    }

    if (drag.islandId === null) {
      // Ziehen auf freier Flaeche verschiebt das Brett, sofern hineingezoomt ist.
      if (drag.moved) {
        this.panBy(dx, dy);
      }
      return;
    }

    if (!drag.moved) {
      return;
    }

    const edgeId = this.resolveDragTarget(drag.islandId, sample, dx, dy);
    if (edgeId !== drag.previewEdgeId) {
      drag.previewEdgeId = edgeId;
      this.emit({ type: 'preview', edgeId });
    }
  }

  pointerUp(sample: PointerSample): void {
    this.active.delete(sample.pointerId);

    if (this.pinch) {
      if (this.active.size < 2) {
        this.pinch = null;
        this.drag = null;
      }
      return;
    }

    const drag = this.drag;
    if (!drag || drag.pointerId !== sample.pointerId) {
      return;
    }
    this.drag = null;

    if (drag.previewEdgeId !== null) {
      this.emit({ type: 'preview', edgeId: null });
      this.emit({ type: 'cycleEdge', edgeId: drag.previewEdgeId });
      this.setSelection(null);
      return;
    }

    if (drag.moved) {
      this.emit({ type: 'preview', edgeId: null });
      return;
    }

    this.handleTap(drag.islandId);
  }

  /** Zeiger verloren (Anruf, App-Wechsel, Geste abgebrochen). */
  cancel(): void {
    this.active.clear();
    if (this.drag?.previewEdgeId !== null && this.drag) {
      this.emit({ type: 'preview', edgeId: null });
    }
    this.drag = null;
    this.pinch = null;
  }

  /** Auswahl von aussen zuruecksetzen, etwa nach Undo oder Levelwechsel. */
  clearSelection(): void {
    this.setSelection(null);
  }

  // ---------------------------------------------------------------------------

  private handleTap(islandId: number | null): void {
    if (islandId === null) {
      this.setSelection(null);
      return;
    }

    const selected = this.selectedIsland;
    if (selected === null) {
      this.setSelection(islandId);
      return;
    }
    if (selected === islandId) {
      this.setSelection(null);
      return;
    }

    const edgeId = findEdge(this.context.board, selected, islandId);
    if (edgeId === null) {
      // Keine moegliche Verbindung — die zweite Insel wird zur neuen Auswahl.
      this.setSelection(islandId);
      return;
    }

    this.setSelection(null);
    this.emit({ type: 'cycleEdge', edgeId });
  }

  private setSelection(islandId: number | null): void {
    if (this.selectedIsland === islandId) {
      return;
    }
    this.selectedIsland = islandId;
    this.emit({ type: 'selection', islandId });
  }

  /**
   * Zielkante beim Ziehen.
   *
   * Zuerst zaehlt, ueber welcher Insel der Finger gerade liegt — das ist die
   * eindeutigste Absicht. Erst wenn dort nichts liegt, entscheidet die Richtung
   * des Zugs. So bleibt auch ein schraeg gezogener Strich benutzbar.
   */
  private resolveDragTarget(
    fromIsland: number,
    sample: PointerSample,
    dx: number,
    dy: number,
  ): number | null {
    const overIsland = hitTestIsland(this.context.board, this.context.view, sample.x, sample.y);

    if (overIsland !== null && overIsland !== fromIsland) {
      const direct = findEdge(this.context.board, fromIsland, overIsland);
      if (direct !== null) {
        return direct;
      }
    }

    const direction = directionOf(dx, dy);
    return direction === null ? null : edgeInDirection(this.context.board, fromIsland, direction);
  }

  private panBy(dx: number, dy: number): void {
    const { view, viewport, board } = this.context;
    const boardWidth = view.cell * board.width;
    const boardHeight = view.cell * board.height;
    const next = clampPan(viewport, boardWidth, boardHeight, view.panX + dx, view.panY + dy);
    this.emit({ type: 'transform', zoom: view.zoom, panX: next.panX, panY: next.panY });
  }

  private beginPinch(): void {
    const [first, second] = [...this.active.values()];
    if (!first || !second) {
      return;
    }
    if (this.drag?.previewEdgeId != null) {
      this.emit({ type: 'preview', edgeId: null });
    }
    this.drag = null;

    this.pinch = {
      pointers: [first.pointerId, second.pointerId],
      startDistance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      startZoom: this.context.view.zoom,
      startPanX: this.context.view.panX,
      startPanY: this.context.view.panY,
      startMidX: (first.x + second.x) / 2,
      startMidY: (first.y + second.y) / 2,
    };
  }

  private updatePinch(): void {
    const pinch = this.pinch;
    if (!pinch) {
      return;
    }
    const first = this.active.get(pinch.pointers[0]);
    const second = this.active.get(pinch.pointers[1]);
    if (!first || !second) {
      return;
    }

    const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    const zoom = clampZoom((distance / pinch.startDistance) * pinch.startZoom);

    const midX = (first.x + second.x) / 2;
    const midY = (first.y + second.y) / 2;

    const { viewport, board, view } = this.context;
    const scaleChange = zoom / pinch.startZoom;
    const boardWidth = (view.cell / view.zoom) * zoom * board.width;
    const boardHeight = (view.cell / view.zoom) * zoom * board.height;

    const next = clampPan(
      viewport,
      boardWidth,
      boardHeight,
      pinch.startPanX * scaleChange + (midX - pinch.startMidX),
      pinch.startPanY * scaleChange + (midY - pinch.startMidY),
    );

    this.emit({ type: 'transform', zoom, panX: next.panX, panY: next.panY });
  }
}

/** Haelt den Zoom in den konfigurierten Grenzen. */
export function clampZoom(zoom: number): number {
  return Math.min(RENDER.zoom.max, Math.max(RENDER.zoom.min, zoom));
}
