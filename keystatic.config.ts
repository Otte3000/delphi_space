import { config, fields, collection, singleton } from '@keystatic/core';

const orte = [
  { label: 'DELPHI_space – Brombergstraße 17c', value: 'bromberghof' },
  { label: 'DELPHI_space/emmendinger – Emmendinger Str. 21', value: 'emmendinger' },
  { label: 'DELPHI_space/gvbk – Bismarckallee 18–20', value: 'gvbk' },
  { label: 'DELPHI_space/außenstelle – Unterlinden 10', value: 'aussenstelle' },
  { label: 'Anderer Ort', value: 'andere' },
] as const;

// ── Mehrsprachigkeit ──────────────────────────────────────────
// Deutsch ist die Hauptsprache. Leere EN/FR-Felder zeigen auf der Seite den deutschen Text.

/** Kurzer Text in DE, EN und FR, im CMS als eine Gruppe mit drei Feldern. */
const translatedText = (label: string, opts: { multiline?: boolean; description?: string } = {}) =>
  fields.object(
    {
      de: fields.text({ label: 'Deutsch', multiline: opts.multiline }),
      en: fields.text({ label: 'English', multiline: opts.multiline }),
      fr: fields.text({ label: 'Français', multiline: opts.multiline }),
    },
    { label, description: opts.description }
  );

/** Übersetzungen eines Titels, dessen deutsche Fassung das Slug-Feld ist. */
const titleTranslations = () =>
  fields.object(
    {
      en: fields.text({ label: 'English' }),
      fr: fields.text({ label: 'Français' }),
    },
    { label: 'Titel – Übersetzungen', description: 'Leer lassen, wenn der Titel in allen Sprachen gleich ist.' }
  );

/** Fließtext in DE, EN und FR – Keystatic legt jede Sprache als eigene .mdoc-Datei ab. */
const translatedContent = (imageDir?: string) => {
  const options = imageDir ? { image: { directory: `public/images/${imageDir}`, publicPath: `/images/${imageDir}/` } } : {};
  return {
    content: fields.markdoc({ label: 'Text – Deutsch', options }),
    contentEn: fields.markdoc({ label: 'Text – English', options }),
    contentFr: fields.markdoc({ label: 'Text – Français', options }),
  };
};

// Einfache Textseite unter /<name>, z. B. /about oder /impressum.
const textPage = (label: string, name: string) =>
  singleton({
    label,
    path: `src/content/pages/${name}/`,
    format: { data: 'yaml' },
    schema: {
      title: translatedText('Titel'),
      ...translatedContent(),
    },
  });

export default config({
  // Lokal bearbeitet Keystatic die Dateien direkt, auf der Live-Seite speichert es per GitHub.
  // `npm run dev:github` nutzt GitHub auch lokal – nötig für die einmalige Einrichtung der GitHub-App.
  storage:
    import.meta.env.PROD || import.meta.env.PUBLIC_KEYSTATIC_GITHUB === 'true'
      ? { kind: 'github', repo: 'Otte3000/delphi_space' }
      : { kind: 'local' },

  ui: {
    brand: { name: 'DELPHI_space' },
    navigation: {
      Programm: ['exhibitions', 'events', 'series'],
      Seiten: ['homepage', 'about', 'impressum', 'datenschutz'],
      Einstellungen: ['settings'],
    },
  },

  collections: {
    exhibitions: collection({
      label: 'Ausstellungen',
      slugField: 'title',
      path: 'src/content/exhibitions/*/',
      format: { data: 'yaml' },
      columns: ['title', 'startDate'],
      schema: {
        title: fields.slug({ name: { label: 'Titel (Deutsch)' } }),
        titleI18n: titleTranslations(),
        subtitle: translatedText('Untertitel'),
        artists: fields.text({ label: 'Künstler*innen', description: 'z. B. „Olga Hohmann & Lukas Kesler“' }),
        startDate: fields.date({ label: 'Beginn', validation: { isRequired: true } }),
        endDate: fields.date({ label: 'Ende' }),
        openingHours: translatedText('Öffnungszeiten', { description: 'z. B. „Sa 17:00–22:00“' }),
        location: fields.select({ label: 'Ort', options: [...orte], defaultValue: 'bromberghof' }),
        heroImage: fields.image({
          label: 'Titelbild',
          directory: 'public/images/exhibitions',
          publicPath: '/images/exhibitions/',
        }),
        gallery: fields.array(
          fields.object({
            image: fields.image({
              label: 'Bild',
              directory: 'public/images/exhibitions',
              publicPath: '/images/exhibitions/',
            }),
            caption: fields.text({ label: 'Bildunterschrift' }),
          }),
          { label: 'Galerie', itemLabel: (p) => p.fields.caption.value || 'Bild' }
        ),
        ...translatedContent('exhibitions'),
      },
    }),

    events: collection({
      label: 'Events',
      slugField: 'title',
      path: 'src/content/events/*/',
      format: { data: 'yaml' },
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Titel (Deutsch)' } }),
        titleI18n: titleTranslations(),
        type: fields.select({
          label: 'Art',
          options: [
            { label: 'Vernissage', value: 'vernissage' },
            { label: 'Artist Talk', value: 'talk' },
            { label: 'Workshop', value: 'workshop' },
            { label: 'Performance', value: 'performance' },
            { label: 'Konzert', value: 'concert' },
            { label: 'Lesung', value: 'reading' },
            { label: 'Auktion', value: 'auction' },
            { label: 'Sonstiges', value: 'other' },
          ],
          defaultValue: 'vernissage',
        }),
        date: fields.date({ label: 'Datum', validation: { isRequired: true } }),
        time: fields.text({ label: 'Uhrzeit', description: 'z. B. „19:00–22:00“' }),
        location: fields.select({ label: 'Ort', options: [...orte], defaultValue: 'bromberghof' }),
        exhibition: fields.relationship({
          label: 'Gehört zur Ausstellung',
          collection: 'exhibitions',
        }),
        image: fields.image({
          label: 'Bild',
          directory: 'public/images/events',
          publicPath: '/images/events/',
        }),
        ...translatedContent('events'),
      },
    }),

    series: collection({
      label: 'Veranstaltungsreihen',
      slugField: 'title',
      path: 'src/content/series/*',
      format: { data: 'yaml' },
      columns: ['title'],
      schema: {
        title: fields.slug({ name: { label: 'Name' } }),
        schedule: translatedText('Wann', { description: 'z. B. „Jeden Mittwoch ab 19 Uhr“' }),
        description: translatedText('Beschreibung', { multiline: true }),
        link: fields.url({ label: 'Link (optional)' }),
        image: fields.image({
          label: 'Bild',
          directory: 'public/images/series',
          publicPath: '/images/series/',
        }),
        order: fields.integer({ label: 'Reihenfolge', defaultValue: 0 }),
      },
    }),
  },

  singletons: {
    homepage: singleton({
      label: 'Startseite',
      path: 'src/content/pages/homepage',
      format: { data: 'yaml' },
      schema: {
        intro: translatedText('Intro', { multiline: true }),
        heroImages: fields.array(
          fields.image({
            label: 'Bild',
            directory: 'public/images/home',
            publicPath: '/images/home/',
          }),
          { label: 'Bilder oben (Slider)' }
        ),
      },
    }),

    about: textPage('Über uns', 'about'),
    impressum: textPage('Impressum', 'impressum'),
    datenschutz: textPage('Datenschutz', 'datenschutz'),

    settings: singleton({
      label: 'Allgemein',
      path: 'src/content/pages/settings',
      format: { data: 'yaml' },
      schema: {
        address: fields.text({ label: 'Adresse', multiline: true }),
        email: fields.text({ label: 'E-Mail' }),
        instagram: fields.url({ label: 'Instagram-Link' }),
        newsletter: fields.url({ label: 'Newsletter-Link' }),
        sponsors: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            logo: fields.image({
              label: 'Logo',
              directory: 'public/images/sponsors',
              publicPath: '/images/sponsors/',
            }),
            url: fields.url({ label: 'Website' }),
          }),
          { label: 'Förderer', itemLabel: (p) => p.fields.name.value || 'Förderer' }
        ),
      },
    }),
  },
});
