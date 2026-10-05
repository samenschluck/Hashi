/**
 * Erzeugt die Screenshots fuer den Play-Store-Eintrag.
 *
 * Jedes Bild besteht aus zwei Teilen: oben eine kurze Ueberschrift, darunter
 * ein echter Bildschirm der App. Nackte Bildschirmfotos zeigen zwar, wie die App
 * aussieht, aber nicht, warum man sie spielen sollte — die Ueberschrift sagt in
 * einer Zeile, was das Bild zeigt. Das war auch die Hauptempfehlung im
 * Feedback-Bericht der Tester.
 *
 * Ablauf: Die App laeuft im echten Chromium, ein vorzeigbarer Spielstand wird
 * eingestellt, jeder Bildschirm wird fotografiert und anschliessend auf einer
 * zweiten Seite mit Ueberschrift zu einem Store-Bild zusammengesetzt. Beides in
 * Playwright, ohne Bildbibliothek.
 *
 * Voraussetzung: `npm run dev` laeuft.
 * Aufruf: `npm run store:screenshots [-- --locale=en] [-- --device=tablet7]`
 */
import { mkdir, readdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const locale = process.argv.find((value) => value.startsWith('--locale='))?.slice(9) ?? 'de';
const device = process.argv.find((value) => value.startsWith('--device='))?.slice(9) ?? 'phone';

/**
 * Grundflaeche in CSS-Pixeln, dazu die Pixeldichte. Das Produkt ergibt die
 * Bilddatei; Play verlangt mindestens 1080 Pixel an der kurzen Seite.
 * `frame` ist die Breite des eingesetzten App-Bildschirms als Anteil.
 */
const devices = {
  phone: { width: 360, height: 640, scale: 3, frame: 0.76 },
  tablet7: { width: 600, height: 960, scale: 2, frame: 0.74 },
  tablet10: { width: 800, height: 1280, scale: 2, frame: 0.74 },
};

const layout = devices[device];
if (!layout) {
  throw new Error(`Unbekanntes Geraet: ${device}. Erlaubt: ${Object.keys(devices).join(', ')}`);
}

const outputDirectory =
  device === 'phone' ? `store/screenshots/${locale}` : `store/screenshots/${locale}-${device}`;

// Alte Bilder entfernen: Haben sich Namen geaendert, laege sonst ein veralteter
// Satz neben dem neuen und landet beim Hochladen versehentlich mit im Store.
await mkdir(outputDirectory, { recursive: true });
for (const file of await readdir(outputDirectory)) {
  if (file.endsWith('.png')) await rm(`${outputDirectory}/${file}`);
}

const label = (de, en) => (locale === 'de' ? de : en);

/** Ueberschrift und Unterzeile je Bild. */
const captions = {
  play: [
    label('Verbinde alle Inseln', 'Connect every island'),
    label('Brücken ziehen, bis jede Zahl stimmt', 'Draw bridges until every number fits'),
  ],
  hard: [
    label('Mauern und verborgene Zahlen', 'Walls and hidden numbers'),
    label('Neue Regeln für echte Knobler', 'Fresh twists for real puzzlers'),
  ],
  hint: [
    label('Tipps, die erklären warum', 'Hints that explain why'),
    label('Die Logik lernen statt raten', "Learn the logic, don't just guess"),
  ],
  stars: [
    label('Hol dir alle drei Sterne', 'Earn all three stars'),
    label('Ohne Tipp und ohne Rückgängig', 'No hints and no undo'),
  ],
  levels: [
    label('Vier Schwierigkeitsstufen', 'Four difficulty levels'),
    label('Von entspannt bis richtig knifflig', 'From relaxed to fiendish'),
  ],
  daily: [
    label('Jeden Tag ein neues Rätsel', 'A new puzzle every day'),
    label('Halte deine Serie am Leben', 'Keep your streak alive'),
  ],
  colorblind: [
    label('Farbenblind-Modus', 'Colorblind mode'),
    label('Häkchen und Rahmen statt nur Farben', 'Check marks and outlines, not just colors'),
  ],
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({
  viewport: { width: layout.width, height: layout.height },
  deviceScaleFactor: layout.scale,
  locale: locale === 'de' ? 'de-DE' : 'en-US',
});
const page = await context.newPage();
const composer = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(url, { waitUntil: 'networkidle' });

// Im Browser steht unten ein grauer Platzhalter „Werbung", wo auf dem Telefon
// der Banner liegt. Im Store-Bild hat er nichts verloren.
await page.addStyleTag({ content: '.app-banner-slot { display: none !important; }' });

// Einen vorzeigbaren Spielstand einstellen: etwas Fortschritt, eine Serie,
// genug Tipps. Ohne das zeigen die Bilder nur leere Listen.
await page.evaluate((chosenLocale) => {
  const app = window.__bridgeletApp;
  const state = app.getState();
  const levels = {};
  for (let index = 1; index <= 23; index++) {
    levels[`easy-${String(index).padStart(4, '0')}`] = {
      solved: true,
      bestTimeMs: 60000 + index * 4200,
      hintsUsed: index % 3,
      undosUsed: index % 2,
      // Gemischte Sterne: die Levelauswahl soll zeigen, dass es etwas zu holen
      // gibt, und nicht wie eine lueckenlose Reihe voller Bestleistungen wirken.
      stars: [3, 2, 3, 1, 2, 3][index % 6],
    };
  }
  app.setState({
    save: {
      ...state.save,
      settings: { ...state.save.settings, locale: chosenLocale, localeChosen: true },
      levels,
      hints: { ...state.save.hints, balance: 7 },
      // Sechs Tage in Folge bis gestern: Die Anzeige zaehlt eine Serie nur,
      // solange der letzte geloeste Tag gestern oder heute ist.
      daily: (() => {
        const key = (offset) => {
          const date = new Date();
          date.setDate(date.getDate() - offset);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${String(date.getFullYear())}-${month}-${day}`;
        };
        const days = [6, 5, 4, 3, 2, 1].map(key);
        return { streak: 6, longestStreak: 11, lastSolvedDay: key(1), solvedDays: days };
      })(),
      stats: {
        solvedTotal: 23,
        totalTimeMs: 23 * 96000,
        hintsSpent: 14,
        solvedByDifficulty: { easy: 14, medium: 6, hard: 2, expert: 1 },
      },
    },
  });
  app.getState().setNotice(null);
}, locale);

await page.waitForTimeout(400);

/** Laedt ein Kampagnenlevel direkt, ohne Umweg ueber die Levelauswahl. */
async function openLevel(difficulty, index) {
  await page.evaluate(
    async ([d, i]) => {
      const app = window.__bridgeletApp;
      app.setState({ screen: 'menu', stack: [] });
      await app.getState().startCampaignLevel(d, i);
    },
    [difficulty, index],
  );
  await page.waitForTimeout(400);
}

/** Setzt einen Anteil der Loesung, in der Reihenfolge der Kanten. */
async function solvePart(fraction) {
  await page.evaluate((share) => {
    const { puzzle } = window.__bridgeletApp.getState().active;
    const game = window.__bridgelet.getState();
    const count = Math.ceil(puzzle.solution.length * share);
    for (let index = 0; index < count; index++) {
      if (puzzle.solution[index] > 0) game.setEdge(index, puzzle.solution[index]);
    }
  }, fraction);
}

/** Fotografiert den aktuellen Bildschirm und setzt ihn zum Store-Bild zusammen. */
let number = 0;
async function shot(name, caption) {
  number++;
  await page.waitForTimeout(500);
  const raw = await page.screenshot();
  const [title, subtitle] = caption;
  const frameWidth = Math.round(layout.width * layout.frame);
  const frameHeight = Math.round((frameWidth * layout.height) / layout.width);

  await composer.setContent(`<!doctype html>
<html><head><style>
  html, body { margin: 0; width: ${layout.width}px; height: ${layout.height}px; overflow: hidden; }
  body {
    background:
      radial-gradient(120% 60% at 50% 0%, rgba(56, 189, 248, 0.22), transparent 70%),
      linear-gradient(180deg, #0b1324 0%, #0f172a 100%);
    font-family: system-ui, 'DejaVu Sans', sans-serif;
    color: #f1f5f9;
    display: flex; flex-direction: column; align-items: center;
  }
  header {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    align-items: center; text-align: center; padding: 0 6%;
  }
  h1, p { text-wrap: balance; }
  h1 {
    margin: 0; font-weight: 700; letter-spacing: -0.01em; line-height: 1.12;
    font-size: ${(layout.width * 0.072).toFixed(1)}px;
  }
  p {
    margin: 0.45em 0 0; color: #7dd3fc; line-height: 1.3;
    font-size: ${(layout.width * 0.04).toFixed(1)}px;
  }
  img {
    display: block; width: ${frameWidth}px; height: ${frameHeight}px;
    border-radius: ${(layout.width * 0.05).toFixed(0)}px ${(layout.width * 0.05).toFixed(0)}px 0 0;
    border: 1px solid rgba(148, 163, 184, 0.35); border-bottom: none;
    box-shadow: 0 -8px 40px rgba(56, 189, 248, 0.18);
    object-fit: cover; object-position: top;
  }
  /* Unten abschneiden, oben und seitlich nicht: sonst endet der Lichtschein
     an einer harten Kante, und an den runden Ecken bleibt ein helles Rechteck. */
  .frame {
    height: ${Math.round(layout.height * 0.79)}px;
    clip-path: inset(-100px -100px 0 -100px);
  }
</style></head><body>
  <header><h1>${title}</h1><p>${subtitle}</p></header>
  <div class="frame"><img src="data:image/png;base64,${raw.toString('base64')}"></div>
</body></html>`);
  await composer.waitForTimeout(150);

  // Der Geraetename steht im Dateinamen, nicht nur im Ordner: Beim Hochladen
  // landen alle Saetze im selben Auswahldialog, ohne Praefix hiessen dort
  // sechs Dateien gleich.
  const file = `${outputDirectory}/${device}-${String(number).padStart(2, '0')}-${name}.png`;
  await composer.screenshot({ path: file });
  console.log(file);
}

// 1 Spielfeld mittendrin — das wichtigste Bild, deshalb vorn.
await openLevel('medium', 4);
await solvePart(0.5);
await shot('spiel', captions.play);

// 2 Schweres Brett mit Mauern und verborgener Inselzahl.
await openLevel('hard', 6);
await solvePart(0.4);
await shot('schwer', captions.hard);

// 3 Tipp mit Begruendung, auf demselben schweren Brett.
await page.evaluate(() => {
  window.__bridgeletApp.getState().requestHint();
});
await shot('tipp', captions.hint);

// Der Tipp hat einen vom Guthaben abgezogen. Zuruecksetzen, damit alle Bilder
// denselben Stand zeigen und nicht von Bild zu Bild weniger Tipps.
await page.evaluate(() => {
  const app = window.__bridgeletApp;
  const { save } = app.getState();
  app.setState({ save: { ...save, hints: { ...save.hints, balance: 7 } } });
});

// 4 Geloest mit drei Sternen: ein frisches Level ohne Tipp und ohne Rueckgaengig.
// Ohne Zutun waere es in null Sekunden geloest — „Zeit: 0:00" wirkt gestellt.
// Deshalb laeuft die Uhr der Seite vor dem Loesen gut zweieinhalb Minuten vor.
await openLevel('medium', 9);
await page.evaluate(() => {
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + 154_000;
});
await solvePart(1);
await shot('sterne', captions.stars);

// 5 Levelauswahl mit den vier Stufen.
await page.evaluate(() => {
  window.__bridgeletApp.setState({ screen: 'menu', stack: [] });
});
await page.getByRole('button', { name: label('Spielen', 'Play'), exact: true }).click();
await shot('level', captions.levels);

// 6 Tagesraetsel.
await page.evaluate(() => {
  window.__bridgeletApp.setState({ screen: 'menu', stack: [] });
});
await page.getByRole('button', { name: label('Tagesrätsel', 'Daily puzzle'), exact: true }).click();
await shot('tagesraetsel', captions.daily);

// 7 Farbenblind-Modus: fertige Inseln mit Haekchen, eine ueberfuellte Insel
// mit gestricheltem Rand. Dafuer wird gezielt eine Bruecke zu viel gesetzt.
await page.evaluate(() => {
  const app = window.__bridgeletApp;
  app.getState().updateSettings({ colorblind: true });
});
await openLevel('medium', 4);
await solvePart(0.6);
await page.evaluate(() => {
  const { puzzle } = window.__bridgeletApp.getState().active;
  const game = window.__bridgelet.getState();
  const board = game.board;
  // Eine Kante, die in der Loesung leer ist, und deren Inseln schon voll sind:
  // eine Bruecke dort macht beide sichtbar „zu voll".
  const degree = new Map();
  for (const edge of board.edges) {
    const count = game.counts[edge.id] ?? 0;
    degree.set(edge.a, (degree.get(edge.a) ?? 0) + count);
    degree.set(edge.b, (degree.get(edge.b) ?? 0) + count);
  }
  const full = (id) => degree.get(id) === board.islands[id].required;
  const candidate = board.edges.find(
    (edge) =>
      puzzle.solution[edge.id] === 0 &&
      (game.counts[edge.id] ?? 0) === 0 &&
      (full(edge.a) || full(edge.b)) &&
      !board.islands[edge.a].hidden &&
      !board.islands[edge.b].hidden,
  );
  if (candidate) game.setEdge(candidate.id, 1);
});
await shot('farbenblind', captions.colorblind);

// Einstellung zuruecksetzen, damit ein erneuter Lauf sauber startet.
await page.evaluate(() => {
  window.__bridgeletApp.getState().updateSettings({ colorblind: false });
});

if (errors.length > 0) {
  console.error('Fehler auf der Seite:', errors);
  process.exitCode = 1;
}

await browser.close();
