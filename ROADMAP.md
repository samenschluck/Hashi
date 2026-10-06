# ROADMAP — Bridgelet

Hier stehen beschlossene Ideen für kommende Updates, **bevor** sie umgesetzt werden.
Was hier steht, ist abgestimmt, aber noch nicht gebaut. Stand der Umsetzung: `PROGRESS.md`.

**Arbeitsweise (vom Betreiber festgelegt):** Neue Versionen werden erst gebaut, wenn der
Betreiber die Änderungen gesehen und freigegeben hat. Vorher: Screenshots oder
Beschreibung zeigen, nachfragen, dann bauen.

---

## Update 2 — „das große Update"

Arbeitstitel. Zwei Teile, **in dieser Reihenfolge**:

1. **Technik:** Bibliotheken aktualisieren
2. **Inhalt:** Skin-System mit Freischaltungen, Werbevideo-Skins und Kauf
   „Werbung entfernen"

Die Reihenfolge ist Absicht: Ein Bibliotheks-Update kann Kleinigkeiten verschieben. Das
soll getrennt vom neuen Feature sichtbar und prüfbar sein.

---

### Teil 1 — Bibliotheken aktualisieren

Ziel: aktuelle Fassungen von Capacitor, AdMob-Plugin, React, Vite und den übrigen
Abhängigkeiten.

Erhofft und zu prüfen:

- Die beiden Hinweise der Play Console zur randlosen Anzeige verschwinden
  (`LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`). Die Einstellung stammt nicht aus
  unserem Code, sondern aus einer kompilierten Bibliothek — vermutlich AndroidX über
  Capacitor. Erst ein Update dort behebt sie.
- GitHub Actions auf Fassungen heben, die nicht mehr auf Node 20 zielen
  (`checkout`, `setup-node`, `setup-java`, `upload-artifact`, `setup-android`).

Nach dem Update vollständig prüfen: Einwilligungsdialog, Banner (auch nach Neustart),
belohntes Video, Spielstand bleibt erhalten, Darstellung an Kamera-Aussparung und
Statusleiste.

---

### Teil 2 — Skins

#### Grundidee

Sterne sammeln schaltet Skins frei. Bisher haben Sterne keinen Zweck außer der Anzeige
— mit Skins bekommen sie einen. Freigeschaltete Skins wählt man in einem eigenen
**Skin-Menü** aus.

**Anzahl:** viele, als „fette Update-Bombe". Die genaue Zahl wird erst bei der Umsetzung
festgelegt.

#### Kategorien

| Kategorie                   | Beispiele                                                 | Aufwand pro Skin                               |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| **Inseln / Knotenpunkte**   | Kreis, Sechseck, Stein, Leuchtturm, Edelstein             | mittel — jede Form braucht eigenen Zeichencode |
| **Brücken**                 | Linie, Holzplanken, Seil, Lichtstrahl, Kette              | mittel                                         |
| **Mauern**                  | Block, Felsen, Ziegel, Hecke                              | klein bis mittel                               |
| **Hintergrund / Spielfeld** | einfarbig, Verlauf, Raster, Wasserwellen, Sterne          | klein bis mittel                               |
| **Schriftart**              | rund, kantig, handschriftlich, Pixel                      | klein                                          |
| **Komplett-Paket**          | „Winter", „Retro", „Japan" — alles aufeinander abgestimmt | Summe der Teile                                |

- **Mischen erlaubt:** Inseln aus einem Skin, Brücken aus einem anderen. Pakete setzen
  alle Kategorien auf einmal.
- **Schriftarten** müssen fest in die App, weil sie offline läuft — je etwa 20–100 KB.
  Nur frei lizenzierte Schriften (z. B. OFL-Schriften von Google Fonts). Prüfstein sind
  die **Ziffern**: Auf den Inseln stehen nur Zahlen, die auch klein lesbar bleiben müssen.

#### Feste Regel: Lesbarkeit geht vor

Kein Skin darf das Spiel schwerer lesbar machen. In **jedem** Skin müssen klar
erkennbar bleiben:

- „fertig" und „zu viele Brücken"
- der Tipp-Hinweis
- die „?"-Inseln
- der Farbenblind-Modus (Häkchen, gestrichelter Rand) muss mit jedem Skin funktionieren

Ein Skin ändert das Aussehen, nie die Bedeutung. Am besten pro Skin automatisch geprüft,
z. B. über Kontrastwerte.

#### Freischaltung über Sterne

- **Es zählen nur Sterne aus der Kampagne.** Endlos-Modus und Tagesrätsel speichern
  zwar ebenfalls Sterne, zählen aber **nicht** mit. Begründung: Der Endlos-Modus liefert
  unbegrenzt viele Rätsel, das System wäre sonst an einem Nachmittag durchgespielt.
- Obergrenze je Schwierigkeitsgrad: 150 Level × 3 Sterne = **450 Sterne**, insgesamt
  **1.800**.
- Sterne sinken nie (gespeichert wird der Bestwert). Freigeschaltetes geht also nie
  verloren.
- **Bestehende Spieler:** Ihre bisherigen Sterne zählen sofort. Wer schon viel gespielt
  hat, bekommt beim Update gleich ein paar Skins.

Arten von Bedingungen, als Ideenpool:

- **Sterne pro Stufe:** z. B. 50 / 100 / 200 / 300 / 450 in Einfach, Mittel, Schwer,
  Experte
- **Sterne in allen Stufen:** z. B. je 50 in jeder Stufe
- **Sterne gesamt:** z. B. 250 / 500 / 1.000 / 1.800
- **Perfekte Level:** z. B. 25 Level mit drei Sternen in Experte
- **Stufe abgeschlossen:** alle 150 Level einer Stufe gelöst
- **Ohne Hilfe:** z. B. 20 Rätsel am Stück ohne Tipp
- **Geschwindigkeit:** z. B. ein schweres Rätsel unter 3 Minuten

#### Freischaltung über Tagesrätsel

Sterne aus Tagesrätseln zählen nicht (siehe oben). Stattdessen gibt es **eigene Skins mit
Bedingungen rund um die Tagesrätsel**, z. B.:

- 3 Tagesrätsel in Folge, dann 7, 14, 30, 100 …
- (denkbar) eine Gesamtzahl gelöster Tagesrätsel

#### Werbevideo-Skins für 24 Stunden

- **Täglich** wird je Kategorie **ein zufälliger, noch nicht freigeschalteter Skin**
  angeboten — **in allen Kategorien, die es gibt**: Knotenpunkte, Brücken, Mauern,
  Hintergrund, Schriftart. Kommt später eine Kategorie hinzu, ist sie automatisch dabei.
- **Pro Kategorie ein Werbevideo.** Wer es ansieht, kann diesen Skin **24 Stunden**
  benutzen.
- Danach fällt er automatisch auf die vorherige Auswahl zurück.
- **Eigenes Limit, getrennt von den Tipp-Videos.** Die Skin-Videos sind schon von sich
  aus begrenzt: ein Video pro Kategorie und Tag. Sie zählen deshalb **nicht** zum
  Tageslimit der Tipp-Videos (siehe unten) — sonst würde wer Skins ausprobiert, keine
  Tipps mehr nachladen können.

Umsetzungshinweise:

- Die tägliche Auswahl offline und für jeden Tag fest bestimmen (Zufall mit dem Datum als
  Startwert, wie beim Tagesrätsel). So lässt sie sich nicht durch Neustarten neu würfeln.
- Die vorhandene Absicherung gegen Zurückstellen der Uhr (`effectiveNow`) auch für die
  24 Stunden nutzen.

#### Kauf „Werbung entfernen"

- Entfernt **die gesamte Werbung.**
- Die **24-Stunden-Skins gibt es dann ohne Video**, ein Tipp genügt.
- **Tipps: alles wie vorher, nur ohne Video.** „Tipps aufladen" schreibt die Tipps
  sofort gut. Menge und Tageslimit bleiben gleich (heute: 3 Tipps pro Aufladen,
  höchstens 5-mal am Tag, `ADS.maxRewardedPerDay`). Auch die 2 Gratis-Tipps pro Tag
  bleiben unverändert.
- Im Code ist das Kennzeichen `adsRemoved` schon vorbereitet und wird vom Banner
  beachtet. Es fehlt der eigentliche Kauf.

Was der Kauf zusätzlich verlangt:

- **Google Play Billing** als neue Abhängigkeit
- **Händlerkonto** in der Play Console (Steuer- und Bankdaten des Betreibers)
- **Kauf wiederherstellen** nach Neuinstallation oder auf einem neuen Gerät
- **Datensicherheit** in der Play Console und **Datenschutzerklärung** anpassen
  (Käufe kommen hinzu)

#### Skin-Menü und Spielgefühl

- Kategorien als Reiter: Inseln, Brücken, Mauern, Hintergrund, Schrift, Pakete
- Gesperrte Skins mit Schloss, Bedingung und Fortschrittsbalken,
  z. B. „73 / 100 Sterne in Mittel"
- **Live-Vorschau** auf einem kleinen Beispielfeld vor der Auswahl
- **Freischalt-Moment** auf dem Ergebnisbildschirm: „Neuer Skin freigeschaltet:
  Holzbrücken" mit Knopf „Jetzt ausprobieren"
- Bereich „Heute zum Ausprobieren" mit den vier täglichen Video-Skins

#### Technische Leitplanken

- **Bedingungen als Tabelle in der Konfiguration**, nicht als Einzelfälle im Code. Ein
  neuer Skin samt Bedingung kostet später eine Zeile.
- **Freischaltungen werden aus den Sternen berechnet, nicht gespeichert.** Gespeichert
  werden nur die Auswahl je Kategorie und die laufenden 24-Stunden-Skins. Alte
  Spielstände funktionieren unverändert, niemand verliert Fortschritt.
- Neue Felder im Spielstand nach dem bewährten Muster: fehlt ein Feld, gilt der
  Standardwert.

#### Noch offen — bei der Umsetzung klären

- Genaue Anzahl der Skins und konkrete Themen
- Preis des Kaufs
- Gilt der Kauf auch für bereits gekaufte Geräte desselben Google-Kontos? (Standard bei
  Play Billing: ja, über „Kauf wiederherstellen".)

---

## Später, noch nicht eingeplant

Aus dem Feedback der Tester und dem Brainstorming, für eines der nächsten Updates:

- Geführte erste Runde für neue Spieler
- Googles Bewertungs-Dialog nach einem gelungenen Rätsel
- Erfolge, Wochen-Herausforderung, Zeit-Modus
- Erinnerung an die Tagesserie per Benachrichtigung
- Animation beim Lösen
