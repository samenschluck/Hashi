import { DIFFICULTY_CRITERIA, type Difficulty } from '../config/game.ts';
import { ConstraintStore, DEDUCTION_LEVELS, type DeductionLevel } from './deductions.ts';
import { isValidSolution } from './solver.ts';
import type { Board } from './types.ts';

export interface DifficultyAnalysis {
  /**
   * Flachste Deduktionstiefe, mit der sich das Board rein durch Propagation loesen
   * laesst — also ohne Raten. `null` heisst: selbst mit Probeannahmen bleibt das
   * Raetsel unvollstaendig und waere nur durch Suche loesbar. Solche Raetsel werden
   * nicht ausgeliefert, weil das Tipp-System sie nicht erklaeren koennte.
   */
  readonly level: DeductionLevel | null;
  /** Anzahl der noetigen Schluesse oberhalb der Grundregeln D1–D4. */
  readonly advancedSteps: number;
  /** Laengste Strecke reiner Routinezuege am Stueck (siehe `ConstraintStore`). */
  readonly longestRoutineRun: number;
}

/** Untersucht, welche Schlussweisen ein Board tatsaechlich verlangt. */
export function analyzeBoard(board: Board): DifficultyAnalysis {
  for (const level of DEDUCTION_LEVELS) {
    const store = new ConstraintStore(board);
    store.enableTrace();
    const result = store.propagate(level);
    if (
      result.status === 'ok' &&
      result.complete &&
      isValidSolution(board, store.currentAssignment())
    ) {
      return {
        level,
        advancedSteps: store.advancedUsage,
        longestRoutineRun: store.longestRoutineRun,
      };
    }
  }
  return { level: null, advancedSteps: 0, longestRoutineRun: 0 };
}

/** Flachste noetige Deduktionstiefe, oder `null` wenn das Raetsel Raten erfordert. */
export function requiredDeductionLevel(board: Board): DeductionLevel | null {
  return analyzeBoard(board).level;
}

/**
 * Von streng nach mild geprueft: „schwer" und „mittel" teilen sich eine
 * Deduktionstiefe und unterscheiden sich nur in der geforderten Menge an
 * Einsichten, deshalb muss der haertere Grad zuerst zugreifen.
 */
const GRADE_ORDER = ['expert', 'hard', 'medium', 'easy'] as const;

/**
 * Schwierigkeitsgrad eines Boards, oder `null` wenn es zu keinem Grad passt.
 *
 * Geprueft wird gegen `DIFFICULTY_CRITERIA`: noetige Deduktionstiefe, Menge der
 * fortgeschrittenen Schluesse und die laengste Leerlaufstrecke dazwischen. Ein
 * Board, das keinem Grad genuegt, wird verworfen und nicht etwa herabgestuft —
 * ein herabgestuftes Raetsel truege seinen Leerlauf einfach in den naechsten
 * Grad weiter, und dort waere es ausserdem fuer die Brettgroesse zu gross.
 */
export function classifyDifficulty(board: Board): Difficulty | null {
  const { level, advancedSteps, longestRoutineRun } = analyzeBoard(board);
  if (level === null) {
    return null;
  }

  for (const grade of GRADE_ORDER) {
    const criteria = DIFFICULTY_CRITERIA[grade];
    if (
      criteria.levels.includes(level) &&
      advancedSteps >= criteria.minAdvancedSteps &&
      longestRoutineRun <= criteria.maxRoutineRun
    ) {
      return grade;
    }
  }

  return null;
}
