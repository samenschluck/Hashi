import { RENDER } from '../config/game.ts';
import type { Board } from '../core/types.ts';
import { cellToScreen, islandRadius, type BoardView } from './view.ts';
import { DARK_THEME, type BoardTheme } from './theme.ts';

export interface RenderState {
  readonly board: Board;
  /** Gesetzte Bruecken je Kante. */
  readonly counts: ArrayLike<number>;
  /** Angetippte Insel bei der Tipp-Tipp-Bedienung. */
  readonly selectedIsland: number | null;
  /** Kante unter dem Finger waehrend des Ziehens. */
  readonly previewEdge: number | null;
  /** Vom Tipp-System hervorgehobene Kante. */
  readonly hintEdge: number | null;
}

/**
 * Zeichnet das Spielfeld auf ein Canvas.
 *
 * Zwei Eigenschaften sind hier wichtiger als alles andere:
 *
 * 1. **Kein Dauerlauf.** Gezeichnet wird nur, wenn sich etwas geaendert hat.
 *    Die Animationsschleife laeuft ausschliesslich, solange eine Bruecke
 *    einschnappt, und haelt danach von selbst an.
 * 2. **Der statische Untergrund wird zwischengespeichert.** Hintergrund und
 *    Rasterpunkte aendern sich nur bei Groessen-, Zoom- oder Themenwechsel und
 *    landen in einem Offscreen-Canvas, das pro Bild nur noch kopiert wird.
 */
export class BoardRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly backdrop: HTMLCanvasElement;
  private readonly backdropContext: CanvasRenderingContext2D;

  private theme: BoardTheme = DARK_THEME;
  private view: BoardView = { cell: 0, originX: 0, originY: 0, zoom: 1, panX: 0, panY: 0 };
  private cssWidth = 0;
  private cssHeight = 0;
  private pixelRatio = 1;
  private backdropDirty = true;

  /** Startzeitpunkt der Einschnapp-Animation je Kante. */
  private readonly animations = new Map<number, number>();

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D-Kontext nicht verfuegbar');
    }
    this.canvas = canvas;
    this.context = context;

    const backdrop = document.createElement('canvas');
    const backdropContext = backdrop.getContext('2d');
    if (!backdropContext) {
      throw new Error('2D-Kontext fuer den Hintergrund nicht verfuegbar');
    }
    this.backdrop = backdrop;
    this.backdropContext = backdropContext;
  }

  setTheme(theme: BoardTheme): void {
    if (this.theme !== theme) {
      this.theme = theme;
      this.backdropDirty = true;
    }
  }

  /**
   * Passt die Zeichenflaeche an. Der Backing-Store wird mit dem
   * Geraete-Pixelverhaeltnis skaliert, damit nichts unscharf wirkt — gedeckelt,
   * damit sehr hohe Aufloesungen nicht die Bildrate kosten.
   */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    const ratio = Math.min(RENDER.maxDevicePixelRatio, Math.max(1, devicePixelRatio));
    const pixelWidth = Math.round(cssWidth * ratio);
    const pixelHeight = Math.round(cssHeight * ratio);

    if (
      this.cssWidth === cssWidth &&
      this.cssHeight === cssHeight &&
      this.pixelRatio === ratio &&
      this.canvas.width === pixelWidth
    ) {
      return;
    }

    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.pixelRatio = ratio;

    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.width = `${String(cssWidth)}px`;
    this.canvas.style.height = `${String(cssHeight)}px`;

    this.backdrop.width = pixelWidth;
    this.backdrop.height = pixelHeight;

    this.backdropDirty = true;
  }

  setView(view: BoardView): void {
    if (
      this.view.cell !== view.cell ||
      this.view.originX !== view.originX ||
      this.view.originY !== view.originY
    ) {
      this.backdropDirty = true;
    }
    this.view = view;
  }

  /** Startet die kurze Einschnapp-Animation fuer eine Kante. */
  animateEdge(edgeId: number, now = performance.now()): void {
    this.animations.set(edgeId, now);
  }

  /** Laeuft gerade eine Animation? Nur dann braucht es die rAF-Schleife. */
  hasActiveAnimations(now = performance.now()): boolean {
    for (const start of this.animations.values()) {
      if (now - start < RENDER.bridgeAnimationMs) {
        return true;
      }
    }
    return false;
  }

  draw(state: RenderState, now = performance.now()): void {
    const { context } = this;

    if (this.backdropDirty) {
      this.drawBackdrop(state.board);
      this.backdropDirty = false;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.backdrop, 0, 0);
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    this.drawBridges(state, now);
    this.drawIslands(state);

    // Abgelaufene Animationen aufraeumen, damit die Schleife wirklich anhaelt.
    for (const [edgeId, start] of this.animations) {
      if (now - start >= RENDER.bridgeAnimationMs) {
        this.animations.delete(edgeId);
      }
    }
  }

  // ---------------------------------------------------------------------------

  private drawBackdrop(board: Board): void {
    const context = this.backdropContext;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.backdrop.width, this.backdrop.height);
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    context.fillStyle = this.theme.background;
    context.fillRect(0, 0, this.cssWidth, this.cssHeight);

    if (this.view.cell <= 0) {
      return;
    }

    const dotRadius = Math.max(0.5, this.view.cell * 0.03);

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const point = cellToScreen(this.view, x, y);
        if (board.blocked[y * board.width + x] === 1) {
          continue; // Mauern werden unten als Block gezeichnet, nicht als Punkt
        }
        context.fillStyle = this.theme.grid;
        context.beginPath();
        context.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
    }

    this.drawWalls(board);
  }

  /**
   * Mauern gehoeren in den zwischengespeicherten Untergrund: sie aendern sich
   * waehrend einer Partie nie.
   *
   * Bewusst als kompakter Block mit deutlicher Kante gezeichnet und nicht nur
   * eingefaerbt — die Mauer muss auch bei hellem Thema und in der Sonne als
   * „hier geht nichts durch" lesbar sein, ohne dass man Farben unterscheiden
   * muss.
   */
  private drawWalls(board: Board): void {
    const context = this.backdropContext;
    const size = this.view.cell * 0.62;
    const radius = Math.max(1, size * 0.22);

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.blocked[y * board.width + x] !== 1) {
          continue;
        }
        const point = cellToScreen(this.view, x, y);
        const left = point.x - size / 2;
        const top = point.y - size / 2;

        context.fillStyle = this.theme.wall;
        context.beginPath();
        context.roundRect(left, top, size, size, radius);
        context.fill();

        context.strokeStyle = this.theme.wallBorder;
        context.lineWidth = Math.max(1, this.view.cell * 0.035);
        context.stroke();
      }
    }
  }

  private drawBridges(state: RenderState, now: number): void {
    const { context, view } = this;
    const { board } = state;
    const lineWidth = Math.max(1.5, view.cell * 0.07);
    const gap = view.cell * 0.12;

    context.lineCap = 'round';

    for (const edge of board.edges) {
      const count = state.counts[edge.id] ?? 0;
      const isPreview = state.previewEdge === edge.id;
      const isHint = state.hintEdge === edge.id;

      if (count === 0 && !isPreview && !isHint) {
        continue;
      }

      const from = board.islands[edge.a]!;
      const to = board.islands[edge.b]!;
      const start = cellToScreen(view, from.x, from.y);
      const end = cellToScreen(view, to.x, to.y);

      const drawnCount = count === 0 ? 1 : count;
      const animationStart = this.animations.get(edge.id);
      const progress =
        animationStart === undefined
          ? 1
          : Math.min(1, (now - animationStart) / RENDER.bridgeAnimationMs);

      context.strokeStyle = isHint
        ? this.theme.hint
        : isPreview
          ? this.theme.bridgePreview
          : this.theme.bridge;
      context.globalAlpha = count === 0 ? 0.45 : 0.4 + 0.6 * progress;
      context.lineWidth = lineWidth * (0.6 + 0.4 * progress);

      for (let index = 0; index < drawnCount; index++) {
        // Doppelbruecken laufen parallel links und rechts der Mittellinie.
        const offset = drawnCount === 1 ? 0 : (index === 0 ? -1 : 1) * gap;
        const shiftX = edge.horizontal ? 0 : offset;
        const shiftY = edge.horizontal ? offset : 0;

        context.beginPath();
        context.moveTo(start.x + shiftX, start.y + shiftY);
        context.lineTo(end.x + shiftX, end.y + shiftY);
        context.stroke();
      }

      context.globalAlpha = 1;
    }
  }

  private drawIslands(state: RenderState): void {
    const { context, view } = this;
    const { board } = state;
    const radius = islandRadius(view);
    if (radius <= 0) {
      return;
    }

    const degrees = new Int32Array(board.islands.length);
    for (const edge of board.edges) {
      const count = state.counts[edge.id] ?? 0;
      if (count > 0) {
        degrees[edge.a] = degrees[edge.a]! + count;
        degrees[edge.b] = degrees[edge.b]! + count;
      }
    }

    context.font = `600 ${String(Math.round(radius * 1.1))}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (const island of board.islands) {
      const center = cellToScreen(view, island.x, island.y);
      const degree = degrees[island.id]!;

      let fill = this.theme.island;
      let text = this.theme.islandText;
      // Eine verborgene Insel faerbt sich nie ein: „voll" oder „zu voll" waere
      // bereits ein Hinweis auf ihre Zahl.
      if (!island.hidden) {
        if (degree > island.required) {
          fill = this.theme.islandError;
          text = this.theme.islandErrorText;
        } else if (degree === island.required) {
          fill = this.theme.islandSatisfied;
          text = this.theme.islandSatisfiedText;
        }
      }

      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.fillStyle = fill;
      context.fill();

      context.lineWidth = Math.max(1, radius * 0.09);
      context.strokeStyle =
        state.selectedIsland === island.id ? this.theme.selection : this.theme.islandBorder;
      if (state.selectedIsland === island.id) {
        context.lineWidth = Math.max(2, radius * 0.18);
      }
      context.stroke();

      context.fillStyle = island.hidden ? this.theme.islandUnknownText : text;
      context.fillText(island.hidden ? '?' : String(island.required), center.x, center.y);
    }
  }
}
