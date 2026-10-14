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
  partOf: { de: 'Teil von', en: 'Part of', fr: 'Fait partie de' },
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
  vernissage: { de: 'Vernissage', en: 'Opening', fr: 'Vernissage' },
  talk: { de: 'Artist Talk', en: 'Artist Talk', fr: 'Rencontre' },
  workshop: { de: 'Workshop', en: 'Workshop', fr: 'Atelier' },
  performance: { de: 'Performance', en: 'Performance', fr: 'Performance' },
  concert: { de: 'Konzert', en: 'Concert', fr: 'Concert' },
  reading: { de: 'Lesung', en: 'Reading', fr: 'Lecture' },
  auction: { de: 'Auktion', en: 'Auction', fr: 'Vente aux enchères' },
  other: { de: 'Sonstiges', en: 'Other', fr: 'Autre' },
};

export const eventType = (type: string, lang: Lang) => eventTypes[type]?.[lang] ?? type;

const intlLocale: Record<Lang, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR' };

export const formatDate = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(intlLocale[lang], { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
export const formatWeekday = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(intlLocale[lang], { weekday: 'short', timeZone: 'UTC' }).format(d);
export const formatRange = (start: Date, end: Date | null | undefined, lang: Lang) =>
  end && end.getTime() !== start.getTime() ? `${formatDate(start, lang)} – ${formatDate(end, lang)}` : formatDate(start, lang);
