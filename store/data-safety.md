# Data-Safety-Formular (Play Console)

Ausgefüllte Antworten für den Abschnitt **Play Console → App-Inhalte →
Datensicherheit**. Die Angaben beschreiben genau das, was die App tut; sie sind
aus dem Quellcode abgeleitet, nicht geschätzt.

> **Verantwortung:** Die Richtigkeit der Angaben bestätigt der Betreiber
> gegenüber Google. Bitte vor dem Absenden gegenlesen — insbesondere, wenn später
> weitere SDKs dazukommen.

## Erhebt oder teilt Ihre App eine der geforderten Datenarten?

**Ja** — durch das eingebundene Google-Mobile-Ads-SDK (AdMob).

Der Anbieter selbst betreibt keinen Server und erhält keine Daten.

---

## Standort

| Frage                        | Antwort                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| Ungefährer Standort erhoben? | **Ja**                                                             |
| Geteilt?                     | **Ja** — mit Google als Werbeanbieter                              |
| Verarbeitung                 | Nicht dauerhaft gespeichert (durch die App)                        |
| Zweck                        | Werbung oder Marketing                                             |
| Pflichtangabe für Nutzer?    | **Nein** — Nutzer können die Einwilligung verweigern               |
| Hinweis                      | Wird von AdMob aus der IP-Adresse abgeleitet, meist auf Stadtebene |

Genauer Standort: **nein**. Die App fordert keine Standortberechtigung an.

## App-Aktivität

| Frage                      | Antwort                                              |
| -------------------------- | ---------------------------------------------------- |
| App-Interaktionen erhoben? | **Ja** (Anzeigen-Einblendungen, Klicks)              |
| Geteilt?                   | **Ja** — mit Google                                  |
| Zweck                      | Werbung oder Marketing, Analyse der Anzeigenleistung |
| Pflichtangabe?             | **Nein**                                             |

Suchverlauf, installierte Apps, andere Nutzeraktionen: **nein**.

## Geräte- oder andere IDs

| Frage               | Antwort                                   |
| ------------------- | ----------------------------------------- |
| Geräte-IDs erhoben? | **Ja** — Werbe-ID (Advertising ID)        |
| Geteilt?            | **Ja** — mit Google                       |
| Zweck               | Werbung oder Marketing, Betrugsvermeidung |
| Pflichtangabe?      | **Nein**                                  |

---

## Datenarten, die die App **nicht** erhebt

Alle übrigen Kategorien werden mit **Nein** beantwortet:

- Personenbezogene Daten (Name, E-Mail, Adresse, Telefonnummer, Ausweisdaten)
- Finanzdaten
- Gesundheits- und Fitnessdaten
- Nachrichten (SMS, E-Mails, In-App-Nachrichten)
- Fotos, Videos, Audio
- Dateien und Dokumente
- Kalender
- Kontakte
- Web-Browserverlauf
- App-Leistungsdaten (kein Crash-Reporting, keine Diagnose-SDKs)

**Spielfortschritt, Bestzeiten und Einstellungen** bleiben ausschließlich auf dem
Gerät. Google zählt lokal gespeicherte Daten, die das Gerät nicht verlassen,
ausdrücklich **nicht** als „erhoben" — sie sind hier deshalb nicht aufzuführen.

---

## Sicherheitspraktiken

| Frage                                                          | Antwort                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Werden Daten bei der Übertragung verschlüsselt?                | **Ja** — die Anzeigenanfragen laufen über HTTPS                            |
| Können Nutzer die Löschung ihrer Daten beantragen?             | **Ja** — über den Widerruf der Einwilligung und Googles Datenschutzkontakt |
| Wurde die App nach einem globalen Sicherheitsstandard geprüft? | **Nein**                                                                   |

## Familienrichtlinie

Zielgruppe: **nicht vorrangig Kinder**. In der App entsprechend gesetzt:
`tagForChildDirectedTreatment = false`, `tagForUnderAgeOfConsent = false`
(siehe `src/services/ads.ts`).

## Verweis

Die Datenschutzerklärung muss unter einer öffentlich erreichbaren URL liegen und in
der Play Console eingetragen werden. Entwürfe: `store/privacy-policy-de.md` und
`store/privacy-policy-en.md`.
