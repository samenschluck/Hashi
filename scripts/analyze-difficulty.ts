/**
 * Misst, woraus sich die Schwierigkeit der ausgelieferten Raetsel tatsaechlich
 * zusammensetzt.
 *
 * Hintergrund: Die Einstufung in `classifyDifficulty` verlangt nur eine
 * *Mindestzahl* fortgeschrittener Schluesse. Ob diese Schluesse auf einem
 * grossen Brett noch ins Gewicht fallen, sagt sie nicht — genau das misst
 * dieses Skript. Ausgegeben wird je Grad, wie viele Deduktionsschritte
 * insgesamt noetig sind und welcher Anteil davon ueber die Grundregeln
 * D1–D4 hinausgeht.
 *
 * Aufruf: `node scripts/analyze-difficulty.ts`
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTIES, type Difficulty } from '../src/config/game.ts';
import {
  ConstraintStore,
  DEDUCTION_LEVELS,
  RULE_IDS,
  type RuleId,
} from '../src/core/deductions.ts';
import { analyzeBoard } from '../src/core/difficulty.ts';
import { buildBoard } from '../src/core/geometry.ts';
import { unpackPuzzle, type PuzzlePack } from '../src/core/serialization.ts';
import { isValidSolution } from '../src/core/solver.ts';

const here = dirname(fileURLToPath(import.meta.url));
const puzzleDirectory = resolve(here, '../src/data/puzzles');

interface Sample {
  readonly islands: number;
  readonly edges: number;
  readonly level: number;
  readonly advanced: number;
  readonly total: number;
  readonly perRule: Readonly<Record<RuleId, number>>;
  /** Anteil der Kanten, den allein die Grundregeln D1–D4 schon entscheiden. */
  readonly basicShare: number;
  /** Anteil der Inseln ohne jeden Spielraum — von Anfang an erzwungen. */
  readonly giftShare: number;
  /** Mittlerer Spielraum je Insel: moegliche Brueckenenden minus geforderte. */
  readonly meanSlack: number;
  /** Mittlere Zahl moeglicher Nachbarn je Insel. */
  readonly meanDegree: number;
  /** Laengste Strecke reiner Routinezuege am Stueck. */
  readonly routineRun: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function format(value: number, digits = 1): string {
  return value.toFixed(digits).padStart(6);
}

async function collect(difficulty: Difficulty): Promise<Sample[]> {
  const file = resolve(puzzleDirectory, `${difficulty}.json`);
  const pack = JSON.parse(await readFile(file, 'utf8')) as PuzzlePack;
  const samples: Sample[] = [];

  for (const packed of pack.puzzles) {
    const puzzle = unpackPuzzle(packed, difficulty, pack.size);
    const board = buildBoard(puzzle.width, puzzle.height, puzzle.islands);

    // Auf der flachsten Stufe messen, die reicht — das ist die Stufe, auf der
    // ein Mensch das Raetsel tatsaechlich loesen wuerde.
    const { level } = analyzeBoard(board);
    if (level === null) {
      continue;
    }

    const store = new ConstraintStore(board);
    store.enableTrace();
    const result = store.propagate(level);
    if (result.status !== 'ok' || !store.currentAssignment()) {
      continue;
    }
    if (!isValidSolution(board, store.currentAssignment())) {
      continue;
    }

    const perRule = {} as Record<RuleId, number>;
    let total = 0;
    for (const ruleId of RULE_IDS) {
      const count = store.usageOf(ruleId);
      perRule[ruleId] = count;
      total += count;
    }

    // Wie weit kommt jemand, der nur die Grundregeln benutzt?
    const basicStore = new ConstraintStore(board);
    basicStore.propagate(1);
    let decided = 0;
    for (let edgeId = 0; edgeId < board.edges.length; edgeId++) {
      if (basicStore.isDecided(edgeId)) {
        decided++;
      }
    }

    // Spielraum je Insel: was sie hoechstens aufnehmen koennte, minus was sie muss.
    let gifts = 0;
    let slackSum = 0;
    let degreeSum = 0;
    for (const island of board.islands) {
      const neighbours = board.edgesByIsland[island.id]?.length ?? 0;
      const slack = 2 * neighbours - island.required;
      degreeSum += neighbours;
      slackSum += slack;
      if (slack === 0) {
        gifts++;
      }
    }

    samples.push({
      islands: board.islands.length,
      edges: board.edges.length,
      level,
      advanced: store.advancedUsage,
      total,
      perRule,
      basicShare: board.edges.length === 0 ? 1 : decided / board.edges.length,
      giftShare: gifts / board.islands.length,
      meanSlack: slackSum / board.islands.length,
      meanDegree: degreeSum / board.islands.length,
      routineRun: store.longestRoutineRun,
    });
  }

  return samples;
}

async function main(): Promise<void> {
  console.log('Deduktionsaufwand der ausgelieferten Raetsel (Median ueber je 150 Stueck)\n');
  console.log(
    'Grad     Inseln  Kanten  Schritte   fortgeschr.   Anteil   Leerlauf   Stufen'.padEnd(92),
  );
  console.log('-'.repeat(90));

  const perRuleTotals = new Map<Difficulty, Record<RuleId, number>>();

  for (const difficulty of DIFFICULTIES) {
    const samples = await collect(difficulty);
    if (samples.length === 0) {
      console.log(`${difficulty}: keine auswertbaren Raetsel`);
      continue;
    }

    const share = samples.map((s) => (s.total === 0 ? 0 : (s.advanced / s.total) * 100));
    const levels = new Map<number, number>();
    for (const level of DEDUCTION_LEVELS) {
      levels.set(level, samples.filter((s) => s.level === level).length);
    }
    const levelText = [...levels.entries()]
      .filter(([, count]) => count > 0)
      .map(([level, count]) => `L${String(level)}:${String(count)}`)
      .join(' ');

    console.log(
      `${difficulty.padEnd(9)}${format(median(samples.map((s) => s.islands)), 0)}  ` +
        `${format(median(samples.map((s) => s.edges)), 0)}  ` +
        `${format(median(samples.map((s) => s.total)), 0)}    ` +
        `${format(median(samples.map((s) => s.advanced)), 0)}      ` +
        `${format(median(share))} %  ${format(median(samples.map((s) => s.routineRun)), 0)}     ${levelText}`,
    );

    const sum = {} as Record<RuleId, number>;
    for (const ruleId of RULE_IDS) {
      sum[ruleId] = samples.reduce((acc, s) => acc + s.perRule[ruleId], 0) / samples.length;
    }
    perRuleTotals.set(difficulty, sum);
  }

  console.log('\nWie weit kommt man ohne die fortgeschrittenen Regeln?\n');
  console.log('Grad      D1-D4 loest   erzwungene Inseln   Spielraum/Insel   Nachbarn/Insel');
  console.log('-'.repeat(78));
  for (const difficulty of DIFFICULTIES) {
    const samples = await collect(difficulty);
    if (samples.length === 0) {
      continue;
    }
    console.log(
      `${difficulty.padEnd(10)}${format(median(samples.map((s) => s.basicShare * 100)))} %   ` +
        `${format(median(samples.map((s) => s.giftShare * 100)))} %          ` +
        `${format(median(samples.map((s) => s.meanSlack)), 2)}           ` +
        format(median(samples.map((s) => s.meanDegree)), 2),
    );
  }

  console.log('\nDurchschnittliche Anwendungen je Regel und Raetsel\n');
  console.log(`Regel${' '.repeat(20)}${DIFFICULTIES.map((d) => d.padStart(9)).join('')}`);
  console.log('-'.repeat(25 + DIFFICULTIES.length * 9));
  for (const ruleId of RULE_IDS) {
    const cells = DIFFICULTIES.map((d) => format(perRuleTotals.get(d)?.[ruleId] ?? 0).padStart(9));
    console.log(`${ruleId.padEnd(25)}${cells.join('')}`);
  }
}

await main();
