import type { Difficulty } from '../config/game.ts';

export type { Difficulty };

/** Anzahl paralleler Bruecken auf einer Kante. */
export type BridgeCount = 0 | 1 | 2;

/**
 * Eine Insel im Gitter.
 * `required` ist die Zahl auf der Insel, also die geforderte Anzahl anliegender Brueckenenden.
 */
export interface Island {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly required: number;
}

/**
 * Eine moegliche Verbindung zwischen zwei benachbarten Inseln.
 * „Benachbart" heisst: gleiche Zeile oder Spalte, keine Insel dazwischen.
 * `a` ist immer die Insel mit der kleineren Id.
 */
export interface EdgeDef {
  readonly id: number;
  readonly a: number;
  readonly b: number;
  readonly horizontal: boolean;
}

/**
 * Vorberechnete Struktur eines Raetsels: Inseln, Kandidatenkanten, Nachbarschaften
 * und Kreuzungen. Enthaelt bewusst keinen Spielstand — der liegt in `PuzzleState`.
 */
export interface Board {
  readonly width: number;
  readonly height: number;
  readonly islands: readonly Island[];
  readonly edges: readonly EdgeDef[];
  /** Kanten-Ids je Insel (Index = Insel-Id). */
  readonly edgesByIsland: readonly (readonly number[])[];
  /** Kanten-Ids, die die jeweilige Kante kreuzen (Index = Kanten-Id). */
  readonly crossings: readonly (readonly number[])[];
  /** Geforderte Brueckenenden je Insel, als Typed Array fuer die heissen Schleifen. */
  readonly required: Uint8Array;
}

/**
 * Ein vollstaendig beschriebenes, verifiziert eindeutig loesbares Raetsel.
 * `solution` ist nach Kanten-Id indiziert; die Kantenreihenfolge ergibt sich
 * deterministisch aus den Inseln (siehe `buildBoard`).
 */
export interface PuzzleDefinition {
  readonly id: string;
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly width: number;
  readonly height: number;
  readonly islands: readonly Island[];
  readonly solution: readonly BridgeCount[];
}

/** Ergebnis der Regelpruefung eines Spielstands. */
export interface ValidationIssue {
  readonly kind: 'overfilled' | 'crossing';
  /** Insel-Id bei `overfilled`, Kanten-Id bei `crossing`. */
  readonly ref: number;
}
