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

/** Fließtext als HTML in der gewünschten Sprache; `fallback` ist true, wenn Deutsch einspringt. */
export const renderContent = (entry: Contents, lang: Lang) => {
  const byLang = { de: entry.content.node, en: entry.contentEn.node, fr: entry.contentFr.node };
  const fallback = lang !== 'de' && isEmpty(byLang[lang]);
  const node = fallback ? byLang.de : byLang[lang];
  return { html: Markdoc.renderers.html(Markdoc.transform(node)), fallback: fallback && !isEmpty(byLang.de) };
};

export const getExhibitions = async () => {
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
};

export const getEvents = async () => {
  const all = await reader.collections.events.all({ resolveLinkedFiles: true });
  return all
    .map(({ slug, entry }) => ({
      ...entry,
      slug,
      title: titleOf(entry.title, entry.titleI18n),
      date: toDate(entry.date)!,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
};

export const getSeries = async () => {
  const all = await reader.collections.series.all();
  return all.map(({ slug, entry }) => ({ ...entry, slug })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const textPages = ['about', 'impressum', 'datenschutz'] as const;
export type TextPage = (typeof textPages)[number];

export const getTextPage = (name: TextPage) => reader.singletons[name].readOrThrow({ resolveLinkedFiles: true });

export const getHomepage = async () => (await reader.singletons.homepage.read()) ?? { intro: {}, heroImages: [] };
export const getSettings = async () =>
  (await reader.singletons.settings.read()) ?? { address: '', email: '', instagram: null, newsletter: null, sponsors: [] };

export const locationNames: Record<string, string> = {
  bromberghof: '@DELPHI_space · Brombergstraße 17c',
  emmendinger: '@DELPHI_space/emmendinger · Emmendinger Str. 21',
  gvbk: '@DELPHI_space/gvbk · Bismarckallee 18–20',
  aussenstelle: '@DELPHI_space/außenstelle · Unterlinden 10',
  andere: '',
};

const today = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Läuft noch oder kommt noch (Enddatum bzw. Startdatum heute oder später). */
export const isCurrentOrUpcoming = (start: Date, end?: Date | null) => (end ?? start).getTime() >= today();
