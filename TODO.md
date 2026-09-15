# Offene Punkte bis zur Veröffentlichung

Diese Liste sammelt alles, was **vor** der Veröffentlichung im Play Store erledigt sein
muss und nicht im Code steckt. Der Code selbst ist fertig — Stand siehe `PROGRESS.md`.

---

## 🔴 Blockiert die Veröffentlichung

### 1. Name und ladungsfähige Anschrift in die Datenschutzerklärung — ✅ erledigt

Eingetragen am 20.08.2026 in `docs/datenschutz.html` und `docs/privacy.html`:
Verantwortlicher mit Name, Anschrift und Kontakt-E-Mail. Der rote Platzhalter ist
entfallen, die zugehörige CSS-Klasse `.todo` ebenfalls.

**Bei jeder inhaltlichen Änderung** an einer der beiden Fassungen auch das Datum unter
„Stand" bzw. „Last updated" mitziehen — und die jeweils andere Sprachfassung nachziehen.

### 2. Echte AdMob-IDs und veröffentlichte DSGVO-Nachricht — ✅ erledigt

- App-ID, Banner-Unit-ID, Rewarded-Unit-ID aus der AdMob-Konsole ✅
- EU-Einwilligungsnachricht angelegt **und veröffentlicht** ✅ (unveröffentlicht liefert
  `showConsentForm()` nichts zurück)
- IDs als GitHub-Secrets hinterlegt ✅

Ob der Einwilligungsdialog tatsächlich erscheint, zeigt erst der Gerätetest.

**Die echten IDs gehören nicht ins Repository.** Es ist öffentlich, und veröffentlichte
Werbe-IDs laden dazu ein, sie in fremden Apps für ungültigen Traffic zu missbrauchen —
gesperrt würde dann das eigene AdMob-Konto. Sie gehören ausschließlich in die lokale
`.env` (gitignored) und in die GitHub-Secrets.

### 3. Release-Keystore — ✅ erledigt

- Erzeugt, Alias `bridgelet`, gültig bis Januar 2054 ✅
- Als vier Secrets in GitHub hinterlegt ✅
- Der erste Release-Build (20.08.2026) bestätigt die Signatur mit dem Release-Schlüssel ✅

**Weiter sicher aufbewahren.** Mit Play App Signing ist er nur der Upload-Schlüssel und
liesse sich über den Play-Support zurücksetzen — angenehm ist das trotzdem nicht.

### 4. Test auf einem echten Gerät — ✅ Debug-Build geprüft

**Erledigt am 20.08.2026** über eine Debug-APK aus Android Studio. Geprüft und in
Ordnung:

- Bedienung, Darstellung und Ablauf auf echter Hardware
- Einwilligungsdialog erscheint direkt beim ersten Start, **vor** der ersten
  Anzeigenanfrage
- Banner lädt und überlagert nichts
- Belohntes Video läuft und schreibt die Tipps gut

Damit ist die vollständige Kette Einwilligung → Anzeigenanfrage → Banner → belohntes
Video → Gutschrift einmal nachgewiesen.

**Restposition am 21.08.2026 geschlossen.** Über den geschlossenen Test installiert und
auf echter Hardware geprüft:

- Der Einwilligungsdialog erscheint beim ersten Start. Da UMP ein Formular nur ausliefert,
  wenn für die App-ID eine Nachricht **veröffentlicht** ist, belegt das zugleich, dass es
  die eigene Nachricht ist und dass die echte App-ID aus dem GitHub-Secret korrekt im
  Manifest gelandet ist — Letzteres war im Protokoll nie sichtbar, weil Secrets maskiert
  werden.
- „Einstellungen → Datenschutzeinstellungen" ist vorhanden und öffnet das Formular
  erneut. Das erfüllt die AdMob-Anforderung an den Widerruf.
- Der Banner lädt echte Anzeigen.

Damit war die Erwartung widerlegt, eine noch nicht mit dem Store verknüpfte AdMob-App
bekomme kaum Füllung — sie liefert. Die Verknüpfung nach der Veröffentlichung bleibt
sinnvoll, blockiert aber nichts.

**Ein AAB lässt sich nicht direkt auf ein Telefon installieren** — es ist ein Format für
die Play Console, kein Installationspaket. Zwei Wege zum Gerät:

- **Debug-APK** über Android Studio: zeigt Test-Anzeigen, Klicks darauf sind
  unbedenklich. Der richtige Weg für Bedienung, Bildrate und Spielgefühl.
- **Interner Test in der Play Console**: das AAB hochladen und über den Play-Link
  installieren. Nur so lassen sich echter Einwilligungsdialog, echte Anzeigen und
  belohntes Video prüfen — dort dann **nie selbst auf eine Anzeige klicken**.

Was in der Entwicklungsumgebung nicht prüfbar war:

- 60 fps auf Mid-Range-Hardware, Touch-Gefühl
- Einwilligungsdialog erscheint tatsächlich
- Banner überlagert nichts, belohntes Video schreibt Tipps gut
- Fortschritt überlebt ein Force-Close

### 5. Play-Console-Formulare — ✅ erledigt, App geprüft

**Stand 21.08.2026:** Alle Formulare ausgefüllt, Store-Eintrag angelegt, Release
1.0.0 (versionCode 2) eingereicht und von Google **geprüft**. Der geschlossene Test
läuft.

Was dabei nachträglich dazukam und in der ursprünglichen Liste fehlte:

- **Werbe-ID-Erklärung** (App-Inhalte → Werbe-ID): Ja, Zwecke „Werbung oder Marketing"
  und „Betrugsprävention, Sicherheit und Compliance" — dieselben zwei wie bei
  „Geräte- oder andere IDs" in der Datensicherheit. Google gleicht beide Formulare ab.
- **Erklärungen zu Gesundheits-, Behörden- und Finanz-Apps**: jeweils „trifft nicht zu".
- **Formfaktor „Google Play Games auf dem PC"**: bewusst **nicht** aktiviert. Die App
  wurde nie mit Maus und Tastatur geprüft, und der PC-Client bringt eine eigene
  Prüfung mit. Nachträglich jederzeit einschaltbar.

**Der Engpass ist jetzt die Testerzahl**, nicht mehr die Technik: Der Produktionszugang
verlangt einen durchgehend laufenden geschlossenen Test mit genügend angemeldeten
Testern. Die Tage zählen erst, wenn die geforderte Zahl erreicht ist — wer später
Tester nachträgt, verschiebt damit den Starttermin.

### Ursprüngliche Liste

- Datenschutz-URL eintragen: `https://samenschluck.github.io/Hashi/privacy.html`
  (die englische Fassung, passend zur Standardsprache des Store-Eintrags; sie verlinkt
  oben auf die deutsche)
- URL zur Datenlöschung eintragen: `https://samenschluck.github.io/Hashi/data-deletion.html`
  (verlangt die Datensicherheit, sobald dort „Nutzer können Löschung anfordern" auf Ja
  steht — zweisprachig auf einer Seite, damit eine URL für alle Regionen reicht)
- Datensicherheit nach `store/data-safety.md`
- Content-Rating nach `store/content-rating.md`
- „Diese App enthält Werbung" anhaken
- `versionCode` vor jedem Upload erhöhen

---

## 🟡 Erledigt, aber im Blick behalten

- **Markenprüfung „Bridgelet"** — WIPO, TMview, DPMAregister und Play Store durchsucht,
  keine Treffer. Der Halbleiter-Hersteller CrossFire benutzt den Begriff für ein
  patentiertes Bauteil; andere Warenklasse, andere Abnehmer. Keine Rechtsberatung.
- **Bundle-ID `com.bridgelet.game`** — nach dem ersten Upload unveränderlich.
- **Browser-Fassung unter `docs/play/`** — eingecheckter Web-Build zum Testen ohne Gerät.
  Nach Änderungen am Spiel mit `npm run pages:play` neu erzeugen, sonst zeigt die
  öffentliche Seite einen veralteten Stand. Darf vor dem Release gelöscht werden.

---

## 🔵 Laufender Betrieb

- **Anfragen zu Datenschutzrechten** — Vorlagen und Fristen in
  `store/datenanfragen.md`. Kern: innerhalb eines Monats antworten, auch wenn keine
  Daten vorliegen. Gelöscht werden kann nichts, weil nichts gespeichert wird.
- **Vorlagen prüfen, wenn sich die App ändert** — kommt später ein Konto, eine
  Bestenliste oder ein Analysewerkzeug dazu, stimmen Datenschutzerklärung,
  Data-Safety-Formular und die Antwortvorlagen nicht mehr.

---

## 🟠 Direkt nach der Veröffentlichung

Beides setzt eine **öffentlich auffindbare** App im Play Store voraus und ist deshalb
vorher unmöglich:

- **AdMob: App-Shop verknüpfen.** In der AdMob-Konsole unter „App-Shops angeben" nach
  `com.bridgelet.game` suchen und verknüpfen. Bis dahin bleibt die App unverifiziert,
  und echte Anzeigen liefern wenig bis gar nicht. Während eines geschlossenen Tests ist
  die Suche zwangsläufig ergebnislos — dann **keinen** anderen App-Shop ankreuzen, nur
  weil ein Häkchen verlangt scheint. Eine Falschangabe gegenüber dem Werbenetzwerk
  gefährdet das Konto.
- **`app-ads.txt` — Pflicht für die AdMob-Verifizierung, nicht nur eine Optimierung.**

  Ohne die Datei bricht die App-Überprüfung in AdMob mit „konnte nicht bestätigt werden"
  ab. Der Stolperstein steckt im Ablageort: Der Crawler leitet aus der im Play Store
  eingetragenen Entwickler-Website die **Stammdomain** ab und ignoriert jeden
  Unterordner. Bei `https://samenschluck.github.io/Hashi/` sucht er also unter

  ```
  https://samenschluck.github.io/app-ads.txt
  ```

  Diese Adresse gehört **nicht** zu diesem Repository — eine Datei unter `docs/`
  landet bei `.../Hashi/app-ads.txt` und hilft nicht.

  Nötig ist ein zweites, öffentliches Repository mit dem exakten Namen
  `samenschluck.github.io`, darin `app-ads.txt` im Wurzelverzeichnis mit der Zeile aus
  der AdMob-Konsole (`google.com, pub-…, DIRECT, …`), und GitHub Pages auf `main` /
  `/ (root)`.

  Zwei Voraussetzungen, an denen es sonst scheitert: Im Play-Store-Eintrag muss unter
  _Store-Einstellungen_ eine Website auf derselben Domain hinterlegt sein — ist das Feld
  leer, findet AdMob keine Domain. Und der Crawler braucht Zeit: AdMob nennt „ein paar
  Minuten", in der Praxis sind Stunden bis Tage normal. Nicht mehrfach neu einrichten,
  sondern warten.

---

## ⚪ Optional, später

- Kauf „Werbung entfernen" — das Kennzeichen `adsRemoved` ist im Code bereits vorgesehen
  und wird vom Banner respektiert, der Kauf selbst ist nicht implementiert
- iOS — die Architektur ist darauf vorbereitet, alle nativen Zugriffe laufen über
  Service-Wrapper in `src/services/`
