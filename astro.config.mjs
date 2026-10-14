// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.delphi-space.com',
  integrations: [react(), markdoc(), keystatic()],
  // Netlify-Emulation lokal aus: wir brauchen sie nicht, und die Edge-Functions-Emulation bricht ab.
  adapter: netlify({ devFeatures: false }),
});