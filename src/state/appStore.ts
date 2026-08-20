import { create } from 'zustand';
import { DAILY_DIFFICULTY, HINTS, type Difficulty } from '../config/game.ts';
import { findHint, type Hint } from '../core/hint.ts';
import { serializeCounts } from '../core/parse.ts';
import {
  clearInProgress,
  createDefaultSave,
  dayKey,
  effectiveNow,
  grantDailyHints,
  recordDailySolved,
  recordSolved,
  registerRewardedWatch,
  spendHint,
  storeInProgress,
  touchClock,
  type SaveData,
  type Settings,
} from '../core/progression.ts';
import { deserializeCounts } from '../core/parse.ts';
import { loadLevel, loadPack } from '../data/puzzles.ts';
import { translate, type TranslationKey } from '../i18n/index.ts';
import { generatePuzzle } from '../services/puzzleFactory.ts';
import { setHapticsEnabled } from '../services/haptics.ts';
import { clearSave, flushSave, loadSave, scheduleSave } from '../services/storage.ts';
import type { PuzzleDefinition } from '../core/types.ts';
import { useGameStore } from './gameStore.ts';

export type Screen =
  'splash' | 'menu' | 'levels' | 'game' | 'result' | 'daily' | 'stats' | 'settings' | 'rules';

export type GameMode = 'campaign' | 'daily' | 'endless';

export interface ActiveLevel {
  readonly levelId: string;
  readonly difficulty: Difficulty;
  readonly puzzle: PuzzleDefinition;
  readonly mode: GameMode;
  /** Position im Kapitel, nur im Kampagnenmodus. */
  readonly index: number | null;
  /** Kalendertag, nur beim Tagesraetsel. */
  readonly day: string | null;
}

export interface LevelResult {
  readonly timeMs: number;
  readonly isNewBest: boolean;
  readonly hintsUsed: number;
}

export interface AppStore {
  readonly ready: boolean;
  readonly save: SaveData;
  readonly screen: Screen;
  readonly stack: readonly Screen[];
  readonly selectedDifficulty: Difficulty;
  readonly levelCounts: Readonly<Partial<Record<Difficulty, number>>>;
  readonly active: ActiveLevel | null;
  readonly busy: boolean;
  readonly hint: Hint | null;
  readonly hintsUsedInLevel: number;
  readonly result: LevelResult | null;
  readonly notice: string | null;
  /** Laufende Spielzeit in Millisekunden. Sie laeuft nur hoch, nie ab. */
  readonly elapsedMs: number;

  init: () => Promise<void>;
  t: (key: TranslationKey, params?: Readonly<Record<string, string | number>>) => string;

  navigate: (screen: Screen) => void;
  back: () => boolean;

  setDifficulty: (difficulty: Difficulty) => void;
  startCampaignLevel: (difficulty: Difficulty, index: number) => Promise<void>;
  startDaily: () => Promise<void>;
  startEndless: (difficulty: Difficulty) => Promise<void>;
  startNextLevel: () => Promise<void>;
  replayLevel: () => void;

  requestHint: () => 'placed' | 'empty' | 'none';
  clearHint: () => void;
  grantRewardHints: () => void;

  tick: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;

  persistProgress: () => void;
  handleSolved: () => void;

  updateSettings: (partial: Partial<Settings>) => void;
  setConsentCompleted: (value: boolean) => void;
  clearProgress: () => Promise<void>;
  setNotice: (message: string | null) => void;
}

/** Zeitmessung: Startzeitpunkt und bereits aufgelaufene Zeit. */
let timerStartedAt: number | null = null;
let accumulatedMs = 0;

function currentElapsed(): number {
  return accumulatedMs + (timerStartedAt === null ? 0 : Date.now() - timerStartedAt);
}

export const useAppStore = create<AppStore>((set, get) => {
  /** Aendert den Spielstand und merkt ihn zum Speichern vor. */
  const mutate = (change: (save: SaveData) => SaveData): SaveData => {
    const next = change(get().save);
    set({ save: next });
    scheduleSave(next);
    return next;
  };

  const applySettings = (settings: Settings): void => {
    setHapticsEnabled(settings.vibration);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = settings.theme;
      document.documentElement.lang = settings.locale;
    }
  };

  /** Startet ein Level und wechselt auf den Spielbildschirm. */
  const beginLevel = (level: ActiveLevel): void => {
    const saved = get().save.inProgress[level.levelId];
    const counts = saved ? deserializeCounts(saved.counts) : undefined;

    useGameStore.getState().loadPuzzle(level.puzzle, counts);

    accumulatedMs = saved?.elapsedMs ?? 0;
    timerStartedAt = Date.now();

    set({
      active: level,
      hint: null,
      hintsUsedInLevel: 0,
      result: null,
      busy: false,
      elapsedMs: accumulatedMs,
      screen: 'game',
      stack: [...get().stack, get().screen],
    });
  };

  return {
    ready: false,
    save: createDefaultSave(),
    screen: 'splash',
    stack: [],
    selectedDifficulty: 'easy',
    levelCounts: {},
    active: null,
    busy: false,
    hint: null,
    hintsUsedInLevel: 0,
    result: null,
    notice: null,
    elapsedMs: 0,

    init: async () => {
      const loaded = await loadSave();
      const { save: withHints, granted } = grantDailyHints(loaded, Date.now());

      applySettings(withHints.settings);
      set({
        save: withHints,
        ready: true,
        screen: 'menu',
        stack: [],
        notice:
          granted > 0
            ? translate(withHints.settings.locale, 'hints.dailyGrant', { count: granted })
            : null,
      });
      if (granted > 0) {
        scheduleSave(withHints);
      }

      // Levelzahlen einmal ermitteln, damit die Uebersicht sofort etwas anzeigt.
      const counts: Partial<Record<Difficulty, number>> = {};
      for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
        counts[difficulty] = (await loadPack(difficulty)).puzzles.length;
      }
      set({ levelCounts: counts });
    },

    t: (key, params) => translate(get().save.settings.locale, key, params),

    navigate: (screen) => {
      set({ screen, stack: [...get().stack, get().screen] });
    },

    back: () => {
      const { stack, screen } = get();
      if (screen === 'menu' || stack.length === 0) {
        return false;
      }
      const previous = stack[stack.length - 1] ?? 'menu';
      // Der Ergebnisbildschirm fuehrt nicht zurueck ins laufende Spiel.
      const target = previous === 'game' || previous === 'result' ? 'levels' : previous;
      set({ screen: target, stack: stack.slice(0, -1) });
      return true;
    },

    setDifficulty: (difficulty) => {
      set({ selectedDifficulty: difficulty });
    },

    startCampaignLevel: async (difficulty, index) => {
      set({ busy: true });
      const puzzle = await loadLevel(difficulty, index);
      if (!puzzle) {
        set({ busy: false });
        return;
      }
      beginLevel({
        levelId: puzzle.id,
        difficulty,
        puzzle,
        mode: 'campaign',
        index,
        day: null,
      });
    },

    startDaily: async () => {
      set({ busy: true });
      const day = dayKey(effectiveNow(get().save, Date.now()));
      const puzzle = await generatePuzzle(`daily-${day}`, DAILY_DIFFICULTY);
      if (!puzzle) {
        set({ busy: false });
        return;
      }
      beginLevel({
        levelId: `daily-${day}`,
        difficulty: DAILY_DIFFICULTY,
        puzzle: { ...puzzle, id: `daily-${day}` },
        mode: 'daily',
        index: null,
        day,
      });
    },

    startEndless: async (difficulty) => {
      set({ busy: true });
      const seed = `endless-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
      const puzzle = await generatePuzzle(seed, difficulty);
      if (!puzzle) {
        set({ busy: false });
        return;
      }
      beginLevel({
        levelId: `endless-${seed}`,
        difficulty,
        puzzle: { ...puzzle, id: `endless-${seed}` },
        mode: 'endless',
        index: null,
        day: null,
      });
    },

    startNextLevel: async () => {
      const active = get().active;
      if (!active) {
        return;
      }
      if (active.mode === 'campaign' && active.index !== null) {
        const total = get().levelCounts[active.difficulty] ?? 0;
        const next = active.index + 1;
        if (next < total) {
          await get().startCampaignLevel(active.difficulty, next);
          return;
        }
        set({ screen: 'levels' });
        return;
      }
      await get().startEndless(active.difficulty);
    },

    replayLevel: () => {
      const active = get().active;
      if (!active) {
        return;
      }
      mutate((save) => clearInProgress(save, active.levelId));
      beginLevel(active);
    },

    requestHint: () => {
      const { active, save } = get();
      const board = useGameStore.getState().board;
      if (!active || !board) {
        return 'none';
      }
      if (save.hints.balance <= 0) {
        return 'empty';
      }

      const hint = findHint(board, useGameStore.getState().counts, active.puzzle.solution);
      if (hint.kind === 'solved' || hint.kind === 'unavailable') {
        return 'none';
      }

      const { save: spentSave, spent } = spendHint(save);
      if (!spent) {
        return 'empty';
      }
      set({ save: spentSave, hint, hintsUsedInLevel: get().hintsUsedInLevel + 1 });
      scheduleSave(spentSave);
      useGameStore.getState().setHintEdge(hint.edgeId);
      return 'placed';
    },

    clearHint: () => {
      set({ hint: null });
      useGameStore.getState().setHintEdge(null);
    },

    grantRewardHints: () => {
      // Wird nach einem vollstaendig angesehenen Video gerufen. Die Gutschrift
      // wird sofort geschrieben, damit sie auch ein hartes Beenden ueberlebt.
      mutate((save) => registerRewardedWatch(save, Date.now()));
      void flushSave();
      set({ notice: get().t('hints.granted', { count: HINTS.rewardedGrant }) });
    },

    tick: () => {
      if (timerStartedAt !== null) {
        set({ elapsedMs: currentElapsed() });
      }
    },

    pauseTimer: () => {
      if (timerStartedAt !== null) {
        accumulatedMs = currentElapsed();
        timerStartedAt = null;
        set({ elapsedMs: accumulatedMs });
      }
      get().persistProgress();
      void flushSave();
    },

    resumeTimer: () => {
      if (timerStartedAt === null && get().screen === 'game') {
        timerStartedAt = Date.now();
      }
    },

    persistProgress: () => {
      const active = get().active;
      if (!active || useGameStore.getState().solved) {
        return;
      }
      const counts = serializeCounts(useGameStore.getState().counts);
      mutate((save) =>
        touchClock(storeInProgress(save, active.levelId, counts, currentElapsed()), Date.now()),
      );
    },

    handleSolved: () => {
      const active = get().active;
      if (!active || get().result) {
        return;
      }

      const timeMs = currentElapsed();
      timerStartedAt = null;
      accumulatedMs = timeMs;

      const previousBest = get().save.levels[active.levelId]?.bestTimeMs ?? null;
      const hintsUsed = get().hintsUsedInLevel;

      const next = mutate((save) => {
        let updated = recordSolved(save, {
          levelId: active.levelId,
          difficulty: active.difficulty,
          timeMs,
          hintsUsed,
        });
        if (active.mode === 'daily' && active.day) {
          updated = recordDailySolved(updated, active.day);
        }
        return touchClock(updated, Date.now());
      });
      void flushSave();

      set({
        result: {
          timeMs,
          isNewBest: previousBest === null || timeMs < previousBest,
          hintsUsed,
        },
        elapsedMs: timeMs,
        screen: 'result',
        stack: [...get().stack, 'game'],
        save: next,
      });
    },

    updateSettings: (partial) => {
      const next = mutate((save) => ({ ...save, settings: { ...save.settings, ...partial } }));
      applySettings(next.settings);
    },

    setConsentCompleted: (value) => {
      mutate((save) => ({ ...save, ads: { ...save.ads, consentCompleted: value } }));
    },

    clearProgress: async () => {
      await clearSave();
      const fresh = createDefaultSave();
      applySettings(fresh.settings);
      set({ save: fresh, screen: 'menu', stack: [], active: null, result: null });
    },

    setNotice: (message) => {
      set({ notice: message });
    },
  };
});
