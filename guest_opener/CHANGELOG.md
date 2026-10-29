# Changelog

## 1.2.3

- Dokumentation an den Aufbau eines Home-Assistant-Add-on-Repositories angepasst
  (`README.md`, `DOCS.md`, `CHANGELOG.md` im Add-on-Ordner).
- Keine Änderung am Verhalten.

## 1.2.2

- Der voreingestellte Name der Unterkunft ist ein Platzhalter.

## 1.2.1

- Erreichbarkeit über einen Reverse Proxy statt über einen Cloudflare-Tunnel.
- Die Login-Sperre verwendet `X-Real-IP`. Ein mitgeschicktes `CF-Connecting-IP` wird ignoriert.

## 1.2.0

- Option `door_apartment_unlock_only`: Wohnungstür nur aufsperren, statt die Falle zu ziehen.
- Gästenachricht ohne Stockwerksangabe.

## 1.1.0

- Festes dunkles Design.
- Sperre gegen das Durchprobieren des Admin-Passworts.
- Push-Benachrichtigungen über einen Home-Assistant-Dienst `notify.*`.
- Strikte Content-Security-Policy. Styles und Skripte kommen aus eigenen Dateien.

## 1.0.0

- Erstes Add-on: Gästelinks mit PIN, Standortprüfung, Haus- und Wohnungstür, Admin-Nutzer,
  Batteriewarnung, SQLite.
