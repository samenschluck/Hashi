/**
 * Prueft die Deduktionsregeln auf Korrektheit gegen bekannte Loesungen.
 *
 * Eine falsche Regel ist der gefaehrlichste Fehler in diesem Projekt: Sie
 * schliesst still den richtigen Wert aus, der Solver findet dann keine oder eine
 * falsche Loesung, und das Tipp-System begruendet Unsinn. Deshalb wird nach jeder
 * Propagation geprueft, dass der Wertebereich jeder Kante die echte Loesung noch
 * enthaelt.
 *
 * Aufruf: `node scripts/check-soundness.ts`
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTIES, type Difficulty } from '../src/config/game.ts';
import { ConstraintStore, DEDUCTION_LEVELS } from '../src/core/deductions.ts';
import { buildBoard } from '../src/core/geometry.ts';
import { unpackPuzzle, type PuzzlePack } from '../src/core/serialization.ts';

const here = dirname(fileURLToPath(import.meta.url));
const puzzleDirectory = resolve(here, '../src/data/puzzles');

let checked = 0;
let violations = 0;

async function check(difficulty: Difficulty): Promise<void> {
  const file = resolve(puzzleDirectory, `${difficulty}.json`);
  const pack = JSON.parse(await readFile(file, 'utf8')) as PuzzlePack;

  for (const packed of pack.puzzles) {
    const puzzle = unpackPuzzle(packed, difficulty, pack.size);
    const board = buildBoard(puzzle.width, puzzle.height, puzzle.islands);

    for (const level of DEDUCTION_LEVELS) {
      const store = new ConstraintStore(board);
      store.propagate(level);
      checked++;

      if (store.hasContradiction()) {
        violations++;
        console.error(`${packed.id} Stufe ${String(level)}: Widerspruch auf loesbarem Board`);
        continue;
      }

      for (let edgeId = 0; edgeId < board.edges.length; edgeId++) {
        const truth = puzzle.solution[edgeId]!;
        if (store.lowerBound(edgeId) > truth || store.upperBound(edgeId) < truth) {
          violations++;
          console.error(
            `${packed.id} Stufe ${String(level)}: Kante ${String(edgeId)} auf ` +
              `[${String(store.lowerBound(edgeId))}, ${String(store.upperBound(edgeId))}] ` +
              `eingeschraenkt, echte Loesung ist ${String(truth)}`,
          );
          break;
        }
      }
    }
  }
}

for (const difficulty of DIFFICULTIES) {
  await check(difficulty);
}

console.log(`${String(checked)} Propagationen geprueft, ${String(violations)} Verletzungen.`);
if (violations > 0) {
  process.exitCode = 1;
}
