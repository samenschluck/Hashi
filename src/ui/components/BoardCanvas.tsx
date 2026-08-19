import { useEffect, useRef } from 'react';
import { GestureRecognizer, type GestureEvent } from '../../input/gestures.ts';
import { BoardRenderer } from '../../render/boardRenderer.ts';
import { themeByName, type ThemeName } from '../../render/theme.ts';
import { computeView } from '../../render/view.ts';
import { useGameStore } from '../../state/gameStore.ts';
import { useElementSize } from '../hooks/useElementSize.ts';

export interface BoardCanvasProps {
  readonly theme?: ThemeName;
}

/**
 * Bindeglied zwischen React und der Zeichen- beziehungsweise Eingabeschicht.
 *
 * React verwaltet hier nur Auf- und Abbau. Gezeichnet wird direkt auf dem Canvas,
 * ausgeloest durch Zustandsaenderungen — es gibt bewusst keinen React-Rerender pro
 * Bild und keine dauerhaft laufende Animationsschleife.
 */
export function BoardCanvas({ theme = 'dark' }: BoardCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const frameRef = useRef<number | null>(null);

  const size = useElementSize(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const renderer = new BoardRenderer(canvas);
    rendererRef.current = renderer;
    return () => {
      rendererRef.current = null;
    };
  }, []);

  // Zeichnen bei jeder relevanten Zustandsaenderung — und nur dann.
  useEffect(() => {
    const renderer = rendererRef.current;
    const container = containerRef.current;
    if (!renderer || !container) {
      return;
    }

    const draw = (): void => {
      const store = useGameStore.getState();
      const board = store.board;
      if (!board || size.width <= 0 || size.height <= 0) {
        return;
      }

      renderer.setTheme(themeByName(theme));
      renderer.resize(size.width, size.height, window.devicePixelRatio);
      renderer.setView(computeView(board, size, store.zoom, store.panX, store.panY));
      renderer.draw({
        board,
        counts: store.counts,
        selectedIsland: store.selectedIsland,
        previewEdge: store.previewEdge,
        hintEdge: store.hintEdge,
      });

      // Die Schleife laeuft ausschliesslich, solange eine Bruecke einschnappt.
      if (renderer.hasActiveAnimations()) {
        frameRef.current = requestAnimationFrame(draw);
      } else {
        frameRef.current = null;
      }
    };

    const requestDraw = (): void => {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    let previousChangedEdge = useGameStore.getState().lastChangedEdge;
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.lastChangedEdge !== previousChangedEdge && state.lastChangedEdge !== null) {
        renderer.animateEdge(state.lastChangedEdge);
      }
      previousChangedEdge = state.lastChangedEdge;
      requestDraw();
    });

    requestDraw();

    return () => {
      unsubscribe();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [size, theme]);

  // Gestenerkennung mit dem jeweils aktuellen Blickfeld versorgen.
  useEffect(() => {
    const store = useGameStore.getState();
    const board = store.board;
    if (!board || size.width <= 0 || size.height <= 0) {
      return;
    }

    const handle = (event: GestureEvent): void => {
      const actions = useGameStore.getState();
      switch (event.type) {
        case 'cycleEdge':
          actions.cycleEdge(event.edgeId);
          actions.setHintEdge(null);
          break;
        case 'selection':
          actions.setSelection(event.islandId);
          break;
        case 'preview':
          actions.setPreview(event.edgeId);
          break;
        case 'transform':
          actions.setTransform(event.zoom, event.panX, event.panY);
          break;
      }
    };

    const context = {
      board,
      view: computeView(board, size, store.zoom, store.panX, store.panY),
      viewport: size,
    };

    if (recognizerRef.current) {
      recognizerRef.current.updateContext(context);
    } else {
      recognizerRef.current = new GestureRecognizer(context, handle);
    }

    const unsubscribe = useGameStore.subscribe((state) => {
      if (!state.board) {
        return;
      }
      recognizerRef.current?.updateContext({
        board: state.board,
        view: computeView(state.board, size, state.zoom, state.panX, state.panY),
        viewport: size,
      });
    });

    return unsubscribe;
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const toSample = (event: PointerEvent): { pointerId: number; x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        pointerId: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const onDown = (event: PointerEvent): void => {
      canvas.setPointerCapture(event.pointerId);
      recognizerRef.current?.pointerDown(toSample(event));
    };
    const onMove = (event: PointerEvent): void => {
      recognizerRef.current?.pointerMove(toSample(event));
    };
    const onUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      recognizerRef.current?.pointerUp(toSample(event));
    };
    const onCancel = (): void => {
      recognizerRef.current?.cancel();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      {/* touch-none verhindert, dass der Browser Wischgesten als Scrollen deutet. */}
      <canvas ref={canvasRef} className="block touch-none" />
    </div>
  );
}
