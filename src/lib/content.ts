import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

export const reader = createReader(process.cwd(), keystaticConfig);

export const getHomepage = async () => (await reader.singletons.homepage.read()) ?? { introDe: '', introEn: '', heroImages: [] };
export const getSettings = async () =>
  (await reader.singletons.settings.read()) ?? { address: '', email: '', instagram: null, newsletter: null, sponsors: [] };

export const locationNames: Record<string, string> = {
  bromberghof: '@DELPHI_space · Brombergstraße 17c',
  emmendinger: '@DELPHI_space/emmendinger · Emmendinger Str. 21',
  gvbk: '@DELPHI_space/gvbk · Bismarckallee 18–20',
  aussenstelle: '@DELPHI_space/außenstelle · Unterlinden 10',
  andere: '',
};

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });

export const formatDate = (d: Date) => dateFormat.format(d);
export const formatWeekday = (d: Date) => weekdayFormat.format(d);
export const formatRange = (start: Date, end?: Date | null) =>
  end && end.getTime() !== start.getTime() ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);

const today = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Läuft noch oder kommt noch (Enddatum bzw. Startdatum heute oder später). */
export const isCurrentOrUpcoming = (start: Date, end?: Date | null) => (end ?? start).getTime() >= today();
