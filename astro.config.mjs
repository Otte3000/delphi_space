// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.delphi-space.com',
  // Deutsch ohne Präfix (/), Englisch unter /en/, Französisch unter /fr/.
  i18n: {
    locales: ['de', 'en', 'fr'],
    defaultLocale: 'de',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [react(), keystatic()],
  // Netlify-Emulation lokal aus: wir brauchen sie nicht, und die Edge-Functions-Emulation bricht ab.
  adapter: netlify({ devFeatures: false }),
});
