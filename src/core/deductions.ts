import { UnionFind } from './unionFind.ts';
import type { Board, BridgeCount } from './types.ts';

/**
 * Benannte Deduktionsregeln. Die Ids sind gleichzeitig i18n-Schluessel fuer die
 * Begruendungstexte im Tipp-System — deshalb bleiben sie stabil.
 */
export const RULE_IDS = [
  /** Insel ist voll, alle uebrigen Kanten entfallen. */
  'D1_SATURATED',
  /** Die Restkapazitaet der Nachbarn entspricht genau dem Bedarf: alles erzwungen. */
  'D2_FORCED_ALL',
  /** Auch bei maximaler Auslastung der uebrigen Nachbarn bleibt hier ein Mindestwert. */
  'D3_MIN_PER_EDGE',
  /** Kreuzende Bruecken schliessen einander aus. */
  'D4_NO_CROSS',
  /** Der Zug wuerde eine Inselgruppe vom Rest abschneiden. */
  'D5_NO_ISOLATION',
  /** Ohne diese Bruecke waere ein Teil des Feldes nicht mehr erreichbar. */
  'D6_CONNECTIVITY_BRIDGE',
  /** Die Gegenannahme fuehrt zu einem Widerspruch. */
  'D7_HYPOTHESIS',
  /** Paritaetsschluss ueber eine durch eine einzige Kante abgetrennte Inselgruppe. */
  'D8_PARITY_CUT',
  /** Zwei gleich grosse Inseln duerfen sich nicht gegenseitig abschliessen. */
  'D9_TWIN_PAIR',
] as const;

export type RuleId = (typeof RULE_IDS)[number];

/**
 * Grundregeln: rein lokale Schluesse an einer einzelnen Insel oder Kreuzung.
 * Alles darueber verlangt einen Blick auf das Zusammenspiel mehrerer Inseln —
 * das ist die Trennlinie, an der sich Schwierigkeit messen laesst.
 */
const ROUTINE_RULES: ReadonlySet<RuleId> = new Set<RuleId>([
  'D1_SATURATED',
  'D2_FORCED_ALL',
  'D3_MIN_PER_EDGE',
  'D4_NO_CROSS',
]);

/**
 * Deduktionstiefe. Bestimmt, welche Regeln benutzt werden duerfen, und ist damit
 * das Mass fuer die Schwierigkeit eines Raetsels.
 *
 * - **1** — D1–D4: Inselgrade und Kreuzungen, alles lokal
 * - **2** — zusaetzlich D9 und D5: keine vorzeitig geschlossene Teilgruppe
 * - **3** — zusaetzlich D6 und D8: Zusammenhangs- und Paritaetsschluesse ueber Schnitte
 * - **4** — zusaetzlich D7: Widerspruchsbeweis
 */
export const DEDUCTION_LEVELS = [1, 2, 3, 4] as const;
export type DeductionLevel = (typeof DEDUCTION_LEVELS)[number];

/** Ein konkreter, zwingender Zug samt Begruendung. */
export interface Deduction {
  readonly ruleId: RuleId;
  readonly edgeId: number;
  readonly value: BridgeCount;
  /** Insel, aus deren Zahl sich die Begruendung ergibt (falls zutreffend). */
  readonly islandId: number | null;
}

export type PropagationStatus = 'ok' | 'contradiction';

export interface PropagationResult {
  readonly status: PropagationStatus;
  /** Erster zwingende Brueckensetzung nach dem Startzustand — Grundlage fuer Tipps. */
  readonly firstPlacement: Deduction | null;
  /** Sind alle Kanten entschieden? */
  readonly complete: boolean;
}

// Wertebereiche werden als Bitmaske gefuehrt: Bit v gesetzt = Wert v moeglich.
const FULL_MASK = 0b111;

/** Kleinster noch moeglicher Wert je Maske. */
const LOW = new Uint8Array([0, 0, 1, 0, 2, 0, 1, 0]);
/** Groesster noch moeglicher Wert je Maske. */
const HIGH = new Uint8Array([0, 0, 1, 1, 2, 2, 2, 2]);

function rangeMask(low: number, high: number): number {
  if (low > high) {
    return 0;
  }
  return ((1 << (high + 1)) - 1) & ~((1 << low) - 1);
}

/**
 * Der Constraint-Store haelt fuer jede Kante die noch moeglichen Brueckenzahlen
 * und propagiert die Deduktionsregeln bis zum Fixpunkt.
 *
 * Aenderungen werden auf einem Trail protokolliert, damit der Solver ohne
 * Kopieren zurueckspringen kann — das ist der Unterschied zwischen „laeuft" und
 * „laeuft schnell genug" bei den grossen Brettern.
 */
export class ConstraintStore {
  readonly board: Board;

  private readonly domains: Uint8Array;
  private readonly sumLow: Int32Array;
  private readonly sumHigh: Int32Array;

  /** Trail als Paare (edgeId, alteMaske). */
  private readonly trail: number[] = [];

  private readonly islandQueue: number[] = [];
  private readonly islandQueued: Uint8Array;
  private readonly edgeQueue: number[] = [];
  private readonly edgeQueued: Uint8Array;

  private readonly unionFind: UnionFind;
  private readonly openPerRoot: Int32Array;

  private failed = false;

  /** Zaehlt, wie oft jede Regel tatsaechlich etwas bewirkt hat. Grundlage der Einstufung. */
  private readonly usage = new Map<RuleId, number>();
  private counting = true;

  /**
   * Reihenfolge der angewandten Regeln, nur auf Anforderung.
   *
   * Kostet Speicher und Zeit und bleibt deshalb im Solver aus. Die Einstufung
   * braucht sie, um die laengste Strecke reiner Routinezuege zu messen — genau
   * die Strecken, die ein Raetsel lang statt schwierig machen.
   */
  private trace: RuleId[] | null = null;

  /** Kontext fuer die Begruendung der gerade laufenden Regel. */
  private currentRule: RuleId = 'D1_SATURATED';
  private currentIsland: number | null = null;
  private recordPlacements = false;
  private placement: Deduction | null = null;

  constructor(board: Board) {
    this.board = board;
    this.domains = new Uint8Array(board.edges.length);
    this.sumLow = new Int32Array(board.islands.length);
    this.sumHigh = new Int32Array(board.islands.length);
    this.islandQueued = new Uint8Array(board.islands.length);
    this.edgeQueued = new Uint8Array(board.edges.length);
    this.unionFind = new UnionFind(board.islands.length);
    this.openPerRoot = new Int32Array(board.islands.length);
    this.reset();
  }

  /** Setzt alle Kanten auf „0, 1 oder 2 moeglich" zurueck. */
  reset(): void {
    this.domains.fill(FULL_MASK);
    this.sumLow.fill(0);
    this.sumHigh.fill(0);
    for (const edge of this.board.edges) {
      this.sumHigh[edge.a] = this.sumHigh[edge.a]! + 2;
      this.sumHigh[edge.b] = this.sumHigh[edge.b]! + 2;
    }
    this.trail.length = 0;
    this.islandQueue.length = 0;
    this.islandQueued.fill(0);
    this.edgeQueue.length = 0;
    this.edgeQueued.fill(0);
    this.failed = false;
    this.placement = null;
    this.recordPlacements = false;
    this.usage.clear();
    this.counting = true;
    this.trace = this.trace === null ? null : [];
  }

  /** Schaltet die Regelmitschrift ein. Vor `propagate` aufrufen. */
  enableTrace(): void {
    this.trace = [];
  }

  /**
   * Laengste ununterbrochene Folge reiner Routinezuege (D1–D4) **zwischen** zwei
   * fortgeschrittenen Schluessen.
   *
   * Das Mass fuer Leerlauf: Ein Raetsel mit vier fortgeschrittenen Schluessen,
   * zwischen denen jeweils dreissig mechanische Zuege liegen, ist nicht schwer,
   * sondern lang.
   *
   * Die Strecke *vor* dem ersten fortgeschrittenen Schluss zaehlt bewusst nicht
   * mit. Sie ist der Einstieg — die Bruecken, die sich aus den Inselzahlen von
   * selbst ergeben — und gehoert zu jedem Raetsel dieser Art dazu. Wer sie
   * mitzaehlte, wuerde grosse Bretter allein fuer ihre Groesse bestrafen und
   * genau die Boards verwerfen, die spaeter interessant werden.
   *
   * Ohne eingeschaltete Mitschrift ist der Wert 0.
   */
  get longestRoutineRun(): number {
    if (this.trace === null) {
      return 0;
    }
    let longest = 0;
    let current = 0;
    let seenAdvanced = false;
    for (const ruleId of this.trace) {
      if (!ROUTINE_RULES.has(ruleId)) {
        seenAdvanced = true;
        current = 0;
        continue;
      }
      if (!seenAdvanced) {
        continue; // Einstiegsstrecke
      }
      current++;
      if (current > longest) {
        longest = current;
      }
    }
    return longest;
  }

  /**
   * Bewusst eine Methode und kein Getter: TypeScript verengt den Typ einer
   * Eigenschaft nach der ersten Pruefung und haelt jede weitere fuer ueberfluessig,
   * obwohl die zwischenzeitlich aufgerufenen Regeln das Flag sehr wohl setzen.
   */
  hasContradiction(): boolean {
    return this.failed;
  }

  private isFailed(): boolean {
    return this.failed;
  }

  /** Aus demselben Grund wie `isFailed` eine Methode und kein direkter Zugriff. */
  private hasPlacement(): boolean {
    return this.placement !== null;
  }

  /** Wie oft eine Regel eine Einschraenkung bewirkt hat. */
  usageOf(ruleId: RuleId): number {
    return this.usage.get(ruleId) ?? 0;
  }

  /** Anwendungen aller Regeln oberhalb der Grundregeln D1–D4. */
  get advancedUsage(): number {
    let total = 0;
    for (const ruleId of RULE_IDS) {
      if (!ROUTINE_RULES.has(ruleId)) {
        total += this.usageOf(ruleId);
      }
    }
    return total;
  }

  lowerBound(edgeId: number): number {
    return LOW[this.domains[edgeId]!]!;
  }

  upperBound(edgeId: number): number {
    return HIGH[this.domains[edgeId]!]!;
  }

  isDecided(edgeId: number): boolean {
    const mask = this.domains[edgeId]!;
    return mask === (mask & -mask);
  }

  /** Aktuelle Untergrenzen als Loesungskandidat (nur sinnvoll, wenn alles entschieden ist). */
  currentAssignment(): Uint8Array {
    const result = new Uint8Array(this.domains.length);
    for (let edgeId = 0; edgeId < this.domains.length; edgeId++) {
      result[edgeId] = LOW[this.domains[edgeId]!]!;
    }
    return result;
  }

  /** Merker fuer den Trail; mit `undoTo` wird genau bis hierher zurueckgesetzt. */
  mark(): number {
    return this.trail.length;
  }

  undoTo(mark: number): void {
    while (this.trail.length > mark) {
      const oldMask = this.trail.pop()!;
      const edgeId = this.trail.pop()!;
      this.writeDomain(edgeId, oldMask);
    }
    this.failed = false;
  }

  /** Setzt eine Kante auf einen festen Wert. */
  fix(edgeId: number, value: number): boolean {
    return this.restrict(edgeId, 1 << value);
  }

  /**
   * Zieht eine Untergrenze ein, ohne die Kante festzulegen.
   * Wird benutzt, um den Spielerzustand als Ausgangslage zu uebernehmen.
   */
  setFloor(edgeId: number, value: number): boolean {
    return this.restrict(edgeId, rangeMask(value, 2));
  }

  /**
   * Ab jetzt wird die erste erzwungene Bruecken-Setzung mitgeschrieben.
   * Das trennt „Ausgangslage einlesen" von „Tipp ableiten".
   */
  beginRecordingPlacements(): void {
    this.recordPlacements = true;
    this.placement = null;
  }

  get recordedPlacement(): Deduction | null {
    return this.placement;
  }

  /**
   * Propagiert bis zum Fixpunkt.
   *
   * @param level Erlaubte Deduktionstiefe (siehe DEDUCTION_LEVELS).
   * @param stopAtFirstPlacement Bricht ab, sobald die erste Bruecke erzwungen ist.
   */
  propagate(level: DeductionLevel, stopAtFirstPlacement = false): PropagationResult {
    // Zu Beginn alle Inseln und gesetzten Kanten einmal betrachten.
    for (let islandId = 0; islandId < this.board.islands.length; islandId++) {
      this.enqueueIsland(islandId);
    }
    for (let edgeId = 0; edgeId < this.board.edges.length; edgeId++) {
      if (LOW[this.domains[edgeId]!]! > 0) {
        this.enqueueEdge(edgeId);
      }
    }

    let changed = true;
    while (changed && !this.isFailed()) {
      if (!this.runLocalFixpoint(stopAtFirstPlacement)) {
        break;
      }
      if (stopAtFirstPlacement && this.hasPlacement()) {
        break;
      }

      changed = false;

      // Reihenfolge = aufsteigender Aufwand. D9 steht vor D5, damit das
      // wiedererkennbare Muster die Begruendung liefert und nicht das
      // allgemeinere Prinzip, das dasselbe abdeckt.
      if (level >= 2) {
        changed = this.applyTwinPairRule();
        if (this.isFailed()) {
          break;
        }
      }
      if ((stopAtFirstPlacement && this.hasPlacement()) || changed) {
        continue;
      }

      if (level >= 2) {
        const isolationChanged = this.applyIsolationRule();
        if (this.isFailed()) {
          break;
        }
        changed = isolationChanged;
      }
      if ((stopAtFirstPlacement && this.hasPlacement()) || changed) {
        continue;
      }

      if (level >= 3) {
        const connectivityChanged = this.applyConnectivityRule();
        if (this.isFailed()) {
          break;
        }
        changed = connectivityChanged;
      }
      if ((stopAtFirstPlacement && this.hasPlacement()) || changed) {
        continue;
      }

      if (level >= 4) {
        const hypothesisChanged = this.applyHypothesisRule(stopAtFirstPlacement);
        if (this.isFailed()) {
          break;
        }
        changed = hypothesisChanged;
      }
    }

    return {
      status: this.isFailed() ? 'contradiction' : 'ok',
      firstPlacement: this.placement,
      complete: !this.isFailed() && this.allDecided(),
    };
  }

  allDecided(): boolean {
    for (let edgeId = 0; edgeId < this.domains.length; edgeId++) {
      if (!this.isDecided(edgeId)) {
        return false;
      }
    }
    return true;
  }

  /** Erste noch offene Kante mit der kleinsten Restauswahl (MRV-Heuristik). */
  selectBranchEdge(): number {
    let best = -1;
    let bestCount = 4;
    for (let edgeId = 0; edgeId < this.domains.length; edgeId++) {
      const mask = this.domains[edgeId]!;
      const count = popCount(mask);
      if (count > 1 && count < bestCount) {
        best = edgeId;
        bestCount = count;
        if (count === 2) {
          break;
        }
      }
    }
    return best;
  }

  /** Noch moegliche Werte einer Kante, aufsteigend. */
  candidates(edgeId: number): number[] {
    const mask = this.domains[edgeId]!;
    const values: number[] = [];
    for (let value = 0; value <= 2; value++) {
      if ((mask & (1 << value)) !== 0) {
        values.push(value);
      }
    }
    return values;
  }

  // ---------------------------------------------------------------------------
  // Regeln D1–D4: Inselgrade und Kreuzungen, bis zum Fixpunkt
  // ---------------------------------------------------------------------------

  private runLocalFixpoint(stopAtFirstPlacement: boolean): boolean {
    while (this.islandQueue.length > 0 || this.edgeQueue.length > 0) {
      if (this.isFailed()) {
        return false;
      }
      if (stopAtFirstPlacement && this.hasPlacement()) {
        return true;
      }

      while (this.edgeQueue.length > 0) {
        const edgeId = this.edgeQueue.pop()!;
        this.edgeQueued[edgeId] = 0;
        this.applyCrossingRule(edgeId);
        if (this.isFailed()) {
          return false;
        }
      }

      const islandId = this.islandQueue.pop();
      if (islandId === undefined) {
        continue;
      }
      this.islandQueued[islandId] = 0;
      this.applyDegreeRules(islandId);
    }
    return !this.isFailed();
  }

  /**
   * D1–D3 in einer gemeinsamen Form: Bedarf und Restkapazitaet der Insel
   * begrenzen jede einzelne anliegende Kante von beiden Seiten.
   */
  private applyDegreeRules(islandId: number): void {
    const required = this.board.required[islandId]!;
    const low = this.sumLow[islandId]!;
    const high = this.sumHigh[islandId]!;

    if (low > required || high < required) {
      this.failed = true;
      return;
    }

    const slack = high - required; // wie weit die Obergrenzen noch sinken duerfen
    const need = required - low; // wie weit die Untergrenzen noch steigen muessen

    if (slack === 0 && need === 0) {
      return;
    }

    for (const edgeId of this.board.edgesByIsland[islandId]!) {
      const mask = this.domains[edgeId]!;
      const edgeLow = LOW[mask]!;
      const edgeHigh = HIGH[mask]!;

      const newHigh = Math.min(edgeHigh, edgeLow + need);
      const newLow = Math.max(edgeLow, edgeHigh - slack);

      if (newHigh === edgeHigh && newLow === edgeLow) {
        continue;
      }

      // Begruendung fuer das Tipp-System auswaehlen
      this.currentIsland = islandId;
      if (newLow > edgeLow) {
        this.currentRule = slack === 0 ? 'D2_FORCED_ALL' : 'D3_MIN_PER_EDGE';
      } else {
        this.currentRule = need === 0 ? 'D1_SATURATED' : 'D3_MIN_PER_EDGE';
      }

      if (!this.restrict(edgeId, rangeMask(newLow, newHigh))) {
        return;
      }
    }
  }

  /** D4: Wo eine Bruecke liegt, kann keine kreuzende Bruecke liegen. */
  private applyCrossingRule(edgeId: number): void {
    if (LOW[this.domains[edgeId]!]! === 0) {
      return;
    }
    for (const other of this.board.crossings[edgeId]!) {
      this.currentRule = 'D4_NO_CROSS';
      this.currentIsland = null;
      if (!this.restrict(other, 0b001)) {
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // D5: keine vorzeitig abgeschlossene Teilgruppe
  // ---------------------------------------------------------------------------

  /**
   * Ein Zug, der eine Gruppe von Inseln vollstaendig abschliesst, ohne dass alle
   * Inseln dazugehoeren, ist unmoeglich — das Endergebnis muss ein einziges Netz sein.
   * Deckt unter anderem die klassischen Faelle 1–1 und 2=2 ab.
   */
  private applyIsolationRule(): boolean {
    const islandCount = this.board.islands.length;
    this.rebuildComponents();

    // Bereits jetzt geschlossene, echte Teilgruppe = Widerspruch.
    for (let islandId = 0; islandId < islandCount; islandId++) {
      const root = this.unionFind.find(islandId);
      if (root !== islandId) {
        continue;
      }
      if (this.openPerRoot[root] === 0 && this.unionFind.componentSize(root) < islandCount) {
        this.failed = true;
        return false;
      }
    }

    const changed = false;

    for (const edge of this.board.edges) {
      const mask = this.domains[edge.id]!;
      if (mask === (mask & -mask)) {
        continue; // bereits entschieden
      }

      const edgeLow = LOW[mask]!;
      const rootA = this.unionFind.find(edge.a);
      const rootB = this.unionFind.find(edge.b);
      const mergedSize =
        rootA === rootB
          ? this.unionFind.componentSize(rootA)
          : this.unionFind.componentSize(rootA) + this.unionFind.componentSize(rootB);

      if (mergedSize >= islandCount) {
        continue; // alles zu verbinden ist nie ein Abschluss zu frueh
      }

      for (let value = Math.max(1, edgeLow); value <= 2; value++) {
        if ((mask & (1 << value)) === 0) {
          continue;
        }
        const degreeA = this.sumLow[edge.a]! - edgeLow + value;
        const degreeB = this.sumLow[edge.b]! - edgeLow + value;
        if (degreeA !== this.board.required[edge.a] || degreeB !== this.board.required[edge.b]) {
          continue;
        }

        let open =
          rootA === rootB
            ? this.openPerRoot[rootA]!
            : this.openPerRoot[rootA]! + this.openPerRoot[rootB]!;
        if (this.sumLow[edge.a] !== this.board.required[edge.a]) {
          open--;
        }
        if (this.sumLow[edge.b] !== this.board.required[edge.b]) {
          open--;
        }

        if (open === 0) {
          this.currentRule = 'D5_NO_ISOLATION';
          this.currentIsland = edge.a;
          if (!this.restrict(edge.id, mask & ~(1 << value))) {
            return changed;
          }
          // Nach einer Aenderung sind die Komponentendaten veraltet. Lieber neu
          // aufbauen als auf veralteten Daten weiter schliessen — eine falsche
          // Deduktion hier wuerde den Solver stillschweigend kaputt machen.
          return true;
        }
      }
    }

    return changed;
  }

  /** Komponenten der bereits sicher gesetzten Bruecken plus Zahl der offenen Inseln je Komponente. */
  private rebuildComponents(): void {
    this.unionFind.reset();
    for (const edge of this.board.edges) {
      if (LOW[this.domains[edge.id]!]! > 0) {
        this.unionFind.union(edge.a, edge.b);
      }
    }
    this.openPerRoot.fill(0);
    for (let islandId = 0; islandId < this.board.islands.length; islandId++) {
      if (this.sumLow[islandId] !== this.board.required[islandId]) {
        const root = this.unionFind.find(islandId);
        this.openPerRoot[root] = this.openPerRoot[root]! + 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // D9: zwei gleich grosse Inseln, die sich gegenseitig abschliessen wuerden
  // ---------------------------------------------------------------------------

  /**
   * Zwei Einsen duerfen nie verbunden werden, zwei Zweien nie doppelt: beide
   * waeren damit voll, und die zwei Inseln bildeten ein fertiges Netz fuer sich,
   * waehrend der Rest des Feldes noch offen ist.
   *
   * Logisch ein Sonderfall von D5 — als eigene Regel gefuehrt, weil sie ein
   * wiedererkennbares Muster ist. Das Tipp-System soll „zwei Einsen gehen nie"
   * sagen koennen statt „das wuerde eine Gruppe abschneiden"; Muster lernt man,
   * allgemeine Prinzipien nicht.
   */
  private applyTwinPairRule(): boolean {
    const islandCount = this.board.islands.length;
    if (islandCount <= 2) {
      return false;
    }

    for (const edge of this.board.edges) {
      const mask = this.domains[edge.id]!;
      if (mask === (mask & -mask)) {
        continue; // bereits entschieden
      }

      const required = this.board.required[edge.a]!;
      if (required > 2 || required !== this.board.required[edge.b]) {
        continue;
      }
      // Nur solange beide Inseln noch voellig unbelegt sind: sonst waere die
      // Saettigung durch diese eine Kante ohnehin nicht mehr moeglich.
      if (this.sumLow[edge.a] !== 0 || this.sumLow[edge.b] !== 0) {
        continue;
      }
      if ((mask & (1 << required)) === 0) {
        continue;
      }

      this.currentRule = 'D9_TWIN_PAIR';
      this.currentIsland = edge.a;
      this.restrict(edge.id, mask & ~(1 << required));
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // D6: Bruecken, ohne die das Netz zerfaellt
  // ---------------------------------------------------------------------------

  /**
   * Betrachtet den Graphen aller noch moeglichen Verbindungen, nachdem sicher
   * gesetzte Bruecken zu Komponenten zusammengezogen wurden. Ist eine Kante darin
   * eine Bruecke im graphentheoretischen Sinn, muss sie im Ergebnis vorkommen.
   * Zerfaellt der Graph bereits jetzt, ist die Stellung unmoeglich.
   *
   * Dieselbe Tiefensuche liefert nebenbei D8: Fuer eine Schnittkante ist die
   * abgetrennte Seite nur ueber genau diese Kante erreichbar. Jede Bruecke dort
   * belegt entweder zwei Enden innerhalb der Gruppe oder eines auf der
   * Schnittkante — die Summe der Inselzahlen der abgetrennten Seite legt damit
   * die Parität dieser einen Kante fest. Zusammen mit dem Zusammenhang ist sie
   * dann vollstaendig bestimmt: ungerade Summe heisst eine Bruecke, gerade zwei.
   */
  private applyConnectivityRule(): boolean {
    const islandCount = this.board.islands.length;
    if (islandCount <= 1) {
      return false;
    }
    this.rebuildComponents();

    const adjacency = new Map<number, { to: number; edgeId: number }[]>();
    const ensure = (node: number): { to: number; edgeId: number }[] => {
      let list = adjacency.get(node);
      if (!list) {
        list = [];
        adjacency.set(node, list);
      }
      return list;
    };

    for (let islandId = 0; islandId < islandCount; islandId++) {
      ensure(this.unionFind.find(islandId));
    }

    for (const edge of this.board.edges) {
      if (HIGH[this.domains[edge.id]!]! === 0) {
        continue;
      }
      const rootA = this.unionFind.find(edge.a);
      const rootB = this.unionFind.find(edge.b);
      if (rootA === rootB) {
        continue;
      }
      ensure(rootA).push({ to: rootB, edgeId: edge.id });
      ensure(rootB).push({ to: rootA, edgeId: edge.id });
    }

    const nodes = [...adjacency.keys()];
    if (nodes.length <= 1) {
      return false;
    }

    // Summe der Inselzahlen je zusammengezogenem Knoten — Grundlage fuer D8.
    const requiredPerNode = new Map<number, number>();
    for (let islandId = 0; islandId < islandCount; islandId++) {
      const root = this.unionFind.find(islandId);
      requiredPerNode.set(root, (requiredPerNode.get(root) ?? 0) + this.board.required[islandId]!);
    }

    const discovery = new Map<number, number>();
    const lowLink = new Map<number, number>();
    /** Schnittkanten samt der Inselzahl-Summe auf der abgetrennten Seite. */
    const cuts: { edgeId: number; requiredSum: number }[] = [];
    let timer = 0;

    const dfs = (node: number, incomingEdge: number): number => {
      timer++;
      discovery.set(node, timer);
      lowLink.set(node, timer);
      let subtree = requiredPerNode.get(node) ?? 0;

      for (const link of adjacency.get(node) ?? []) {
        if (link.edgeId === incomingEdge) {
          continue; // nur genau diese Kante, parallele Kanten zaehlen weiter
        }
        const seen = discovery.get(link.to);
        if (seen === undefined) {
          const childSum = dfs(link.to, link.edgeId);
          subtree += childSum;
          const childLow = lowLink.get(link.to)!;
          lowLink.set(node, Math.min(lowLink.get(node)!, childLow));
          if (childLow > discovery.get(node)!) {
            cuts.push({ edgeId: link.edgeId, requiredSum: childSum });
          }
        } else {
          lowLink.set(node, Math.min(lowLink.get(node)!, seen));
        }
      }

      return subtree;
    };

    dfs(nodes[0]!, -1);

    if (discovery.size !== nodes.length) {
      // Nicht alle Inseln sind ueberhaupt noch erreichbar.
      this.failed = true;
      return false;
    }

    // Keine der folgenden Einschraenkungen entfernt eine Kante aus dem
    // Moeglichkeitsgraphen — weder eine Untergrenze noch ein Paritaetsschluss
    // setzt eine Obergrenze auf 0. Die eben berechneten Schnittkanten bleiben
    // deshalb waehrend der ganzen Schleife gueltig.
    let changed = false;
    for (const cut of cuts) {
      const mask = this.domains[cut.edgeId]!;

      if (LOW[mask]! === 0) {
        this.currentRule = 'D6_CONNECTIVITY_BRIDGE';
        this.currentIsland = null;
        if (!this.restrict(cut.edgeId, mask & 0b110)) {
          return changed;
        }
        changed = true;
      }

      // D8: Auf der abgetrennten Seite enden alle Bruecken entweder mit beiden
      // Enden dort — das sind immer zwei — oder sie laufen ueber diese eine
      // Schnittkante hinaus. Die Summe der Inselzahlen dort hat deshalb dieselbe
      // Parität wie die Zahl der Bruecken auf dieser Kante.
      const parityMask = cut.requiredSum % 2 === 1 ? 0b010 : 0b101;
      if ((this.domains[cut.edgeId]! & ~parityMask) !== 0) {
        this.currentRule = 'D8_PARITY_CUT';
        this.currentIsland = null;
        if (!this.restrict(cut.edgeId, parityMask)) {
          return changed;
        }
        changed = true;
      }
    }

    return changed;
  }

  // ---------------------------------------------------------------------------
  // D7: Probeannahme
  // ---------------------------------------------------------------------------

  /**
   * Nimmt einen Wert versuchsweise an und propagiert mit den flacheren Regeln.
   * Fuehrt das zum Widerspruch, ist der Wert ausgeschlossen.
   * Teuer, deshalb erst auf der hoechsten Stufe und im Tipp-System als letzte Instanz.
   */
  private applyHypothesisRule(stopAtFirstPlacement: boolean): boolean {
    let changed = false;

    for (let edgeId = 0; edgeId < this.domains.length; edgeId++) {
      const mask = this.domains[edgeId]!;
      if (mask === (mask & -mask)) {
        continue;
      }

      for (let value = 0; value <= 2; value++) {
        if ((this.domains[edgeId]! & (1 << value)) === 0) {
          continue;
        }

        const mark = this.mark();
        const outerPlacement = this.placement;
        const outerRecording = this.recordPlacements;
        // Waehrend der Probeannahme wird weder gezaehlt noch ein Tipp
        // mitgeschrieben — was hier passiert, ist Gedankenspiel, kein Zug.
        this.recordPlacements = false;
        this.counting = false;

        this.fix(edgeId, value);
        this.propagateShallow();
        const impossible = this.isFailed();

        this.undoTo(mark);
        this.recordPlacements = outerRecording;
        this.counting = true;
        this.placement = outerPlacement;

        if (impossible) {
          this.currentRule = 'D7_HYPOTHESIS';
          this.currentIsland = null;
          if (!this.restrict(edgeId, this.domains[edgeId]! & ~(1 << value))) {
            return changed;
          }
          changed = true;
          if (!this.runLocalFixpoint(stopAtFirstPlacement)) {
            return changed;
          }
          if (stopAtFirstPlacement && this.hasPlacement()) {
            return true;
          }
        }
      }
    }

    return changed;
  }

  /**
   * Fixpunkt ueber alle Regeln ausser der Probeannahme selbst.
   * Wird innerhalb einer Probeannahme benutzt, um den Widerspruch zu finden.
   */
  private propagateShallow(): void {
    let changed = true;
    while (changed && !this.isFailed()) {
      if (!this.runLocalFixpoint(false)) {
        return;
      }
      changed = this.applyTwinPairRule();
      if (this.isFailed()) {
        return;
      }
      if (changed) {
        continue;
      }
      changed = this.applyIsolationRule();
      if (this.isFailed()) {
        return;
      }
      if (changed) {
        continue;
      }
      changed = this.applyConnectivityRule();
    }
  }

  // ---------------------------------------------------------------------------
  // Kernmutation
  // ---------------------------------------------------------------------------

  /** Schneidet die Maske einer Kante zu. Liefert false bei leerem Wertebereich. */
  private restrict(edgeId: number, mask: number): boolean {
    const oldMask = this.domains[edgeId]!;
    const newMask = oldMask & mask;

    if (newMask === oldMask) {
      return true;
    }
    if (newMask === 0) {
      this.failed = true;
      return false;
    }

    this.trail.push(edgeId, oldMask);
    this.writeDomain(edgeId, newMask);

    if (this.counting) {
      this.usage.set(this.currentRule, (this.usage.get(this.currentRule) ?? 0) + 1);
      this.trace?.push(this.currentRule);
    }

    if (this.recordPlacements && !this.placement && LOW[newMask]! > LOW[oldMask]!) {
      this.placement = {
        ruleId: this.currentRule,
        edgeId,
        value: LOW[newMask]! as BridgeCount,
        islandId: this.currentIsland,
      };
    }

    return true;
  }

  /** Schreibt eine Maske und haelt die Inselsummen und Warteschlangen aktuell. */
  private writeDomain(edgeId: number, newMask: number): void {
    const oldMask = this.domains[edgeId]!;
    if (oldMask === newMask) {
      return;
    }
    const edge = this.board.edges[edgeId]!;

    const lowDelta = LOW[newMask]! - LOW[oldMask]!;
    const highDelta = HIGH[newMask]! - HIGH[oldMask]!;

    this.domains[edgeId] = newMask;
    this.sumLow[edge.a] = this.sumLow[edge.a]! + lowDelta;
    this.sumLow[edge.b] = this.sumLow[edge.b]! + lowDelta;
    this.sumHigh[edge.a] = this.sumHigh[edge.a]! + highDelta;
    this.sumHigh[edge.b] = this.sumHigh[edge.b]! + highDelta;

    this.enqueueIsland(edge.a);
    this.enqueueIsland(edge.b);

    if (LOW[newMask]! > 0) {
      this.enqueueEdge(edgeId);
    }
  }

  private enqueueIsland(islandId: number): void {
    if (this.islandQueued[islandId] === 1) {
      return;
    }
    this.islandQueued[islandId] = 1;
    this.islandQueue.push(islandId);
  }

  private enqueueEdge(edgeId: number): void {
    if (this.edgeQueued[edgeId] === 1) {
      return;
    }
    this.edgeQueued[edgeId] = 1;
    this.edgeQueue.push(edgeId);
  }
}

function popCount(mask: number): number {
  let count = 0;
  let value = mask;
  while (value !== 0) {
    value &= value - 1;
    count++;
  }
  return count;
}
