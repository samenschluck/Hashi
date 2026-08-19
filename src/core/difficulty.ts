import { HARD_ADVANCED_STEPS, type Difficulty } from '../config/game.ts';
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
}

/** Untersucht, welche Schlussweisen ein Board tatsaechlich verlangt. */
export function analyzeBoard(board: Board): DifficultyAnalysis {
  for (const level of DEDUCTION_LEVELS) {
    const store = new ConstraintStore(board);
    const result = store.propagate(level);
    if (
      result.status === 'ok' &&
      result.complete &&
      isValidSolution(board, store.currentAssignment())
    ) {
      return { level, advancedSteps: store.advancedUsage };
    }
  }
  return { level: null, advancedSteps: 0 };
}

/** Flachste noetige Deduktionstiefe, oder `null` wenn das Raetsel Raten erfordert. */
export function requiredDeductionLevel(board: Board): DeductionLevel | null {
  return analyzeBoard(board).level;
}

/**
 * Schwierigkeitsgrad eines Boards, oder `null` wenn es nicht rein deduktiv loesbar ist.
 *
 * - **easy**: nur Inselgrade und Kreuzungsausschluss (D1–D4)
 * - **medium**: zusaetzlich Isolations- oder Zusammenhangsschluesse, aber wenige
 * - **hard**: dieselben Schlussweisen, aber oft genug, um echte Arbeit zu sein
 * - **expert**: ohne Widerspruchsbeweis (D7) nicht loesbar
 *
 * Ergaenzt wird das im Generator durch die Boardgroesse je Grad.
 */
export function classifyDifficulty(board: Board): Difficulty | null {
  const { level, advancedSteps } = analyzeBoard(board);
  if (level === null) {
    return null;
  }
  if (level === 1) {
    return 'easy';
  }
  if (level === 4) {
    return 'expert';
  }
  return advancedSteps >= HARD_ADVANCED_STEPS ? 'hard' : 'medium';
}
