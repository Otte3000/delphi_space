import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Die Felder entsprechen keystatic.config.ts – dort werden die Inhalte gepflegt.
const location = z.enum(['bromberghof', 'emmendinger', 'gvbk', 'aussenstelle', 'andere']).default('bromberghof');
const optionalText = z.string().nullish().transform((v) => v || undefined);

const exhibitions = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/exhibitions' }),
  schema: z.object({
    title: z.string(),
    subtitle: optionalText,
    artists: optionalText,
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullish(),
    openingHours: optionalText,
    location,
    heroImage: optionalText,
    gallery: z.array(z.object({ image: optionalText, caption: optionalText })).default([]),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    type: z.string().default('Sonstiges'),
    date: z.coerce.date(),
    time: optionalText,
    location,
    exhibition: reference('exhibitions').nullish(),
    image: optionalText,
  }),
});

const series = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/series' }),
  schema: z.object({
    title: z.string(),
    schedule: optionalText,
    description: optionalText,
    link: optionalText,
    image: optionalText,
    order: z.number().nullish(),
  }),
});

// Einzelseiten mit Fließtext (z. B. „Über uns“). Startseite und Einstellungen liest src/lib/content.ts.
const pages = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './src/content/pages' }),
  schema: z.object({ title: z.string() }),
});

export const collections = { exhibitions, events, series, pages };
