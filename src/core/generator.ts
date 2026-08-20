import {
  BOARD_SIZE,
  GENERATOR,
  GROWTH_RECENT_FRACTION,
  ISLAND_DENSITY,
  MAX_BRIDGES_PER_EDGE,
  HIDDEN_ISLANDS,
  MAX_ISLAND_VALUE,
  WALL_DENSITY,
  type Difficulty,
} from '../config/game.ts';
import { classifyDifficulty } from './difficulty.ts';
import { buildBoard, findEdge, type IslandSpec } from './geometry.ts';
import { createRng, type Rng } from './rng.ts';
import { solve } from './solver.ts';
import type { Board, BridgeCount, Cell, PuzzleDefinition } from './types.ts';

export interface GenerateOptions {
  /** Hoechstzahl an Versuchen, bevor aufgegeben wird. */
  readonly maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 400;

/** Zellenzustaende im Arbeitsgitter. */
const EMPTY = -1;
const BRIDGE = -2;
const WALL = -3;

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

interface WorkIsland {
  x: number;
  y: number;
  degree: number;
}

interface WorkEdge {
  a: number;
  b: number;
  count: number;
}

interface Layout {
  size: number;
  cells: Int32Array;
  islands: WorkIsland[];
  edges: WorkEdge[];
  edgeIndex: Map<number, number>;
  walls: Cell[];
  tuning: (typeof GENERATOR)[Difficulty];
}

/**
 * Erzeugt ein Raetsel mit garantiert eindeutiger Loesung.
 *
 * Vorgehen (Rueckwaertskonstruktion):
 * 1. Ein zufaelliges, von Anfang an zusammenhaengendes Brueckennetz bauen.
 * 2. Die Inselwerte als Knotengrade daraus ableiten und das Netz verwerfen.
 * 3. Mit dem Solver beweisen, dass genau eine Loesung existiert.
 * 4. Die noetige Deduktionstiefe bestimmen und gegen den Zielgrad pruefen.
 *
 * Schritt 3 ist der Grund, warum das Ganze funktioniert: ohne Eindeutigkeit
 * waere jeder Tipp Willkuer.
 */
export function generate(
  seed: string,
  difficulty: Difficulty,
  options: GenerateOptions = {},
): PuzzleDefinition {
  const puzzle = tryGenerate(seed, difficulty, options);
  if (!puzzle) {
    throw new Error(
      `Kein eindeutiges ${difficulty}-Raetsel fuer Seed "${seed}" innerhalb des Versuchsbudgets gefunden`,
    );
  }
  return puzzle;
}

/** Wie `generate`, liefert aber `null` statt zu werfen. */
export function tryGenerate(
  seed: string,
  difficulty: Difficulty,
  options: GenerateOptions = {},
): PuzzleDefinition | null {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const size = BOARD_SIZE[difficulty];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRng(`${seed}#${String(attempt)}`);
    const candidate = buildCandidate(rng, size, difficulty);
    if (!candidate) {
      continue;
    }

    const { board, solution } = candidate;

    // Eindeutigkeit ist Pflicht, nicht Kür.
    const result = solve(board, { maxSolutions: 2 });
    if (result.count !== 1) {
      continue;
    }

    if (classifyDifficulty(board) !== difficulty) {
      continue;
    }

    const withHidden = hideIslands(board, candidate.walls, rng, difficulty);

    return {
      id: `${difficulty}-${seed}`,
      seed,
      difficulty,
      width: withHidden.width,
      height: withHidden.height,
      islands: withHidden.islands,
      solution,
      blocked: candidate.walls,
    };
  }

  return null;
}

interface Candidate {
  board: Board;
  solution: BridgeCount[];
  walls: Cell[];
}

/**
 * Verdeckt so viele Inselzahlen wie moeglich, ohne die Eindeutigkeit zu verlieren.
 *
 * Der Punkt, an dem das kippen kann: Eine verborgene Zahl ist **keine Bedingung
 * mehr**. Aus Spielersicht muss die Insel nur irgendeine Bruecke haben. Das kann
 * zusaetzliche Loesungen eroeffnen — dann ist das Raetsel fuer den Spieler
 * mehrdeutig, obwohl es das mit sichtbaren Zahlen nicht waere. Deshalb wird nach
 * jedem Verdecken erneut gezaehlt und im Zweifel zurueckgenommen.
 *
 * Jeder einzelne Schritt muss ausserdem den Schwierigkeitsgrad erhalten.
 * Andernfalls waere die Reihenfolge falsch herum: erst alles verdecken, dann
 * einstufen und den ganzen Kandidaten verwerfen, wenn er aus dem Grad
 * gerutscht ist — das hat in der Messung ganze Seeds am Versuchsbudget
 * scheitern lassen. So bleibt stattdessen immer der beste noch passende Stand
 * stehen.
 *
 * Die Inseln werden in zufaelliger Reihenfolge probiert, damit nicht immer
 * dieselben Positionen verdeckt sind.
 */
function hideIslands(board: Board, walls: Cell[], rng: Rng, difficulty: Difficulty): Board {
  const budget = HIDDEN_ISLANDS[difficulty];
  if (budget <= 0) {
    return board;
  }

  const order = board.islands.map((island) => island.id);
  rng.shuffle(order);

  const specs: IslandSpec[] = board.islands.map((island) => ({
    x: island.x,
    y: island.y,
    required: island.required,
    hidden: false,
  }));

  let current = board;
  let hiddenCount = 0;

  for (const islandId of order) {
    if (hiddenCount >= budget) {
      break;
    }
    const spec = specs[islandId]!;
    specs[islandId] = { ...spec, hidden: true };

    const candidate = buildBoard(board.width, board.height, specs, walls);
    if (
      solve(candidate, { maxSolutions: 2 }).count === 1 &&
      classifyDifficulty(candidate) === difficulty
    ) {
      current = candidate;
      hiddenCount++;
    } else {
      specs[islandId] = spec;
    }
  }

  return current;
}

/**
 * Baut ein zufaelliges Netz und leitet daraus ein Board mit Loesung ab.
 *
 * Der Kern ist die Spannung zwischen zwei Zielen: viele nicht genutzte
 * Nachbarschaften machen ein Raetsel interessant, treiben aber die Zahl der
 * Loesungen nach oben. Ein duenn gewachsenes Netz ist deshalb fast immer
 * mehrdeutig, ein dicht verbundenes fast immer trivial.
 *
 * Statt blind zu verwerfen wird hier nachgebessert: solange das Board mehrdeutig
 * ist, kommt genau eine weitere Verbindung dazu und es wird erneut geprueft.
 * Das landet bei der duennstmoeglichen Variante, die noch eindeutig ist — also
 * genau dort, wo interessante Raetsel liegen.
 */
function buildCandidate(
  rng: Rng,
  size: number,
  difficulty: Difficulty,
  repair = true,
): Candidate | null {
  const density = ISLAND_DENSITY[difficulty];
  const cellCount = size * size;
  const targetIslands = Math.round(
    cellCount * (density.min + rng.nextFloat() * (density.max - density.min)),
  );
  if (targetIslands < 2) {
    return null;
  }

  const layout = createLayout(size, difficulty);
  placeWalls(layout, rng, difficulty);
  if (!seedFirstIsland(layout, rng)) {
    return null;
  }

  // Netz wachsen lassen, bis die Zielzahl erreicht ist.
  let stalled = 0;
  const stallLimit = targetIslands * 12;
  while (layout.islands.length < targetIslands && stalled < stallLimit) {
    if (!growByOneIsland(layout, rng)) {
      stalled++;
    }
  }

  // Ein deutlich zu kleines Netz taugt nicht als Raetsel des gewuenschten Grades.
  if (layout.islands.length < Math.max(4, Math.round(targetIslands * 0.7))) {
    return null;
  }

  if (!repair) {
    return materialize(layout, size);
  }

  const repairBudget = Math.round(layout.islands.length * layout.tuning.repairRounds);
  for (let round = 0; round <= repairBudget; round++) {
    const candidate = materialize(layout, size);
    if (candidate && solve(candidate.board, { maxSolutions: 2 }).count === 1) {
      return candidate;
    }
    if (!addExtraConnection(layout, rng)) {
      return null; // kein Platz mehr fuer weitere Verbindungen
    }
  }

  return null;
}

/** Baut aus dem Arbeitsnetz das fertige Board samt Loesung. */
function materialize(layout: Layout, size: number): Candidate | null {
  const specs: IslandSpec[] = layout.islands.map((island) => ({
    x: island.x,
    y: island.y,
    required: island.degree,
  }));

  if (specs.some((spec) => spec.required < 1 || spec.required > MAX_ISLAND_VALUE)) {
    return null;
  }

  let board: Board;
  try {
    board = buildBoard(size, size, specs, layout.walls);
  } catch {
    // Kann auftreten, wenn zwei Inseln direkt aneinandergrenzen — Kandidat verwerfen.
    return null;
  }

  const solution = mapSolutionToBoard(layout, board);
  return solution === null ? null : { board, solution, walls: layout.walls };
}

function createLayout(size: number, difficulty: Difficulty): Layout {
  return {
    size,
    cells: new Int32Array(size * size).fill(EMPTY),
    islands: [],
    edges: [],
    edgeIndex: new Map<number, number>(),
    walls: [],
    tuning: GENERATOR[difficulty],
  };
}

/**
 * Streut Mauern ueber das Brett, bevor Inseln wachsen.
 *
 * Mauern sind der einzige Eingriff, der die *Geometrie* veraendert statt der
 * Zahlen. Sie unterbrechen Sichtlinien, und dadurch entstehen Bereiche, die nur
 * ueber wenige Verbindungen erreichbar sind — genau die Struktur, an der die
 * Schnittregeln D6 und D8 greifen und die man beim Loesen nicht mehr rein
 * lokal durchschaut.
 *
 * Sie werden vor dem Wachstum gesetzt, damit das Netz von vornherein um sie
 * herum waechst; nachtraeglich eingefuegte Mauern wuerden fertige Bruecken
 * zerschneiden.
 */
function placeWalls(layout: Layout, rng: Rng, difficulty: Difficulty): void {
  const density = WALL_DENSITY[difficulty];
  if (density <= 0) {
    return;
  }

  const target = Math.round(layout.size * layout.size * density);
  // Feste Zahl an Versuchen statt einer Schleife bis zum Ziel: bei sehr kleinen
  // Brettern soll der Generator hier nicht haengenbleiben.
  for (let attempt = 0; attempt < target * 4 && layout.walls.length < target; attempt++) {
    const x = rng.nextInt(layout.size);
    const y = rng.nextInt(layout.size);
    const index = cellIndex(layout, x, y);
    if (layout.cells[index] !== EMPTY) {
      continue;
    }
    layout.cells[index] = WALL;
    layout.walls.push({ x, y });
  }
}

function cellIndex(layout: Layout, x: number, y: number): number {
  return y * layout.size + x;
}

function inside(layout: Layout, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < layout.size && y < layout.size;
}

/** Grenzt die Zelle direkt an eine Insel? Direkt benachbarte Inseln sind nicht zulaessig. */
function touchesIsland(layout: Layout, x: number, y: number): boolean {
  for (const dir of DIRECTIONS) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (inside(layout, nx, ny) && layout.cells[cellIndex(layout, nx, ny)]! >= 0) {
      return true;
    }
  }
  return false;
}

function seedFirstIsland(layout: Layout, rng: Rng): boolean {
  // Der Start liegt bewusst nicht am Rand, damit das Netz in alle Richtungen wachsen kann.
  const margin = layout.size >= 9 ? 2 : 1;
  for (let attempt = 0; attempt < 32; attempt++) {
    const x = rng.nextRange(margin, layout.size - 1 - margin);
    const y = rng.nextRange(margin, layout.size - 1 - margin);
    const index = cellIndex(layout, x, y);
    if (layout.cells[index] !== EMPTY) {
      continue; // Mauer im Weg
    }
    layout.islands.push({ x, y, degree: 0 });
    layout.cells[index] = 0;
    return true;
  }
  return false;
}

/**
 * Waehlt aus, an welcher Insel weitergewachsen wird.
 *
 * Gleichverteilt gezogen entsteht ein gleichmaessiger Klumpen. Mit
 * `growthRecency` wird stattdessen bevorzugt an einer der zuletzt gesetzten
 * Inseln angebaut — das Netz waechst dann in Ranken, und zwischen ihnen bleiben
 * Engstellen stehen, an denen die Schnittregeln ueberhaupt erst etwas zu tun
 * bekommen.
 */
function pickGrowthSource(layout: Layout, rng: Rng): number {
  const count = layout.islands.length;
  if (count <= 2 || rng.nextFloat() >= layout.tuning.growthRecency) {
    return rng.nextInt(count);
  }
  const window = Math.max(1, Math.round(count * GROWTH_RECENT_FRACTION));
  return count - 1 - rng.nextInt(window);
}

/** Haengt eine neue Insel per Bruecke an eine vorhandene an. */
function growByOneIsland(layout: Layout, rng: Rng): boolean {
  const sourceId = pickGrowthSource(layout, rng);
  const source = layout.islands[sourceId]!;

  const directions = [...DIRECTIONS];
  rng.shuffle(directions);

  for (const dir of directions) {
    const maxDistance = layout.size - 1;
    const distances: number[] = [];
    for (let distance = 2; distance <= maxDistance; distance++) {
      distances.push(distance);
    }
    // Kurze Distanzen bevorzugen, aber nicht erzwingen: dicht stehende Inseln
    // haben mehr moegliche Nachbarn, und genau daraus entsteht Schwierigkeit.
    // Ein weit auseinandergezogenes Netz loest sich allein ueber die Inselgrade.
    const jitter = distances.map(
      (distance) => distance + rng.nextFloat() * layout.tuning.distanceJitter,
    );
    distances.sort((left, right) => jitter[left - 2]! - jitter[right - 2]!);

    for (const distance of distances) {
      const targetX = source.x + dir.dx * distance;
      const targetY = source.y + dir.dy * distance;
      if (!inside(layout, targetX, targetY)) {
        continue;
      }
      if (layout.cells[cellIndex(layout, targetX, targetY)] !== EMPTY) {
        continue;
      }
      if (touchesIsland(layout, targetX, targetY)) {
        continue;
      }
      if (!pathIsFree(layout, source.x, source.y, targetX, targetY)) {
        continue;
      }

      // Doppelbruecken sind seltener, sonst werden die Inselzahlen unnatuerlich hoch.
      const count = rng.nextFloat() < layout.tuning.doubleBridgeChance ? 2 : 1;
      if (source.degree + count > MAX_ISLAND_VALUE) {
        continue;
      }

      const newId = layout.islands.length;
      layout.islands.push({ x: targetX, y: targetY, degree: 0 });
      layout.cells[cellIndex(layout, targetX, targetY)] = newId;
      connect(layout, sourceId, newId, count);
      return true;
    }
  }

  return false;
}

/**
 * Fuegt eine zusaetzliche Verbindung hinzu: entweder eine neue Kante zur naechsten
 * freien Nachbarinsel oder eine vorhandene Einzelbruecke wird zur Doppelbruecke.
 */
function addExtraConnection(layout: Layout, rng: Rng): boolean {
  if (layout.islands.length < 2) {
    return false;
  }

  // Alle Inseln in zufaelliger Reihenfolge durchgehen: gibt es irgendwo noch
  // Platz, wird er gefunden. Nur eine Insel zu probieren wuerde die
  // Nachbesserung viel zu oft vorzeitig aufgeben.
  // Zuerst vorhandene Einzelbruecken verdoppeln: das schaerft die Inselwerte,
  // ohne eine bislang ungenutzte Nachbarschaft zu verbrauchen. Genau diese
  // ungenutzten Nachbarschaften sind es, die ein Raetsel interessant machen.
  if (doubleExistingEdge(layout, rng)) {
    return true;
  }

  const order = layout.islands.map((_, index) => index);
  rng.shuffle(order);

  for (const sourceId of order) {
    if (tryConnectFrom(layout, rng, sourceId)) {
      return true;
    }
  }

  return false;
}

/** Macht aus einer vorhandenen Einzelbruecke eine Doppelbruecke. */
function doubleExistingEdge(layout: Layout, rng: Rng): boolean {
  const order = layout.edges.map((_, index) => index);
  rng.shuffle(order);

  for (const index of order) {
    const edge = layout.edges[index]!;
    if (edge.count >= MAX_BRIDGES_PER_EDGE) {
      continue;
    }
    if (
      layout.islands[edge.a]!.degree >= MAX_ISLAND_VALUE ||
      layout.islands[edge.b]!.degree >= MAX_ISLAND_VALUE
    ) {
      continue;
    }
    connect(layout, edge.a, edge.b, 1);
    return true;
  }
  return false;
}

/** Versucht, von einer bestimmten Insel aus eine weitere Verbindung zu legen. */
function tryConnectFrom(layout: Layout, rng: Rng, sourceId: number): boolean {
  const source = layout.islands[sourceId]!;

  const directions = [...DIRECTIONS];
  rng.shuffle(directions);

  for (const dir of directions) {
    const existingTarget = findConnectedNeighbor(layout, sourceId, dir);

    if (existingTarget !== null) {
      // In dieser Richtung liegt bereits eine Bruecke — hoechstens verdoppeln.
      const edgeSlot = layout.edgeIndex.get(edgeKey(sourceId, existingTarget))!;
      const target = layout.islands[existingTarget]!;
      if (
        layout.edges[edgeSlot]!.count < MAX_BRIDGES_PER_EDGE &&
        source.degree < MAX_ISLAND_VALUE &&
        target.degree < MAX_ISLAND_VALUE
      ) {
        connect(layout, sourceId, existingTarget, 1);
        return true;
      }
      continue;
    }

    // Freie Sichtlinie zur naechsten Insel suchen.
    let x = source.x + dir.dx;
    let y = source.y + dir.dy;
    while (inside(layout, x, y) && layout.cells[cellIndex(layout, x, y)] === EMPTY) {
      x += dir.dx;
      y += dir.dy;
    }
    if (!inside(layout, x, y)) {
      continue;
    }

    const targetId = layout.cells[cellIndex(layout, x, y)]!;
    if (targetId < 0) {
      continue; // eine fremde Bruecke versperrt den Weg
    }
    const target = layout.islands[targetId]!;
    if (source.degree >= MAX_ISLAND_VALUE || target.degree >= MAX_ISLAND_VALUE) {
      continue;
    }

    connect(layout, sourceId, targetId, 1);
    return true;
  }

  return false;
}

/** Insel, die in dieser Richtung bereits per Bruecke mit der Quelle verbunden ist. */
function findConnectedNeighbor(
  layout: Layout,
  sourceId: number,
  dir: (typeof DIRECTIONS)[number],
): number | null {
  const source = layout.islands[sourceId]!;

  for (const edge of layout.edges) {
    if (edge.a !== sourceId && edge.b !== sourceId) {
      continue;
    }
    const otherId = edge.a === sourceId ? edge.b : edge.a;
    const other = layout.islands[otherId]!;

    if (dir.dx !== 0) {
      if (other.y === source.y && Math.sign(other.x - source.x) === dir.dx) {
        return otherId;
      }
    } else if (other.x === source.x && Math.sign(other.y - source.y) === dir.dy) {
      return otherId;
    }
  }

  return null;
}

/** Sind alle Zellen zwischen zwei Punkten frei? Die Endpunkte werden nicht geprueft. */
function pathIsFree(layout: Layout, x1: number, y1: number, x2: number, y2: number): boolean {
  const stepX = Math.sign(x2 - x1);
  const stepY = Math.sign(y2 - y1);
  let x = x1 + stepX;
  let y = y1 + stepY;

  while (x !== x2 || y !== y2) {
    if (layout.cells[cellIndex(layout, x, y)] !== EMPTY) {
      return false;
    }
    x += stepX;
    y += stepY;
  }
  return true;
}

function edgeKey(a: number, b: number): number {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return low * 100_000 + high;
}

/** Traegt eine Verbindung ein und markiert die belegten Zellen. */
function connect(layout: Layout, a: number, b: number, count: number): void {
  const key = edgeKey(a, b);
  const existingIndex = layout.edgeIndex.get(key);

  if (existingIndex === undefined) {
    layout.edgeIndex.set(key, layout.edges.length);
    layout.edges.push({ a: Math.min(a, b), b: Math.max(a, b), count });
    markBridgeCells(layout, a, b);
  } else {
    layout.edges[existingIndex]!.count += count;
  }

  layout.islands[a]!.degree += count;
  layout.islands[b]!.degree += count;
}

function markBridgeCells(layout: Layout, a: number, b: number): void {
  const islandA = layout.islands[a]!;
  const islandB = layout.islands[b]!;
  const stepX = Math.sign(islandB.x - islandA.x);
  const stepY = Math.sign(islandB.y - islandA.y);

  let x = islandA.x + stepX;
  let y = islandA.y + stepY;
  while (x !== islandB.x || y !== islandB.y) {
    layout.cells[cellIndex(layout, x, y)] = BRIDGE;
    x += stepX;
    y += stepY;
  }
}

/**
 * Uebersetzt das konstruierte Netz in die Kantenreihenfolge des fertigen Boards.
 * Die Insel-Ids aendern sich dabei, weil `buildBoard` nach (y, x) sortiert.
 */
function mapSolutionToBoard(layout: Layout, board: Board): BridgeCount[] | null {
  const idByPosition = new Map<number, number>();
  for (const island of board.islands) {
    idByPosition.set(island.y * board.width + island.x, island.id);
  }

  const solution: BridgeCount[] = new Array<BridgeCount>(board.edges.length).fill(0);

  for (const edge of layout.edges) {
    const from = layout.islands[edge.a]!;
    const to = layout.islands[edge.b]!;
    const boardA = idByPosition.get(from.y * board.width + from.x);
    const boardB = idByPosition.get(to.y * board.width + to.x);
    if (boardA === undefined || boardB === undefined) {
      return null;
    }
    const edgeId = findEdge(board, boardA, boardB);
    if (edgeId === null) {
      return null;
    }
    solution[edgeId] = edge.count as BridgeCount;
  }

  return solution;
}

/**
 * Erzeugt einen rohen Kandidaten ohne Eindeutigkeits- und Schwierigkeitspruefung.
 * Wird von Tests und vom Pruefskript gebraucht, um den Generator getrennt von der
 * Verifikation betrachten zu koennen.
 */
export function buildCandidateBoard(
  seed: string,
  difficulty: Difficulty,
  options: { repair?: boolean } = {},
): { board: Board; solution: BridgeCount[] } | null {
  return buildCandidate(
    createRng(seed),
    BOARD_SIZE[difficulty],
    difficulty,
    options.repair ?? true,
  );
}
