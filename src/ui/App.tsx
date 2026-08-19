import { useEffect, useState } from 'react';
import { DIFFICULTIES, type Difficulty } from '../config/game.ts';
import { generate } from '../core/generator.ts';
import { findHint } from '../core/hint.ts';
import { useGameStore } from '../state/gameStore.ts';
import { BoardCanvas } from './components/BoardCanvas.tsx';

/**
 * Vorlaeufiger Spielbildschirm fuer Meilenstein 2.
 *
 * Die richtige Navigation (Splash, Hauptmenue, Levelauswahl, Ergebnis) kommt in
 * Meilenstein 3. Hier geht es darum, dass Rendering und Eingabe auf einem echten
 * Brett funktionieren.
 */
export function App(): React.JSX.Element {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [seed, setSeed] = useState(() => Date.now().toString(36));

  const loadPuzzle = useGameStore((store) => store.loadPuzzle);
  const puzzle = useGameStore((store) => store.puzzle);
  const board = useGameStore((store) => store.board);
  const counts = useGameStore((store) => store.counts);
  const solved = useGameStore((store) => store.solved);
  const canUndo = useGameStore((store) => store.canUndo);
  const canRedo = useGameStore((store) => store.canRedo);

  useEffect(() => {
    loadPuzzle(generate(seed, difficulty));
  }, [loadPuzzle, seed, difficulty]);

  const showHint = (): void => {
    const store = useGameStore.getState();
    if (!store.board || !store.puzzle) {
      return;
    }
    const hint = findHint(store.board, store.counts, store.puzzle.solution);
    store.setHintEdge(hint.edgeId);
  };

  return (
    <div className="app-shell">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div>
          <h1 className="text-lg leading-tight font-semibold tracking-tight">Bridgelet</h1>
          <p className="text-xs text-slate-400">
            {puzzle ? `${labelFor(difficulty)} · ${String(puzzle.islands.length)} Inseln` : '…'}
          </p>
        </div>
        <select
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value as Difficulty);
          }}
          aria-label="Schwierigkeitsgrad"
        >
          {DIFFICULTIES.map((value) => (
            <option key={value} value={value}>
              {labelFor(value)}
            </option>
          ))}
        </select>
      </header>

      <main className="app-content px-2">
        {board ? <BoardCanvas /> : null}
        {solved ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <span className="rounded-full bg-emerald-600/90 px-4 py-1.5 text-sm font-medium text-white">
              Gelöst
            </span>
          </div>
        ) : null}
      </main>

      <nav className="flex items-center justify-center gap-1.5 px-3 py-3">
        <ToolbarButton
          label="Zurück"
          disabled={!canUndo}
          onClick={() => {
            useGameStore.getState().undo();
          }}
        />
        <ToolbarButton
          label="Vor"
          disabled={!canRedo}
          onClick={() => {
            useGameStore.getState().redo();
          }}
        />
        <ToolbarButton
          label="Leeren"
          disabled={counts.every((value) => value === 0)}
          onClick={() => {
            useGameStore.getState().reset();
          }}
        />
        <ToolbarButton label="Tipp" onClick={showHint} />
        <ToolbarButton
          label="Neu"
          onClick={() => {
            setSeed(Date.now().toString(36));
          }}
        />
      </nav>

      {/* Fest reservierte Flaeche fuer den Anchored Banner (Meilenstein 4). */}
      <div className="app-banner-slot" />
    </div>
  );
}

interface ToolbarButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

function ToolbarButton({
  label,
  onClick,
  disabled = false,
}: ToolbarButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // min-h-12 entspricht 48 dp; min-w-0 laesst die Knoepfe schrumpfen, statt die
      // Leiste seitlich ueberlaufen zu lassen.
      className="min-h-12 min-w-0 flex-1 truncate rounded-xl bg-slate-800 px-2 text-sm font-medium text-slate-100 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function labelFor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Einfach';
    case 'medium':
      return 'Mittel';
    case 'hard':
      return 'Schwer';
    case 'expert':
      return 'Experte';
  }
}
