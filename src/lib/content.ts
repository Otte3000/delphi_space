import Markdoc, { type Node } from '@markdoc/markdoc';
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { Lang } from './i18n';

// Alle Inhalte kommen über den Keystatic-Reader aus src/content/ (Schema: keystatic.config.ts).
export const reader = createReader(process.cwd(), keystaticConfig);

type Translated = { de?: string | null; en?: string | null; fr?: string | null };
type Contents = { content: { node: Node }; contentEn: { node: Node }; contentFr: { node: Node } };

const toDate = (value: string | null | undefined) => (value ? new Date(`${value}T00:00:00Z`) : null);

const titleOf = (title: string, i18n: { en?: string | null; fr?: string | null }): Translated => ({ de: title, ...i18n });

const isEmpty = (node: Node) => node.children.length === 0;

/** Beim Bauen jede Sammlung nur einmal lesen; im Dev-Server immer frisch, damit CMS-Änderungen sofort sichtbar sind. */
const cached = <T>(load: () => Promise<T>) => {
  let promise: Promise<T> | undefined;
  return () => (import.meta.env.PROD ? (promise ??= load()) : load());
};

export const renderMarkdoc = (node: Node) => (isEmpty(node) ? '' : Markdoc.renderers.html(Markdoc.transform(node)));

/** Fließtext als HTML in der gewünschten Sprache; `fallback` ist true, wenn Deutsch einspringt. */
export const renderContent = (entry: Contents, lang: Lang) => {
  const byLang = { de: entry.content.node, en: entry.contentEn.node, fr: entry.contentFr.node };
  const fallback = lang !== 'de' && isEmpty(byLang[lang]);
  const node = fallback ? byLang.de : byLang[lang];
  return { html: renderMarkdoc(node), fallback: fallback && !isEmpty(byLang.de) };
};

export const getExhibitions = cached(async () => {
  const all = await reader.collections.exhibitions.all({ resolveLinkedFiles: true });
  return all
    .map(({ slug, entry }) => ({
      ...entry,
      slug,
      title: titleOf(entry.title, entry.titleI18n),
      startDate: toDate(entry.startDate)!,
      endDate: toDate(entry.endDate),
    }))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
});

export const getEvents = cached(async () => {
  const all = await reader.collections.events.all({ resolveLinkedFiles: true });
  return all
    .map(({ slug, entry }) => ({
      ...entry,
      slug,
      title: titleOf(entry.title, entry.titleI18n),
      date: toDate(entry.date)!,
      endDate: toDate(entry.endDate),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
});

export const getSeries = cached(async () => {
  const all = await reader.collections.series.all({ resolveLinkedFiles: true });
  return all.map(({ slug, entry }) => ({ ...entry, slug })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

export const getArtists = cached(async () => {
  const all = await reader.collections.artists.all({ resolveLinkedFiles: true });
  const key = (a: { name: string; sortName: string }) => (a.sortName || a.name.split(' ').at(-1) || a.name).toLocaleLowerCase('de');
  return all.map(({ slug, entry }) => ({ ...entry, slug })).sort((a, b) => key(a).localeCompare(key(b), 'de'));
});

export const getTeam = cached(async () => {
  const all = await reader.collections.team.all();
  return all.map(({ slug, entry }) => ({ ...entry, slug })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

export const getPartners = cached(async () => {
  const all = await reader.collections.partners.all();
  return all.map(({ slug, entry }) => ({ ...entry, slug })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
});

export const getFunders = cached(async () => {
  const all = await reader.collections.funders.all();
  return all.map(({ slug, entry }) => ({ ...entry, slug })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
});

export const getPress = cached(async () => {
  const all = await reader.collections.press.all();
  return all
    .map(({ slug, entry }) => ({ ...entry, slug, date: toDate(entry.date) }))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
});

export const getMemberships = cached(async () => {
  const all = await reader.collections.memberships.all({ resolveLinkedFiles: true });
  return all
    .map(({ slug, entry }) => ({ ...entry, slug, name: titleOf(entry.name, entry.nameI18n) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

export const textPages = ['about', 'membership', 'impressum', 'datenschutz'] as const;
export type TextPage = (typeof textPages)[number];

export const getTextPage = (name: TextPage) => reader.singletons[name].readOrThrow({ resolveLinkedFiles: true });

export const getHomepage = async () => (await reader.singletons.homepage.read()) ?? { intro: {}, memberTitle: {}, memberText: {}, heroImages: [] };
export const getSettings = cached(
  async () => (await reader.singletons.settings.read()) ?? { address: '', email: '', instagram: null, newsletter: null }
);

export const locationNames: Record<string, string> = {
  bromberghof: '@DELPHI_space · Brombergstraße 17c',
  emmendinger: '@DELPHI_space/emmendinger · Emmendinger Str. 21',
  gvbk: '@DELPHI_space/gvbk · Bismarckallee 18–20',
  aussenstelle: '@DELPHI_space/außenstelle · Unterlinden 10',
  delphi: '@DELPHI_space',
  public: '',
  basel: 'Basel',
  andere: '',
};

const today = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Läuft noch oder kommt noch (Enddatum bzw. Startdatum heute oder später). */
export const isCurrentOrUpcoming = (start: Date, end?: Date | null) => (end ?? start).getTime() >= today();

/** Bilder einer Galerie ohne leere Einträge. */
export const galleryImages = (gallery: readonly { image: string | null; caption: string }[]) =>
  gallery.filter((g): g is { image: string; caption: string } => Boolean(g.image));
