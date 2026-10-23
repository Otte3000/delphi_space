// Holt alle CMS-Inhalte der alten Webflow-Seite über die Webflow-API (v2) und speichert sie
// unverändert als JSON in import/webflow/. Daraus baut scripts/webflow-import.mjs die Keystatic-Dateien.
//
// Aufruf:  node --env-file=.env scripts/webflow-export.mjs
// Braucht: WEBFLOW_TOKEN in .env (Site-Token mit Leserechten für „Sites“ und „CMS“).

import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.WEBFLOW_TOKEN;
if (!token) {
  console.error('WEBFLOW_TOKEN fehlt in .env');
  process.exit(1);
}

const OUT = 'import/webflow';

async function api(path) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.webflow.com/v2${path}`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    // Webflow erlaubt 60 Anfragen pro Minute – bei 429 kurz warten und erneut versuchen.
    if (res.status === 429 && attempt < 5) {
      const wait = Number(res.headers.get('retry-after') ?? 10) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
    return res.json();
  }
}

async function allItems(collectionId, cmsLocaleId) {
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const locale = cmsLocaleId ? `&cmsLocaleId=${cmsLocaleId}` : '';
    const page = await api(`/collections/${collectionId}/items?limit=100&offset=${offset}${locale}`);
    items.push(...page.items);
    if (items.length >= page.pagination.total || page.items.length === 0) return items;
  }
}

const save = (name, data) => writeFile(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));

await mkdir(OUT, { recursive: true });

const { sites } = await api('/sites');
console.log(`Sites: ${sites.map((s) => s.displayName).join(', ')}`);

for (const site of sites) {
  const detail = await api(`/sites/${site.id}`);
  await save('site', detail);
  const secondary = detail.locales?.secondary ?? [];
  console.log(`Sprachen: ${[detail.locales?.primary, ...secondary].filter(Boolean).map((l) => l.tag).join(', ') || '(keine Lokalisierung)'}`);

  const { collections } = await api(`/sites/${site.id}/collections`);
  for (const c of collections) {
    const schema = await api(`/collections/${c.id}`);
    const items = await allItems(c.id);
    const localized = {};
    for (const locale of secondary) {
      if (locale.cmsLocaleId) localized[locale.tag] = await allItems(c.id, locale.cmsLocaleId);
    }
    await save(`collection-${c.slug}`, { schema, items, localized });
    console.log(`  ${c.displayName} (${c.slug}): ${items.length} Einträge, Felder: ${schema.fields.map((f) => f.slug).join(', ')}`);
  }
}

console.log(`\nFertig – gespeichert in ${OUT}/`);
