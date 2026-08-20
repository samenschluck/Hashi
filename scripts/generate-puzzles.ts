/**
 * Erzeugt die ausgelieferten Raetsel als JSON.
 *
 * Laeuft zur Build-Zeit, nicht auf dem Geraet: die Eindeutigkeitspruefung ist
 * hier beliebig teuer, und die App startet dafuer sofort mit fertigen Raetseln.
 *
 * Aufruf: `npm run puzzles:generate [-- --count=150]`
 *
 * Node fuehrt diese TypeScript-Datei direkt aus (Type-Stripping); deshalb ist im
 * Projekt `erasableSyntaxOnly` gesetzt.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD_SIZE,
  DIFFICULTIES,
  PREGENERATED_PUZZLES_PER_DIFFICULTY,
  type Difficulty,
} from '../src/config/game.ts';
import { tryGenerate } from '../src/core/generator.ts';
import { packPuzzle, type PackedPuzzle, type PuzzlePack } from '../src/core/serialization.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(here, '../src/data/puzzles');

function parseCount(): number {
  const argument = process.argv.find((value) => value.startsWith('--count='));
  if (!argument) {
    return PREGENERATED_PUZZLES_PER_DIFFICULTY;
  }
  const value = Number.parseInt(argument.slice('--count='.length), 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Ungueltige Anzahl: ${argument}`);
  }
  return value;
}

function generateFor(difficulty: Difficulty, count: number): PuzzlePack {
  const puzzles: PackedPuzzle[] = [];
  const started = performance.now();

  let attempt = 0;
  while (puzzles.length < count) {
    // Der Seed enthaelt den Grad und eine laufende Nummer: dieselbe Datei
    // entsteht damit auf jedem Rechner bitgleich neu.
    const seed = `${difficulty}-${String(attempt).padStart(5, '0')}`;
    const puzzle = tryGenerate(seed, difficulty);
    attempt++;

    if (!puzzle) {
      if (attempt > count * 50) {
        throw new Error(`Zu viele Fehlversuche fuer ${difficulty}`);
      }
      continue;
    }

    puzzles.push({
      ...packPuzzle(puzzle),
      id: `${difficulty}-${String(puzzles.length + 1).padStart(4, '0')}`,
    });

    if (puzzles.length % 25 === 0) {
      console.log(`  ${difficulty}: ${String(puzzles.length)}/${String(count)}`);
    }
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `${difficulty}: ${String(count)} Raetsel in ${seconds} s (${String(attempt)} Versuche)`,
  );

  return { difficulty, size: BOARD_SIZE[difficulty], puzzles };
}

async function main(): Promise<void> {
  const count = parseCount();
  await mkdir(outputDirectory, { recursive: true });

  for (const difficulty of DIFFICULTIES) {
    const pack = generateFor(difficulty, count);
    const target = resolve(outputDirectory, `${difficulty}.json`);
    await writeFile(target, `${JSON.stringify(pack)}\n`, 'utf8');
  }

  console.log(`Fertig. Dateien liegen in ${outputDirectory}`);
}

await main();
