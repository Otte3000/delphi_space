import { config, fields, collection, singleton } from '@keystatic/core';

const orte = [
  { label: 'DELPHI_space – Brombergstraße 17c', value: 'bromberghof' },
  { label: 'DELPHI_space/emmendinger – Emmendinger Str. 21', value: 'emmendinger' },
  { label: 'DELPHI_space/gvbk – Bismarckallee 18–20', value: 'gvbk' },
  { label: 'DELPHI_space/außenstelle – Unterlinden 10', value: 'aussenstelle' },
  { label: 'DELPHI_space (frühere Räume)', value: 'delphi' },
  { label: 'Öffentlicher Raum', value: 'public' },
  { label: 'Basel', value: 'basel' },
  { label: 'Anderer Ort', value: 'andere' },
] as const;

// Event-Arten wie in der alten Webflow-Seite. Übersetzungen für die Webseite: src/lib/i18n.ts
const eventTypes = [
  { label: 'Opening / Vernissage', value: 'opening' },
  { label: 'Finissage', value: 'finissage' },
  { label: 'Midissage', value: 'midisage' },
  { label: 'Artist Talk', value: 'artist-talk' },
  { label: 'Talk', value: 'talk' },
  { label: 'Guided Tour', value: 'guided-tour' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Performance', value: 'performance' },
  { label: 'Dance Performance', value: 'dance-performance' },
  { label: 'Concert', value: 'concert' },
  { label: 'Rave', value: 'rave' },
  { label: 'Reading', value: 'reading' },
  { label: 'Film Screening', value: 'film-screening' },
  { label: 'Livestream', value: 'livestream' },
  { label: 'Curated Dinner', value: 'curated-dinner' },
  { label: 'Charity Event', value: 'charity-event' },
  { label: 'Exhibition', value: 'exhibition' },
  { label: 'Group Exhibition', value: 'group-exhibition' },
  { label: 'Public Space Exhibition', value: 'public-space-exhibition' },
  { label: 'Auktion', value: 'auction' },
  { label: 'Sonstiges', value: 'other' },
] as const;

// Sparten wie in der alten Webflow-Seite. Übersetzungen für die Webseite: src/lib/i18n.ts
const artistCategories = [
  { label: 'Bildende Künstler*innen', value: 'visual-artists' },
  { label: 'Performance-Künstler*innen', value: 'performance-artists' },
  { label: 'Tanzperformer*innen', value: 'dance-performers' },
  { label: 'Musiker*innen', value: 'musicians' },
  { label: 'DJs', value: 'djs' },
  { label: 'Filmschaffende', value: 'filmmakers' },
  { label: 'Fotograf*innen', value: 'photographers' },
  { label: 'Autor*innen', value: 'writers' },
  { label: 'Architekt*innen', value: 'architects' },
  { label: 'Kurator*innen', value: 'curators' },
  { label: 'Redner*innen', value: 'speakers' },
  { label: 'Kollektive', value: 'collectives' },
  { label: 'Food & Wine', value: 'food-wine' },
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

const image = (label: string, dir: string) =>
  fields.image({ label, directory: `public/images/${dir}`, publicPath: `/images/${dir}/` });

const gallery = (dir: string) =>
  fields.array(
    fields.object({
      image: image('Bild', dir),
      caption: fields.text({ label: 'Bildunterschrift' }),
    }),
    { label: 'Galerie', itemLabel: (p) => p.fields.caption.value || 'Bild' }
  );

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
      Menschen: ['artists', 'team', 'partners', 'funders'],
      Seiten: ['homepage', 'about', 'membership', 'impressum', 'datenschutz'],
      Weiteres: ['press', 'memberships', 'settings'],
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
        kind: fields.select({
          label: 'Art',
          options: [
            { label: 'Ausstellung', value: 'exhibition' },
            { label: 'Gruppenausstellung', value: 'group-exhibition' },
            { label: 'Sammlung', value: 'collection' },
          ],
          defaultValue: 'exhibition',
        }),
        artistsText: fields.text({ label: 'Künstler*innen (Text)', description: 'Freitext, z. B. „Olga Hohmann & Lukas Kesler mit …“', multiline: true }),
        artists: fields.multiRelationship({ label: 'Künstler*innen (verknüpft)', collection: 'artists' }),
        startDate: fields.date({ label: 'Beginn', validation: { isRequired: true } }),
        endDate: fields.date({ label: 'Ende' }),
        openingHours: translatedText('Öffnungszeiten', { description: 'z. B. „Sa 17:00–22:00“' }),
        location: fields.select({ label: 'Ort', options: [...orte], defaultValue: 'bromberghof' }),
        heroImage: image('Vorschaubild', 'exhibitions'),
        poster: image('Poster', 'exhibitions'),
        gallery: gallery('exhibitions'),
        video: fields.url({ label: 'Video-Link' }),
        link: fields.url({ label: 'Externer Link' }),
        credits: fields.text({ label: 'Credits', description: 'z. B. „Fotos: … · Artwork: …“' }),
        funders: fields.multiRelationship({ label: 'Förderer', collection: 'funders' }),
        openingInfo: fields.markdoc({ label: 'Eröffnung / Opening-Info' }),
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
        subtitle: translatedText('Zusatzinfo'),
        type: fields.select({ label: 'Art', options: [...eventTypes], defaultValue: 'opening' }),
        date: fields.date({ label: 'Datum', validation: { isRequired: true } }),
        endDate: fields.date({ label: 'Ende (bei mehrtägigen Events)' }),
        time: fields.text({ label: 'Uhrzeit', description: 'z. B. „19:00–22:00“' }),
        location: fields.select({ label: 'Ort', options: [...orte], defaultValue: 'bromberghof' }),
        exhibition: fields.relationship({ label: 'Gehört zur Ausstellung', collection: 'exhibitions' }),
        series: fields.relationship({ label: 'Gehört zur Reihe', collection: 'series' }),
        artists: fields.multiRelationship({ label: 'Künstler*innen', collection: 'artists' }),
        image: image('Bild', 'events'),
        gallery: gallery('events'),
        link: fields.url({ label: 'Link' }),
        credits: fields.text({ label: 'Credits' }),
        ...translatedContent('events'),
      },
    }),

    series: collection({
      label: 'Veranstaltungsreihen',
      slugField: 'title',
      path: 'src/content/series/*/',
      format: { data: 'yaml' },
      columns: ['title'],
      schema: {
        title: fields.slug({ name: { label: 'Name' } }),
        schedule: translatedText('Wann', { description: 'z. B. „Jeden Mittwoch ab 19 Uhr“' }),
        description: translatedText('Kurzbeschreibung', { multiline: true }),
        link: fields.url({ label: 'Link (optional)' }),
        contact: fields.text({ label: 'Ansprechpartner*in' }),
        image: image('Bild', 'series'),
        gallery: gallery('series'),
        showOnHomepage: fields.checkbox({ label: 'Auf der Startseite zeigen', defaultValue: true }),
        order: fields.integer({ label: 'Reihenfolge', defaultValue: 0 }),
        ...translatedContent('series'),
      },
    }),

    artists: collection({
      label: 'Künstler*innen',
      slugField: 'name',
      path: 'src/content/artists/*/',
      format: { data: 'yaml' },
      columns: ['name'],
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        sortName: fields.text({ label: 'Nachname (für die Sortierung)' }),
        cities: fields.text({ label: 'Orte', description: 'z. B. „Berlin, Freiburg“' }),
        categories: fields.multiselect({ label: 'Sparten', options: [...artistCategories] }),
        link: fields.url({ label: 'Website' }),
        portrait: image('Bild', 'artists'),
        gallery: gallery('artists'),
        hidden: fields.checkbox({ label: 'Nicht in der Künstler*innen-Liste zeigen' }),
        ...translatedContent('artists'),
      },
    }),

    team: collection({
      label: 'Team',
      slugField: 'name',
      path: 'src/content/team/*',
      format: { data: 'yaml' },
      columns: ['name'],
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        role: translatedText('Rolle / Funktion'),
        bio: translatedText('Kurzbio', { multiline: true }),
        category: fields.select({
          label: 'Kategorie',
          options: [
            { label: 'Team', value: 'team' },
            { label: 'Fotograf*in', value: 'photographer' },
            { label: 'Designer*in', value: 'designer' },
            { label: 'Kurator*in', value: 'curator' },
          ],
          defaultValue: 'team',
        }),
        active: fields.checkbox({ label: 'Aktives Mitglied (auf „Über uns“ zeigen)', defaultValue: true }),
        photo: image('Foto', 'team'),
        email: fields.text({ label: 'E-Mail' }),
        phone: fields.text({ label: 'Telefon' }),
        link: fields.url({ label: 'Website' }),
        order: fields.integer({ label: 'Reihenfolge', defaultValue: 0 }),
      },
    }),

    partners: collection({
      label: 'Kooperationen',
      slugField: 'name',
      path: 'src/content/partners/*',
      format: { data: 'yaml' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        area: fields.text({ label: 'Bereich' }),
        link: fields.url({ label: 'Website' }),
      },
    }),

    funders: collection({
      label: 'Förderer',
      slugField: 'name',
      path: 'src/content/funders/*/',
      format: { data: 'yaml' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        category: fields.select({
          label: 'Kategorie',
          options: [
            { label: 'Öffentliche Förderung', value: 'public' },
            { label: 'Privat', value: 'private' },
            { label: 'Kollektive', value: 'collective' },
          ],
          defaultValue: 'public',
        }),
        logo: image('Logo', 'funders'),
        link: fields.url({ label: 'Website' }),
        showInFooter: fields.checkbox({ label: 'Im Footer zeigen' }),
        showOnAbout: fields.checkbox({ label: 'Auf „Über uns“ zeigen' }),
      },
    }),

    press: collection({
      label: 'Presse',
      slugField: 'title',
      path: 'src/content/press/*/',
      format: { data: 'yaml' },
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Titel des Artikels' } }),
        publisher: fields.text({ label: 'Autor*in | Medium' }),
        date: fields.date({ label: 'Datum' }),
        link: fields.url({ label: 'Link' }),
        file: fields.file({ label: 'PDF (optional)', directory: 'public/press', publicPath: '/press/' }),
      },
    }),

    memberships: collection({
      label: 'Mitgliedschaften',
      slugField: 'name',
      path: 'src/content/memberships/*/',
      format: { data: 'yaml' },
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        nameI18n: titleTranslations(),
        link: fields.url({ label: 'Link zum Beitritt (z. B. Twingle)' }),
        order: fields.integer({ label: 'Reihenfolge', defaultValue: 0 }),
        ...translatedContent(),
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
        memberTitle: translatedText('Mitglieds-Block: Überschrift', { description: 'Großer roter Aufruf unten auf der Startseite' }),
        memberText: translatedText('Mitglieds-Block: Text', { multiline: true }),
        heroImages: fields.array(image('Bild', 'home'), {
          label: 'Hero-Bilder',
          description: 'Wechseln alle 4 Sekunden hinter dem Intro-Text. Leer lassen = zufällig aus allen Ausstellungsbildern.',
        }),
      },
    }),

    about: textPage('Über uns', 'about'),
    membership: textPage('Mitgliedschaft', 'membership'),
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
      },
    }),
  },
});
