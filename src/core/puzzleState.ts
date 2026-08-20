import { MAX_BRIDGES_PER_EDGE } from '../config/game.ts';
import { UnionFind } from './unionFind.ts';
import type { Board, BridgeCount, ValidationIssue } from './types.ts';

/** Ein einzelner Zug, wie er im Undo-Stapel liegt. */
export interface Move {
  readonly edgeId: number;
  readonly from: BridgeCount;
  readonly to: BridgeCount;
}

export type IslandStatus = 'open' | 'satisfied' | 'overfilled';

/**
 * Veraenderlicher Spielstand zu einem Board.
 *
 * Bewusste Entwurfsentscheidung: Ueberfuellte Inseln sind erlaubt und werden nur
 * markiert. Das Spiel kennt keine Verlierbedingung, also darf der Spieler in eine
 * falsche Stellung laufen und sie selbst wieder aufloesen. Was hart verboten
 * bleibt, sind Zuege, die die Geometrie verletzen: Kreuzungen und mehr als zwei
 * parallele Bruecken.
 */
export class PuzzleState {
  readonly board: Board;

  private readonly counts: Uint8Array;
  private readonly degrees: Uint8Array;
  private readonly undoStack: Move[] = [];
  private readonly redoStack: Move[] = [];
  private readonly unionFind: UnionFind;

  constructor(board: Board) {
    this.board = board;
    this.counts = new Uint8Array(board.edges.length);
    this.degrees = new Uint8Array(board.islands.length);
    this.unionFind = new UnionFind(board.islands.length);
  }

  /** Aktueller Brueckenstand, nach Kanten-Id indiziert. Nur lesend verwenden. */
  get bridgeCounts(): Readonly<Uint8Array> {
    return this.counts;
  }

  getCount(edgeId: number): BridgeCount {
    return this.counts[edgeId] as BridgeCount;
  }

  degreeOf(islandId: number): number {
    return this.degrees[islandId]!;
  }

  islandStatus(islandId: number): IslandStatus {
    const degree = this.degrees[islandId]!;
    const required = this.board.required[islandId]!;
    if (degree > required) {
      return 'overfilled';
    }
    return degree === required ? 'satisfied' : 'open';
  }

  /** Kreuzt die Kante eine bereits gesetzte Bruecke? */
  isBlocked(edgeId: number): boolean {
    for (const other of this.board.crossings[edgeId] ?? []) {
      if (this.counts[other]! > 0) {
        return true;
      }
    }
    return false;
  }

  /** Ist der Zug geometrisch erlaubt? Ueberfuellung gilt hier nicht als Verstoss. */
  canSet(edgeId: number, count: BridgeCount): boolean {
    if (count < 0 || count > MAX_BRIDGES_PER_EDGE) {
      return false;
    }
    return count === 0 || !this.isBlocked(edgeId);
  }

  /**
   * Setzt eine Kante auf einen Wert. Liefert den ausgefuehrten Zug oder null,
   * wenn nichts zu tun war oder der Zug geometrisch unzulaessig ist.
   */
  set(edgeId: number, count: BridgeCount): Move | null {
    const from = this.getCount(edgeId);
    if (from === count || !this.canSet(edgeId, count)) {
      return null;
    }
    const move: Move = { edgeId, from, to: count };
    this.applyMove(move);
    this.undoStack.push(move);
    this.redoStack.length = 0;
    return move;
  }

  /**
   * Schaltet eine Kante weiter: keine Bruecke → eine → zwei → keine.
   * Das ist das Verhalten fuer wiederholtes Ziehen oder Antippen.
   */
  cycle(edgeId: number): Move | null {
    const current = this.getCount(edgeId);
    const next = ((current + 1) % (MAX_BRIDGES_PER_EDGE + 1)) as BridgeCount;
    return this.set(edgeId, next);
  }

  undo(): Move | null {
    const move = this.undoStack.pop();
    if (!move) {
      return null;
    }
    this.applyMove({ edgeId: move.edgeId, from: move.to, to: move.from });
    this.redoStack.push(move);
    return move;
  }

  redo(): Move | null {
    const move = this.redoStack.pop();
    if (!move) {
      return null;
    }
    this.applyMove(move);
    this.undoStack.push(move);
    return move;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Leert das Brett und den Verlauf. */
  reset(): void {
    this.counts.fill(0);
    this.degrees.fill(0);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /** Kopie des Brueckenstands, z.B. zum Speichern. */
  snapshot(): Uint8Array {
    return Uint8Array.from(this.counts);
  }

  /**
   * Stellt einen Brueckenstand wieder her. Der Verlauf wird geleert, weil ein
   * geladener Stand keinen sinnvollen Undo-Verlauf hat.
   */
  restore(counts: ArrayLike<number>): void {
    if (counts.length !== this.counts.length) {
      throw new RangeError(
        `Spielstand passt nicht zum Board: ${String(counts.length)} statt ${String(this.counts.length)} Kanten`,
      );
    }
    this.reset();
    for (let edgeId = 0; edgeId < counts.length; edgeId++) {
      const value = counts[edgeId] ?? 0;
      if (value > 0) {
        this.applyMove({ edgeId, from: 0, to: value as BridgeCount });
      }
    }
  }

  /** Alle Regelverstoesse des aktuellen Stands. */
  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const island of this.board.islands) {
      if (this.degrees[island.id]! > island.required) {
        issues.push({ kind: 'overfilled', ref: island.id });
      }
    }

    for (const edge of this.board.edges) {
      if (this.counts[edge.id]! === 0) {
        continue;
      }
      for (const other of this.board.crossings[edge.id] ?? []) {
        if (this.counts[other]! > 0 && other > edge.id) {
          issues.push({ kind: 'crossing', ref: edge.id });
        }
      }
    }

    return issues;
  }

  /** Sind alle Inselwerte exakt erfuellt? */
  allIslandsSatisfied(): boolean {
    for (let id = 0; id < this.degrees.length; id++) {
      if (this.degrees[id] !== this.board.required[id]) {
        return false;
      }
    }
    return true;
  }

  /** Bilden die gesetzten Bruecken ein einziges zusammenhaengendes Netz? */
  isConnected(): boolean {
    if (this.board.islands.length <= 1) {
      return true;
    }
    this.unionFind.reset();
    for (const edge of this.board.edges) {
      if (this.counts[edge.id]! > 0) {
        this.unionFind.union(edge.a, edge.b);
      }
    }
    return this.unionFind.components === 1;
  }

  /**
   * Gewinnbedingung: alle Inselwerte exakt erfuellt UND ein einziges
   * zusammenhaengendes Netz. Beides ist noetig — ein Brett mit passenden Zahlen,
   * aber zwei getrennten Netzen ist nicht geloest.
   */
  isSolved(): boolean {
    return this.allIslandsSatisfied() && this.isConnected();
  }

  private applyMove(move: Move): void {
    const edge = this.board.edges[move.edgeId]!;
    const delta = move.to - move.from;
    this.counts[move.edgeId] = move.to;
    this.degrees[edge.a] = this.degrees[edge.a]! + delta;
    this.degrees[edge.b] = this.degrees[edge.b]! + delta;
  }
}
