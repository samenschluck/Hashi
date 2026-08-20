import { useEffect, useState } from 'react';
import { useAdStore } from '../../state/adStore.ts';
import { useAppStore } from '../../state/appStore.ts';
import { useGameStore } from '../../state/gameStore.ts';
import { BoardCanvas } from '../components/BoardCanvas.tsx';
import { RewardDialog } from '../components/RewardDialog.tsx';
import { formatDuration } from '../format.ts';

/**
 * Spielbildschirm.
 *
 * Es gibt hier bewusst keine Verlierbedingung: die Zeit laeuft nur hoch, ein
 * falsch gesetzter Zug wird markiert statt bestraft, und der Spieler kann
 * beliebig lange nachdenken.
 */
export function GameScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const active = useAppStore((store) => store.active);
  const elapsedMs = useAppStore((store) => store.elapsedMs);
  const hintsLeft = useAppStore((store) => store.save.hints.balance);
  const hint = useAppStore((store) => store.hint);
  const leftHanded = useAppStore((store) => store.save.settings.leftHanded);
  const theme = useAppStore((store) => store.save.settings.theme);

  const counts = useGameStore((store) => store.counts);
  const solved = useGameStore((store) => store.solved);
  const canUndo = useGameStore((store) => store.canUndo);
  const canRedo = useGameStore((store) => store.canRedo);

  const [showHintDialog, setShowHintDialog] = useState(false);

  // Sekundentakt fuer die Anzeige. Ohne laufende Partie tickt nichts.
  useEffect(() => {
    const timer = setInterval(() => {
      useAppStore.getState().tick();
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  // Beim Levelstart schon einmal ein Video vorladen, damit der Tipp-Knopf
  // spaeter nicht ins Leere laeuft.
  useEffect(() => {
    useAdStore.getState().preload();
  }, [active?.levelId]);

  // Zwischenstand nach jedem Zug sichern — der Fortschritt ueberlebt damit auch
  // ein hartes Beenden durch Android.
  useEffect(() => {
    useAppStore.getState().persistProgress();
  }, [counts]);

  useEffect(() => {
    if (solved) {
      useAppStore.getState().handleSolved();
    }
  }, [solved]);

  const requestHint = (): void => {
    const outcome = useAppStore.getState().requestHint();
    if (outcome === 'empty') {
      setShowHintDialog(true);
    }
  };

  const toolbar = (
    <>
      <ToolButton
        label={t('game.undo')}
        disabled={!canUndo}
        onClick={() => {
          useGameStore.getState().undo();
        }}
      />
      <ToolButton
        label={t('game.redo')}
        disabled={!canRedo}
        onClick={() => {
          useGameStore.getState().redo();
        }}
      />
      <ToolButton
        label={t('game.reset')}
        disabled={counts.every((value) => value === 0)}
        onClick={() => {
          useGameStore.getState().reset();
        }}
      />
      <ToolButton label={`${t('game.hint')} (${String(hintsLeft)})`} onClick={requestHint} />
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            useAppStore.getState().pauseTimer();
            useAppStore.getState().back();
          }}
          aria-label={t('game.back')}
          className="-ml-2 flex min-h-12 min-w-12 items-center justify-center rounded-xl text-2xl text-slate-300"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium">
            {active ? t(`difficulty.${active.difficulty}`) : ''}
          </p>
          <p className="text-xs text-slate-400">{formatDuration(elapsedMs)}</p>
        </div>
        <span className="min-w-12 text-right text-xs text-slate-400">
          {t('game.hintsLeft', { count: hintsLeft })}
        </span>
      </header>

      <main className="relative min-h-0 flex-1 px-2">
        <BoardCanvas theme={theme === 'light' ? 'light' : 'dark'} />
      </main>

      {hint ? (
        <div className="px-4 pb-2">
          <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
            {t(hint.messageKey as 'hint.generic')}
          </p>
        </div>
      ) : null}

      <nav
        className={`flex items-center gap-1.5 px-3 py-3 ${leftHanded ? 'flex-row-reverse' : ''}`}
      >
        {toolbar}
      </nav>

      {showHintDialog ? (
        <RewardDialog
          onClose={() => {
            setShowHintDialog(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled = false,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-12 min-w-0 flex-1 truncate rounded-xl bg-slate-800 px-2 text-sm font-medium text-slate-100 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
