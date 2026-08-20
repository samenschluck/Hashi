import { useEffect, useState } from 'react';
import { DIFFICULTIES, type Difficulty } from '../../config/game.ts';
import { levelIds } from '../../data/puzzles.ts';
import { useAppStore } from '../../state/appStore.ts';
import { Button, ScreenFrame } from '../components/Ui.tsx';

/** Kapitelgroesse der Levelauswahl — eine Seite passt ohne Scrollen auf ein Telefon. */
const PAGE_SIZE = 30;

export function LevelSelectScreen(): React.JSX.Element {
  const t = useAppStore((store) => store.t);
  const back = useAppStore((store) => store.back);
  const difficulty = useAppStore((store) => store.selectedDifficulty);
  const setDifficulty = useAppStore((store) => store.setDifficulty);
  const levels = useAppStore((store) => store.save.levels);
  const startLevel = useAppStore((store) => store.startCampaignLevel);
  const startEndless = useAppStore((store) => store.startEndless);
  const busy = useAppStore((store) => store.busy);

  const [ids, setIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    void levelIds(difficulty).then((loaded) => {
      if (active) {
        setIds(loaded);
        setPage(0);
      }
    });
    return () => {
      active = false;
    };
  }, [difficulty]);

  const pageCount = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
  const visible = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const solvedCount = ids.filter((id) => levels[id]?.solved === true).length;

  return (
    <ScreenFrame title={t('levels.title')} onBack={back} backLabel={t('common.back')}>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {DIFFICULTIES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setDifficulty(value);
            }}
            className={`min-h-11 rounded-lg px-1 text-xs font-medium ${
              value === difficulty ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {t(`difficulty.${value}` as const)}
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-slate-400">
        {t('levels.solvedOf', { solved: solvedCount, total: ids.length })}
      </p>

      <div className="grid grid-cols-5 gap-2">
        {visible.map((id, offset) => {
          const index = page * PAGE_SIZE + offset;
          const progress = levels[id];
          return (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => {
                void startLevel(difficulty, index);
              }}
              className={`flex min-h-12 items-center justify-center rounded-lg text-sm font-medium ${
                progress?.solved === true
                  ? 'bg-emerald-700/70 text-emerald-50'
                  : 'bg-slate-800 text-slate-200'
              }`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            disabled={page === 0}
            onClick={() => {
              setPage((value) => Math.max(0, value - 1));
            }}
          >
            ‹
          </Button>
          <span className="text-xs text-slate-400">
            {t('levels.page', { page: page + 1, total: pageCount })}
          </span>
          <Button
            variant="ghost"
            disabled={page >= pageCount - 1}
            onClick={() => {
              setPage((value) => Math.min(pageCount - 1, value + 1));
            }}
          >
            ›
          </Button>
        </div>
      ) : null}

      <div className="mt-6">
        <Button
          full
          disabled={busy}
          onClick={() => {
            void startEndless(difficulty);
          }}
        >
          {t('menu.endless')}
        </Button>
      </div>
    </ScreenFrame>
  );
}

/** Nur zur Typsicherheit der Uebersetzungsschluessel oben. */
export type DifficultyKey = `difficulty.${Difficulty}`;
