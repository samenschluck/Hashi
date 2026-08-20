/**
 * Oberflaechen-Rauchtest im echten Browser.
 *
 * Startet Chromium, laedt den Entwicklungsserver, spielt die beiden Bedienarten
 * durch (Ziehen und Tipp-Tipp) und macht einen Screenshot. Prueft ausserdem, dass
 * die Konsole fehlerfrei bleibt — einer der Punkte aus der Qualitaetsliste in
 * Meilenstein 5.
 *
 * Voraussetzung: `npm run dev` laeuft.
 * Aufruf: `node scripts/ui-check.mjs [url] [ausgabedatei.png]`
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? 'ui-check.png';

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const store = window.__bridgelet;
  if (!store) return null;
  const s = store.getState();
  return {
    islands: s.board.islands,
    width: s.board.width,
    height: s.board.height,
    edges: s.board.edges,
  };
});

const box = await page.locator('canvas').boundingBox();

if (info) {
  const available = Math.min(box.width, box.height);
  const cell = available / Math.max(info.width, info.height);
  const originX = box.x + (box.width - cell * info.width) / 2 + cell / 2;
  const originY = box.y + (box.height - cell * info.height) / 2 + cell / 2;
  const at = (i) => ({ x: originX + i.x * cell, y: originY + i.y * cell });

  // Erste Kante des Boards per Ziehen bedienen.
  const edge = info.edges[0];
  const from = at(info.islands[edge.a]);
  const to = at(info.islands[edge.b]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const counts = await page.evaluate(() => Array.from(window.__bridgelet.getState().counts));
  console.log('Kante 0 nach Ziehen:', counts[0]);

  // Zweites Mal ziehen macht eine Doppelbruecke.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log(
    'Kante 0 nach zweitem Ziehen:',
    (await page.evaluate(() => Array.from(window.__bridgelet.getState().counts)))[0],
  );

  // Tipp-Tipp auf zwei andere Inseln.
  const second = info.edges[1];
  if (second) {
    const a = at(info.islands[second.a]);
    const b = at(info.islands[second.b]);
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(200);
    console.log(
      'Kante 1 nach Tipp-Tipp:',
      (await page.evaluate(() => Array.from(window.__bridgelet.getState().counts)))[1],
    );
  }
}

await page.screenshot({ path: out });
console.log('Konsolenfehler:', errors.length ? errors : 'keine');
await browser.close();
