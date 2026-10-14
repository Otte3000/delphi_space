# DELPHI_space

Webseite mit [Astro](https://astro.build) und [Keystatic](https://keystatic.com) als CMS.

## Lokal starten

```bash
npm install
npm run dev
```

- Webseite: http://localhost:4321
- CMS: http://localhost:4321/keystatic (lokal speichert Keystatic direkt in `src/content/`)

## Sprachen

Deutsch ist die Hauptsprache (`/`), Englisch liegt unter `/en/`, Französisch unter `/fr/`.
Im CMS hat jeder Text Felder für alle drei Sprachen. Leere EN/FR-Felder zeigen den deutschen Text.

## Struktur

- `keystatic.config.ts` – welche Inhalte im CMS pflegbar sind
- `src/content/` – die Inhalte (Ausstellungen, Events, Reihen, Seiten)
- `src/lib/content.ts` – liest die Inhalte über den Keystatic-Reader ein
- `src/lib/i18n.ts` – Sprachen (DE, EN, FR), Übersetzungen der Oberflächentexte
- `src/pages/[...lang]/` – die Seiten der Webseite, für jede Sprache (`/`, `/en/`, `/fr/`)
- `public/images/` – Bilder, die über das CMS hochgeladen werden
