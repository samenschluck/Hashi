# Anfragen zu Datenschutzrechten beantworten

Was zu tun ist, wenn jemand Auskunft (Art. 15 DSGVO) oder Löschung (Art. 17 DSGVO)
verlangt. Vorlagen zum Kopieren, deutsch und englisch.

> Keine Rechtsberatung. Die Vorlagen beschreiben, was die App tatsächlich tut —
> geprüft am Quelltext, nicht geschätzt. Wer sie ändert, sollte vorher in
> `src/services/` nachsehen, ob die Aussage noch stimmt.

## Die Ausgangslage

Der Anbieter betreibt **keinen Server** und speichert **keine personenbezogenen
Daten**. Spielstand, Bestzeiten, Sterne und Einstellungen liegen ausschließlich im
Speicher des jeweiligen Geräts (`@capacitor/preferences`, siehe
`src/services/storage.ts`). Die einzigen Daten, die das Gerät verlassen, gehen an
Google als Werbeanbieter — nicht über den Anbieter dieser App.

Eine Löschung lässt sich deshalb nicht „ausführen". Zu tun ist trotzdem etwas:

## Die Pflicht: antworten, nicht löschen

**Innerhalb eines Monats antworten** — auch wenn die Antwort lautet, dass keine
Daten vorliegen (Art. 12 Abs. 3 DSGVO). Nicht zu antworten ist der Fehler, der
Ärger macht; die fehlende Löschung ist keiner, wenn es nichts zu löschen gibt.

**Keine Ausweiskopie verlangen.** Eine Identitätsprüfung ergibt hier keinen Sinn:
Es gibt keinen Datensatz, den man einer Person zuordnen könnte.

**Antwort mit Datum aufbewahren.** Eine abgelegte E-Mail genügt als Nachweis, dass
fristgerecht reagiert wurde.

## Vorlage — deutsch

```
Betreff: Ihre Anfrage zum Datenschutz — Bridgelet

Guten Tag,

vielen Dank für Ihre Nachricht.

Zu Bridgelet werden von mir als Anbieter keine personenbezogenen Daten erhoben
oder gespeichert. Die App kommt ohne Konto, ohne Anmeldung und ohne Server aus.
Ihr Spielfortschritt, Ihre Bestzeiten und Ihre Einstellungen liegen ausschließlich
auf Ihrem Gerät. Ich habe darauf keinen Zugriff, und es liegen mir folglich auch
keine Daten zu Ihrer Person vor, die ich auskunftsweise mitteilen oder löschen
könnte.

Sie können die auf Ihrem Gerät gespeicherten Daten jederzeit selbst vollständig
entfernen:

- in der App unter „Einstellungen → Fortschritt löschen", oder
- indem Sie die App deinstallieren.

Die App zeigt Werbung von Google AdMob. Die dabei verarbeiteten Daten
(Werbe-ID, IP-Adresse, Anzeigeninteraktionen) verarbeitet Google Ireland Limited
in eigener Verantwortung. Ihre Einwilligung dazu können Sie in der App unter
„Einstellungen → Datenschutzeinstellungen" jederzeit ändern oder widerrufen.
Für Auskunft oder Löschung dieser Daten wenden Sie sich bitte an Google:
https://policies.google.com/privacy

Mit freundlichen Grüßen
Florian Fladnitzer
```

## Vorlage — englisch

```
Subject: Your privacy request — Bridgelet

Hello,

thank you for your message.

As the provider of Bridgelet I do not collect or store any personal data. The app
works without an account, without a sign-in and without a server. Your progress,
best times and settings are stored on your device only. I have no access to them,
and therefore hold no data about you that I could disclose or erase.

You can remove the data stored on your device yourself at any time:

- in the app under "Settings → Delete progress", or
- by uninstalling the app.

The app shows advertising from Google AdMob. The data processed for that purpose
(advertising ID, IP address, ad interactions) is processed by Google Ireland
Limited under its own responsibility. You can change or withdraw your consent at
any time in the app under "Settings → Privacy settings". For access to or erasure
of that data, please contact Google:
https://policies.google.com/privacy

Kind regards
Florian Fladnitzer
```

## Wenn sich die App ändert

Diese Vorlagen stimmen nur, solange die App keine Daten an einen eigenen Server
schickt. Kommt später ein Konto, eine Bestenliste, Crash-Reporting oder ein
Analysewerkzeug dazu, sind sie hinfällig — dann müssen auch
`docs/datenschutz.html`, `docs/privacy.html` und das Data-Safety-Formular in der
Play Console nachgezogen werden.
