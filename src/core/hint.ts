import { ConstraintStore, type RuleId } from './deductions.ts';
import type { Board, BridgeCount } from './types.ts';

export type HintKind =
  /** Ein zwingender Zug, den der Spieler jetzt setzen kann. */
  | 'placement'
  /** Eine gesetzte Bruecke kommt in der Loesung nicht vor. */
  | 'removeWrong'
  /** Nichts zu tun — das Raetsel ist bereits geloest. */
  | 'solved'
  /** Es liess sich kein Tipp ableiten (sollte bei ausgelieferten Raetseln nie vorkommen). */
  | 'unavailable';

export interface Hint {
  readonly kind: HintKind;
  readonly edgeId: number | null;
  /** Zielwert der Kante. Bei `removeWrong` der korrekte Wert aus der Loesung. */
  readonly value: BridgeCount | null;
  readonly ruleId: RuleId | null;
  readonly islandId: number | null;
  /** i18n-Schluessel fuer die Begruendung in Klartext. */
  readonly messageKey: string;
}

/** Ist der Spielstand eine Teilmenge der eindeutigen Loesung? */
export function isSubsetOfSolution(
  playerCounts: ArrayLike<number>,
  solution: ArrayLike<number>,
): boolean {
  for (let edgeId = 0; edgeId < solution.length; edgeId++) {
    if ((playerCounts[edgeId] ?? 0) > (solution[edgeId] ?? 0)) {
      return false;
    }
  }
  return true;
}

/**
 * Ermittelt den naechsten Tipp.
 *
 * Weil es keine Verlierbedingung gibt, landet ein Spieler regelmaessig in einer
 * Stellung, die der eindeutigen Loesung widerspricht. Ein rein deduktiver Tipp
 * haette dort nichts Sinnvolles zu sagen. Deshalb wird zuerst geprueft, ob der
 * Stand ueberhaupt noch zur Loesung passt; wenn nicht, zeigt der Tipp die falsche
 * Bruecke statt ins Leere zu laufen.
 *
 * Ein Tipp deckt immer nur den naechsten zwingenden Zug auf, nie die Loesung.
 */
export function findHint(
  board: Board,
  playerCounts: ArrayLike<number>,
  solution: ArrayLike<number>,
): Hint {
  // 1. Falsch gesetzte Bruecke?
  for (let edgeId = 0; edgeId < board.edges.length; edgeId++) {
    const placed = playerCounts[edgeId] ?? 0;
    const target = solution[edgeId] ?? 0;
    if (placed > target) {
      return {
        kind: 'removeWrong',
        edgeId,
        value: target as BridgeCount,
        ruleId: null,
        islandId: null,
        messageKey: 'hint.removeWrong',
      };
    }
  }

  // 2. Schon fertig?
  let missing = false;
  for (let edgeId = 0; edgeId < board.edges.length; edgeId++) {
    if ((playerCounts[edgeId] ?? 0) < (solution[edgeId] ?? 0)) {
      missing = true;
      break;
    }
  }
  if (!missing) {
    return {
      kind: 'solved',
      edgeId: null,
      value: null,
      ruleId: null,
      islandId: null,
      messageKey: 'hint.solved',
    };
  }

  // 3. Naechsten zwingenden Zug herleiten — mitsamt Begruendung.
  const store = new ConstraintStore(board);
  for (let edgeId = 0; edgeId < board.edges.length; edgeId++) {
    const placed = playerCounts[edgeId] ?? 0;
    if (placed > 0) {
      store.setFloor(edgeId, placed);
    }
  }

  if (!store.hasContradiction()) {
    store.beginRecordingPlacements();
    const result = store.propagate(4, true);
    const placement = result.firstPlacement;
    if (placement) {
      return {
        kind: 'placement',
        edgeId: placement.edgeId,
        value: placement.value,
        ruleId: placement.ruleId,
        islandId: placement.islandId,
        messageKey: `hint.rule.${placement.ruleId}`,
      };
    }
  }

  // 4. Rueckfallebene: die Loesung kennt den Zug, auch wenn die Deduktion ihn
  //    gerade nicht begruenden kann. Besser ein Tipp ohne Erklaerung als keiner.
  for (let edgeId = 0; edgeId < board.edges.length; edgeId++) {
    const placed = playerCounts[edgeId] ?? 0;
    const target = solution[edgeId] ?? 0;
    if (target > placed) {
      return {
        kind: 'placement',
        edgeId,
        value: target as BridgeCount,
        ruleId: null,
        islandId: null,
        messageKey: 'hint.generic',
      };
    }
  }

  return {
    kind: 'unavailable',
    edgeId: null,
    value: null,
    ruleId: null,
    islandId: null,
    messageKey: 'hint.unavailable',
  };
}
