/**
 * Prueft die ausgelieferten Raetseldateien gegen den Solver.
 *
 * Laeuft in der CI bei jedem Push. Der Grund: die JSON-Dateien sind
 * Build-Artefakte, die niemand mehr liest. Wenn dort ein mehrdeutiges oder
 * kaputtes Raetsel landet, faellt es sonst erst dem Spieler auf — und das
 * Tipp-System haette bei einem mehrdeutigen Raetsel keine Grundlage mehr.
 *
 * Aufruf: `npm run puzzles:verify`
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_SIZE, DIFFICULTIES, type Difficulty } from '../src/config/game.ts';
import { classifyDifficulty } from '../src/core/difficulty.ts';
import { buildBoard } from '../src/core/geometry.ts';
import { unpackPuzzle, type PuzzlePack } from '../src/core/serialization.ts';
import { isValidSolution, solve } from '../src/core/solver.ts';

const here = dirname(fileURLToPath(import.meta.url));
const puzzleDirectory = resolve(here, '../src/data/puzzles');

async function verify(difficulty: Difficulty): Promise<number> {
  const file = resolve(puzzleDirectory, `${difficulty}.json`);
  const pack = JSON.parse(await readFile(file, 'utf8')) as PuzzlePack;

  if (pack.difficulty !== difficulty || pack.size !== BOARD_SIZE[difficulty]) {
    throw new Error(`${difficulty}.json: Kopfdaten passen nicht zum Schwierigkeitsgrad`);
  }

  const seenIds = new Set<string>();

  for (const packed of pack.puzzles) {
    if (seenIds.has(packed.id)) {
      throw new Error(`${difficulty}.json: doppelte Id ${packed.id}`);
    }
    seenIds.add(packed.id);

    const puzzle = unpackPuzzle(packed, difficulty, pack.size);
    const board = buildBoard(puzzle.width, puzzle.height, puzzle.islands);

    if (board.edges.length !== puzzle.solution.length) {
      throw new Error(`${packed.id}: Loesung passt nicht zur Kantenzahl`);
    }
    if (!isValidSolution(board, puzzle.solution)) {
      throw new Error(`${packed.id}: mitgelieferte Loesung ist ungueltig`);
    }

    const result = solve(board, { maxSolutions: 2 });
    if (result.count !== 1) {
      throw new Error(`${packed.id}: ${String(result.count)} Loesungen statt genau einer`);
    }

    const classified = classifyDifficulty(board);
    if (classified !== difficulty) {
      throw new Error(`${packed.id}: eingestuft als ${String(classified)}, erwartet ${difficulty}`);
    }
  }

  return pack.puzzles.length;
}

async function main(): Promise<void> {
  let total = 0;
  for (const difficulty of DIFFICULTIES) {
    const started = performance.now();
    const count = await verify(difficulty);
    total += count;
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`${difficulty}: ${String(count)} Raetsel geprueft (${seconds} s)`);
  }
  console.log(`Alle ${String(total)} ausgelieferten Raetsel sind eindeutig loesbar.`);
}

await main();
