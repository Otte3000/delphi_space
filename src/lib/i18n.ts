export const locales = ['de', 'en', 'fr'] as const;
export type Lang = (typeof locales)[number];
export const defaultLang: Lang = 'de';

export const languageNames: Record<Lang, string> = { de: 'DE', en: 'EN', fr: 'FR' };

/** Für getStaticPaths in src/pages/[...lang]: Deutsch hat kein Präfix. */
export const langParams = locales.map((lang) => ({ lang: lang === defaultLang ? undefined : lang }));

export const toLang = (param: string | undefined): Lang => (locales as readonly string[]).includes(param ?? '') ? (param as Lang) : defaultLang;

/** Link innerhalb einer Sprache, z. B. href('en', '/events') → '/en/events'. */
export const href = (lang: Lang, path = '/') => {
  const clean = path === '/' ? '' : path;
  return lang === defaultLang ? clean || '/' : `/${lang}${clean}`;
};

/** Gleiche Seite in einer anderen Sprache. */
export const switchLang = (pathname: string, to: Lang) => {
  const rest = pathname.replace(/^\/(en|fr)(?=\/|$)/, '') || '/';
  return href(to, rest);
};

type Translated = { de?: string | null; en?: string | null; fr?: string | null } | null | undefined;

/** Text in der gewünschten Sprache, sonst Deutsch. */
export const pick = (value: Translated, lang: Lang) => value?.[lang] || value?.de || '';

const dict = {
  exhibitions: { de: 'Ausstellungen', en: 'Exhibitions', fr: 'Expositions' },
  events: { de: 'Events', en: 'Events', fr: 'Événements' },
  about: { de: 'Über uns', en: 'About', fr: 'À propos' },
  readMore: { de: 'Mehr erfahren →', en: 'Read more →', fr: 'En savoir plus →' },
  current: { de: 'Aktuell & demnächst', en: 'Current & Upcoming', fr: 'En cours & à venir' },
  allExhibitions: { de: 'Alle Ausstellungen', en: 'All exhibitions', fr: 'Toutes les expositions' },
  allEvents: { de: 'Alle Events', en: 'All events', fr: 'Tous les événements' },
  noExhibition: { de: 'Gerade keine Ausstellung – bald mehr.', en: 'No exhibition right now – more soon.', fr: 'Pas d’exposition en ce moment – bientôt plus.' },
  upcomingEvents: { de: 'Kommende Events', en: 'Upcoming events', fr: 'Événements à venir' },
  recentEvents: { de: 'Vergangene Events', en: 'Recent events', fr: 'Événements récents' },
  upcoming: { de: 'Demnächst', en: 'Upcoming', fr: 'À venir' },
  past: { de: 'Vergangen', en: 'Past', fr: 'Passés' },
  series: { de: 'Reihen', en: 'Series', fr: 'Séries' },
  allSeries: { de: 'Alle Reihen', en: 'All series', fr: 'Toutes les séries' },
  partOf: { de: 'Teil von', en: 'Part of', fr: 'Fait partie de' },
  visit: { de: 'Programm', en: 'Programme', fr: 'Programme' },
  follow: { de: 'Mehr', en: 'More', fr: 'Plus' },
  currentExhibition: { de: 'Aktuelle Ausstellung', en: 'Current exhibition', fr: 'Exposition en cours' },
  upcomingExhibition: { de: 'Demnächst', en: 'Coming up', fr: 'Prochainement' },
  lastExhibition: { de: 'Zuletzt', en: 'Recently', fr: 'Récemment' },
  alsoOn: { de: 'Außerdem', en: 'Also on view', fr: 'Également' },
  dates: { de: 'Termine', en: 'Dates', fr: 'Dates' },
  programme: { de: 'Reihen', en: 'Series', fr: 'Séries' },
  archive: { de: 'Archiv', en: 'Archive', fr: 'Archives' },
  more: { de: 'Mehr dazu', en: 'More', fr: 'En savoir plus' },
  artists: { de: 'Künstler*innen', en: 'Artists', fr: 'Artistes' },
  team: { de: 'Team', en: 'Team', fr: 'Équipe' },
  partners: { de: 'Kooperationen', en: 'Partners', fr: 'Partenaires' },
  funders: { de: 'Gefördert von', en: 'Supported by', fr: 'Avec le soutien de' },
  press: { de: 'Presse', en: 'Press', fr: 'Presse' },
  membership: { de: 'Mitgliedschaft', en: 'Membership', fr: 'Adhésion' },
  join: { de: 'Mitglied werden →', en: 'Become a member →', fr: 'Devenir membre →' },
  openingInfo: { de: 'Eröffnung', en: 'Opening', fr: 'Vernissage' },
  watchVideo: { de: 'Video ansehen →', en: 'Watch video →', fr: 'Voir la vidéo →' },
  website: { de: 'Website →', en: 'Website →', fr: 'Site web →' },
  readArticle: { de: 'Artikel lesen →', en: 'Read article →', fr: 'Lire l’article →' },
  pdf: { de: 'PDF', en: 'PDF', fr: 'PDF' },
  imprint: { de: 'Impressum', en: 'Imprint', fr: 'Mentions légales' },
  privacy: { de: 'Datenschutz', en: 'Privacy', fr: 'Confidentialité' },
  notTranslated: {
    de: '',
    en: 'This text is only available in German.',
    fr: 'Ce texte n’est disponible qu’en allemand.',
  },
} satisfies Record<string, Record<Lang, string>>;

export const t = (lang: Lang, key: keyof typeof dict) => dict[key][lang];

const eventTypes: Record<string, Record<Lang, string>> = {
  opening: { de: 'Vernissage', en: 'Opening', fr: 'Vernissage' },
  finissage: { de: 'Finissage', en: 'Closing', fr: 'Finissage' },
  midisage: { de: 'Midissage', en: 'Midissage', fr: 'Midissage' },
  'artist-talk': { de: 'Artist Talk', en: 'Artist Talk', fr: 'Rencontre avec l’artiste' },
  talk: { de: 'Gespräch', en: 'Talk', fr: 'Conférence' },
  'guided-tour': { de: 'Führung', en: 'Guided Tour', fr: 'Visite guidée' },
  workshop: { de: 'Workshop', en: 'Workshop', fr: 'Atelier' },
  performance: { de: 'Performance', en: 'Performance', fr: 'Performance' },
  'dance-performance': { de: 'Tanzperformance', en: 'Dance Performance', fr: 'Danse' },
  concert: { de: 'Konzert', en: 'Concert', fr: 'Concert' },
  rave: { de: 'Rave', en: 'Rave', fr: 'Rave' },
  reading: { de: 'Lesung', en: 'Reading', fr: 'Lecture' },
  'film-screening': { de: 'Filmvorführung', en: 'Film Screening', fr: 'Projection' },
  livestream: { de: 'Livestream', en: 'Livestream', fr: 'Livestream' },
  'curated-dinner': { de: 'Curated Dinner', en: 'Curated Dinner', fr: 'Dîner' },
  'charity-event': { de: 'Benefiz', en: 'Charity Event', fr: 'Événement caritatif' },
  exhibition: { de: 'Ausstellung', en: 'Exhibition', fr: 'Exposition' },
  'group-exhibition': { de: 'Gruppenausstellung', en: 'Group Exhibition', fr: 'Exposition collective' },
  'public-space-exhibition': { de: 'Ausstellung im öffentlichen Raum', en: 'Public Space Exhibition', fr: 'Exposition dans l’espace public' },
  auction: { de: 'Auktion', en: 'Auction', fr: 'Vente aux enchères' },
  other: { de: 'Sonstiges', en: 'Other', fr: 'Autre' },
};

export const eventType = (type: string, lang: Lang) => eventTypes[type]?.[lang] ?? type;

const exhibitionKinds: Record<string, Record<Lang, string>> = {
  exhibition: { de: 'Ausstellung', en: 'Exhibition', fr: 'Exposition' },
  'group-exhibition': { de: 'Gruppenausstellung', en: 'Group Exhibition', fr: 'Exposition collective' },
  collection: { de: 'Sammlung', en: 'Collection', fr: 'Collection' },
};

export const exhibitionKind = (kind: string, lang: Lang) => exhibitionKinds[kind]?.[lang] ?? kind;

const artistCategories: Record<string, Record<Lang, string>> = {
  'visual-artists': { de: 'Bildende Kunst', en: 'Visual Arts', fr: 'Arts visuels' },
  'performance-artists': { de: 'Performance', en: 'Performance', fr: 'Performance' },
  'dance-performers': { de: 'Tanz', en: 'Dance', fr: 'Danse' },
  musicians: { de: 'Musik', en: 'Music', fr: 'Musique' },
  djs: { de: 'DJ', en: 'DJ', fr: 'DJ' },
  filmmakers: { de: 'Film', en: 'Film', fr: 'Cinéma' },
  photographers: { de: 'Fotografie', en: 'Photography', fr: 'Photographie' },
  writers: { de: 'Literatur', en: 'Literature', fr: 'Littérature' },
  architects: { de: 'Architektur', en: 'Architecture', fr: 'Architecture' },
  curators: { de: 'Kuratorisch', en: 'Curating', fr: 'Commissariat' },
  speakers: { de: 'Vortrag', en: 'Speaker', fr: 'Conférence' },
  collectives: { de: 'Kollektiv', en: 'Collective', fr: 'Collectif' },
  'food-wine': { de: 'Food & Wine', en: 'Food & Wine', fr: 'Gastronomie' },
};

export const artistCategory = (category: string, lang: Lang) => artistCategories[category]?.[lang] ?? category;

const intlLocale: Record<Lang, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR' };

export const formatDate = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(intlLocale[lang], { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
export const formatWeekday = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(intlLocale[lang], { weekday: 'short', timeZone: 'UTC' }).format(d);
/** Datum zerlegt für die Agenda: große Tageszahl, darunter Monat und Wochentag. */
export const dateParts = (d: Date, lang: Lang) => ({
  day: String(d.getUTCDate()),
  month: new Intl.DateTimeFormat(intlLocale[lang], { month: 'long', timeZone: 'UTC' }).format(d),
  weekday: new Intl.DateTimeFormat(intlLocale[lang], { weekday: 'long', timeZone: 'UTC' }).format(d),
});

export const formatRange =(start: Date, end: Date | null | undefined, lang: Lang) =>
  end && end.getTime() !== start.getTime() ? `${formatDate(start, lang)} – ${formatDate(end, lang)}` : formatDate(start, lang);
