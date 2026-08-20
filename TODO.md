# Offene Punkte bis zur Veröffentlichung

Diese Liste sammelt alles, was **vor** der Veröffentlichung im Play Store erledigt sein
muss und nicht im Code steckt. Der Code selbst ist fertig — Stand siehe `PROGRESS.md`.

---

## 🔴 Blockiert die Veröffentlichung

### 1. Name und ladungsfähige Anschrift in die Datenschutzerklärung

**Wo:** `docs/datenschutz.html` und `docs/privacy.html`, jeweils der rot markierte Absatz
oben (`class="todo"`).

**Warum das nicht optional ist:** Die Nennung des Verantwortlichen mit erreichbarer
Anschrift ist datenschutzrechtlich vorgeschrieben. Eine Datenschutzerklärung ohne sie ist
unvollständig — das gilt auch für eine Hobby-App.

**Aktueller Zwischenstand:** Kontakt-E-Mail (`austricraft@gmail.com`) und Datum stehen
drin, die Seite ist damit als Entwurf online und für AdMob nutzbar. Der rote Hinweis sagt
offen, dass die Anschrift nachgereicht wird.

**Offene Entscheidung:** Privatadresse oder Postfach / Ladungsfähige-Adresse-Dienst.

**Nicht vergessen:** Beim Nachtragen auch das Datum unter „Stand" aktualisieren.

### 2. Echte AdMob-IDs und veröffentlichte DSGVO-Nachricht

- App-ID, Banner-Unit-ID, Rewarded-Unit-ID aus der AdMob-Konsole
- Die EU-Einwilligungsnachricht muss **veröffentlicht** sein, nicht nur angelegt —
  sonst liefert `showConsentForm()` nichts zurück
- IDs als GitHub-Secrets hinterlegen (siehe `README.md`)

**Die echten IDs gehören nicht ins Repository.** Es ist öffentlich, und veröffentlichte
Werbe-IDs laden dazu ein, sie in fremden Apps für ungültigen Traffic zu missbrauchen —
gesperrt würde dann das eigene AdMob-Konto. Sie gehören ausschließlich in die lokale
`.env` (gitignored) und in die GitHub-Secrets.

### 3. Release-Keystore

- Erzeugen und **sicher aufbewahren** — ohne ihn ist kein Update der App mehr möglich
- Als Base64-Secret in GitHub hinterlegen

### 4. Test auf einem echten Gerät

Was in der Entwicklungsumgebung nicht prüfbar war:

- 60 fps auf Mid-Range-Hardware, Touch-Gefühl
- Einwilligungsdialog erscheint tatsächlich
- Banner überlagert nichts, belohntes Video schreibt Tipps gut
- Fortschritt überlebt ein Force-Close

### 5. Play-Console-Formulare

- Datenschutz-URL eintragen (`https://samenschluck.github.io/Hashi/datenschutz.html`)
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

---

## ⚪ Optional, später

- `app-ads.txt` in der Play-Console-Website hinterlegen (verbessert die AdMob-Erlöse)
- Kauf „Werbung entfernen" — das Kennzeichen `adsRemoved` ist im Code bereits vorgesehen
  und wird vom Banner respektiert, der Kauf selbst ist nicht implementiert
- iOS — die Architektur ist darauf vorbereitet, alle nativen Zugriffe laufen über
  Service-Wrapper in `src/services/`
