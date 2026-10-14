# DELPHI_space

Webseite mit [Astro](https://astro.build) und [Keystatic](https://keystatic.com) als CMS.

## Lokal starten

```bash
npm install
npm run dev
```

- Webseite: http://localhost:4321
- CMS: http://localhost:4321/keystatic (lokal speichert Keystatic direkt in `src/content/`)

## Struktur

- `keystatic.config.ts` – welche Inhalte im CMS pflegbar sind
- `src/content/` – die Inhalte (Ausstellungen, Events, Reihen, Seiten)
- `src/content.config.ts` – wie Astro diese Inhalte einliest
- `src/pages/` – die Seiten der Webseite
- `public/images/` – Bilder, die über das CMS hochgeladen werden
