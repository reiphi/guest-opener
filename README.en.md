# Guest Opener

Deutsch: [README](README.md) · [Anleitung](guest_opener/DOCS.md)

Time-limited access for guests, as a [Home Assistant add-on](https://www.home-assistant.io/docs/apps/).
Each person gets a link and a PIN and uses them, on site, to open the front door and the apartment
door from their phone. After checkout the access stops working.

The doors are any Home Assistant entities. The property name, coordinates, phone number and public
address live only in the add-on configuration, not in this repository.

<img src="docs/screenshots/gaesteseite.png" alt="Guest page with buttons for the front door, the apartment door and locking" width="420">

<img src="docs/screenshots/verwaltung.png" alt="Admin page with devices, a new stay and the guest list" width="800">

The pictures show sample data from a local test setup.

## Features

- Link and six-digit PIN, valid only between arrival and departure
- Two doors, each of which can be hidden, with its own name and mode (open, unlock, lock)
- Location check with a configurable radius, or turn it off
- German and English, fixed dark design
- Admin for stays, permanent admin users, battery warnings and an access log
- Push messages through a Home Assistant `notify.*` service
- SQLite inside the add-on, included in Home Assistant backups

## Installation

Home Assistant with the Supervisor (Home Assistant OS or Supervised):

1. Settings → Add-ons → Add-on store → ⋮ → **Repositories**
2. Add `https://github.com/reiphi/guest-opener`
3. Install **Guest Opener**, configure it and start it

Setup, every option, exposing the add-on and the limits of the location check are in
[`guest_opener/DOCS.en.md`](guest_opener/DOCS.en.md). Home Assistant shows the German file in the
Documentation tab. The short store text is [`guest_opener/README.md`](guest_opener/README.md).

## Security

What actually protects a guest is the link plus the PIN, and only inside the stay. The location
check stops accidents. It does not stop someone who has the link and the PIN and sends their own
coordinates. Details are in [`guest_opener/DOCS.en.md`](guest_opener/DOCS.en.md#security).

## Development

TypeScript, [Hono](https://hono.dev), SQLite through Node 24's built-in `node:sqlite`.
The add-on follows the [Home Assistant add-on repository layout](https://contributors.home-assistant.io/apps/reference/files/):
`repository.yaml` at the root, the add-on in `guest_opener/` with `config.yaml`, `Dockerfile`,
`README.md`, `DOCS.md` and `CHANGELOG.md`.

```
guest_opener/
  config.yaml         options, architecture, access to the Home Assistant API
  Dockerfile          bundles the server and packs it into node:24-alpine
  README.md           short text for the add-on store
  DOCS.md             documentation tab, in German
  DOCS.en.md          the same guide in English
  CHANGELOG.md        changes per version
  translations/       option labels, German and English
  src/                server, routes, doors, SQLite, pages
  test/               tests with node:test
```

Node 24:

```powershell
cd guest_opener
npm install
copy .env.example .env
npm run dev
npm test
npm run typecheck
```

`npm run dev` simulates both doors (`mock`) and turns the location check off. The admin password
is in `.env`. Real devices need `HA_URL`, `HA_TOKEN` and the entity ids.

The image uses `node:24-alpine` directly. It does not rely on `BUILD_FROM`, which Home Assistant
used to inject automatically.

When a change should show up as an update in Home Assistant, raise the version in
`guest_opener/config.yaml` and `guest_opener/package.json`, and add an entry to `CHANGELOG.md`.

## License

[MIT](LICENSE)
