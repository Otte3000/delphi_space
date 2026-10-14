import { config, fields, collection, singleton } from '@keystatic/core';

const orte = [
  { label: 'DELPHI_space – Brombergstraße 17c', value: 'bromberghof' },
  { label: 'DELPHI_space/emmendinger – Emmendinger Str. 21', value: 'emmendinger' },
  { label: 'DELPHI_space/gvbk – Bismarckallee 18–20', value: 'gvbk' },
  { label: 'DELPHI_space/außenstelle – Unterlinden 10', value: 'aussenstelle' },
  { label: 'Anderer Ort', value: 'andere' },
] as const;

// Einfache Textseite unter /<name>, z. B. /about oder /impressum.
const textPage = (label: string, name: string) =>
  singleton({
    label,
    path: `src/content/pages/${name}`,
    format: { contentField: 'content' },
    entryLayout: 'content',
    schema: {
      title: fields.text({ label: 'Titel', defaultValue: label }),
      content: fields.markdoc({ label: 'Text' }),
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
      path: 'src/content/exhibitions/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'startDate'],
      schema: {
        title: fields.slug({ name: { label: 'Titel' } }),
        subtitle: fields.text({ label: 'Untertitel' }),
        artists: fields.text({ label: 'Künstler*innen', description: 'z. B. „Olga Hohmann & Lukas Kesler“' }),
        startDate: fields.date({ label: 'Beginn', validation: { isRequired: true } }),
        endDate: fields.date({ label: 'Ende' }),
        openingHours: fields.text({ label: 'Öffnungszeiten', description: 'z. B. „Sa 17:00–22:00“' }),
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
        content: fields.markdoc({
          label: 'Text',
          options: {
            image: { directory: 'public/images/exhibitions', publicPath: '/images/exhibitions/' },
          },
        }),
      },
    }),

    events: collection({
      label: 'Events',
      slugField: 'title',
      path: 'src/content/events/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Titel' } }),
        type: fields.select({
          label: 'Art',
          options: [
            { label: 'Vernissage', value: 'Vernissage' },
            { label: 'Artist Talk', value: 'Artist Talk' },
            { label: 'Workshop', value: 'Workshop' },
            { label: 'Performance', value: 'Performance' },
            { label: 'Konzert', value: 'Konzert' },
            { label: 'Lesung', value: 'Lesung' },
            { label: 'Auktion', value: 'Auktion' },
            { label: 'Sonstiges', value: 'Sonstiges' },
          ],
          defaultValue: 'Vernissage',
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
        content: fields.markdoc({
          label: 'Text',
          options: {
            image: { directory: 'public/images/events', publicPath: '/images/events/' },
          },
        }),
      },
    }),

    series: collection({
      label: 'Veranstaltungsreihen',
      slugField: 'title',
      path: 'src/content/series/*',
      format: { data: 'yaml' },
      columns: ['title', 'schedule'],
      schema: {
        title: fields.slug({ name: { label: 'Name' } }),
        schedule: fields.text({ label: 'Wann', description: 'z. B. „Jeden Mittwoch ab 19 Uhr“' }),
        description: fields.text({ label: 'Beschreibung', multiline: true }),
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
        introDe: fields.text({ label: 'Intro (Deutsch)', multiline: true }),
        introEn: fields.text({ label: 'Intro (English)', multiline: true }),
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
