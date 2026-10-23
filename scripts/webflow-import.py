"""Baut aus dem Webflow-Export (import/webflow/*.json) die Keystatic-Inhalte in src/content/
und lädt alle Bilder nach public/images/ – verkleinert auf max. 1600 px (Vorschaubilder und Poster
2400 px), kleinere Originale bleiben unverändert.

Aufruf (im Projektordner):
    node --env-file=.env scripts/webflow-export.mjs   # vorher: Rohdaten holen
    python3 -I scripts/webflow-import.py              # Inhalte schreiben
    python3 -I scripts/webflow-import.py --images     # zusätzlich Bilder laden (dauert)

Webflow verteilt Ausstellungen und Events auf drei Sammlungen (Exhibitions/Events, PreviousEvents,
Archive). Doppelte Einträge werden über Slug bzw. Titel + Startdatum zusammengeführt; die Galerien
werden vereinigt.
"""

import json
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'import' / 'webflow'
CONTENT = ROOT / 'src' / 'content'
PUBLIC = ROOT / 'public'
MAX_PX = 1600  # Galerie- und Textbilder
MAX_PX_COVER = 2400  # Vorschaubilder und Poster
JPEG_QUALITY = 70

# ── Webflow-Daten laden ────────────────────────────────────────────────────


def load(slug):
    data = json.loads((SRC / f'collection-{slug}.json').read_text())
    options = {}
    for f in data['schema']['fields']:
        for o in (f.get('validations') or {}).get('options', []):
            options[(f['slug'], o['id'])] = o['name']
    items = [i for i in data['items'] if not i['isDraft']]
    return items, options


def option(options, field, value):
    return options.get((field, value)) if value else None


collections = {}
by_id = {}  # Webflow-Item-ID → (Sammlung, Item)

# Bereiche, die komplett aus Webflow kommen, werden bei jedem Lauf neu geschrieben.
# Reihen und Seiten bleiben erhalten (dort wird nur ergänzt).
for folder in ('exhibitions', 'events', 'artists', 'team', 'partners', 'funders', 'press', 'memberships'):
    shutil.rmtree(CONTENT / folder, ignore_errors=True)
for path in SRC.glob('collection-*.json'):
    slug = path.stem.removeprefix('collection-')
    collections[slug] = load(slug)
    for item in collections[slug][0]:
        by_id[item['id']] = (slug, item)


def ref_name(item_id):
    hit = by_id.get(item_id)
    return hit[1]['fieldData'].get('name', '').strip() if hit else None


def ref_slug(item_id):
    hit = by_id.get(item_id)
    return hit[1]['fieldData'].get('slug') if hit else None


# ── Hilfsfunktionen ───────────────────────────────────────────────────────

downloads = {}  # Ziel-Pfad → URL


def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-') or 'x'


def clean_text(value):
    if not value:
        return None
    value = value.replace('‍', '').strip()
    return value or None


def date_of(value):
    return value[:10] if value else None


def image_ref(img, folder, slug, name):
    """Merkt das Bild zum Download vor und liefert den Pfad, wie Keystatic ihn speichert."""
    if not img or not img.get('url'):
        return None
    url = img['url']
    base = urllib.parse.unquote(url.rsplit('/', 1)[-1])
    base = re.sub(r'^([0-9a-f]{24}_)+', '', base)
    stem, _, ext = base.rpartition('.')
    ext = {'jpeg': 'jpg', 'JPG': 'jpg', 'JPEG': 'jpg'}.get(ext, ext.lower()) or 'jpg'
    filename = f'{name}-{slugify(stem)[:60]}.{ext}'
    downloads[PUBLIC / 'images' / folder / slug / filename] = url
    return f'/images/{folder}/{slug}/{filename}'


def gallery_refs(images, folder, slug):
    out, seen = [], set()
    for img in images:
        if not img or img['fileId'] in seen:
            continue
        seen.add(img['fileId'])
        out.append({'image': image_ref(img, folder, slug, f'gallery-{len(out) + 1:03d}'), 'caption': clean_text(img.get('alt')) or ''})
    return out


# ── HTML (Webflow-Rich-Text) → Markdoc ────────────────────────────────────


class Open(str):
    """Öffnende Auszeichnung (**, *, [) – unterscheidbar von normalem Text."""


class ToMarkdoc(HTMLParser):
    def __init__(self, image_target):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.blocks = []
        self.lists = []
        self.link = None
        self.image_target = image_target
        self.in_caption = False
        self.images = 0

    def flush(self):
        text = ''.join(self.out).strip()
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r' *\\\n *', '\\\n', text).strip('\\\n ')
        if text:
            self.blocks.append(text)
        self.out = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'div'):
            self.flush()
            if tag[0] == 'h':
                self.out.append('#' * min(int(tag[1]) + 1, 4) + ' ')
        elif tag == 'br':
            self.out.append('\\\n')
        elif tag in ('strong', 'b'):
            self.out.append(Open('**'))
        elif tag in ('em', 'i'):
            self.out.append(Open('*'))
        elif tag == 'a':
            self.link = a.get('href')
            self.out.append(Open('['))
        elif tag in ('ul', 'ol'):
            self.flush()
            self.lists.append(tag)
        elif tag == 'li':
            self.flush()
            self.out.append('- ' if self.lists[-1:] == ['ul'] else '1. ')
        elif tag == 'img' and a.get('src'):
            self.flush()
            self.images += 1
            src = self.image_target({'url': a['src'], 'fileId': a['src']}, f'text-{self.images:02d}')
            if src:
                self.blocks.append(f'![{escape(a.get("alt") or "")}]({src})')
        elif tag == 'iframe' and a.get('src'):
            self.flush()
            src = a['src']
            match = re.search(r'[?&](?:url|src)=([^&]+)', src)
            if match:
                src = urllib.parse.unquote(match.group(1))
            if src.startswith('//'):
                src = 'https:' + src
            self.blocks.append(f'[Video ansehen]({src})')
        elif tag == 'figcaption':
            self.flush()
            self.in_caption = True
            self.out.append(Open('*'))

    def handle_endtag(self, tag):
        if tag in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'div'):
            self.flush()
        elif tag in ('strong', 'b'):
            self.close('**')
        elif tag in ('em', 'i'):
            self.close('*')
        elif tag == 'a':
            self.close(f']({self.link or ""})')
            self.link = None
        elif tag in ('ul', 'ol'):
            self.flush()
            if self.lists:
                self.lists.pop()
        elif tag == 'figcaption':
            self.close('*')
            self.in_caption = False
            self.flush()

    def close(self, marker):
        """Schließt Fett/Kursiv/Link; Leerzeichen wandern nach außen, sonst erkennt Markdown die Auszeichnung nicht."""
        trailing = ''
        while self.out and isinstance(self.out[-1], str) and self.out[-1].strip() == '' and not isinstance(self.out[-1], Open):
            trailing = self.out.pop() + trailing
        if self.out and isinstance(self.out[-1], str) and not isinstance(self.out[-1], Open):
            stripped = self.out[-1].rstrip(' ')
            trailing = self.out[-1][len(stripped):] + trailing
            self.out[-1] = stripped
        if self.out and isinstance(self.out[-1], Open) and not marker.startswith(']'):
            self.out.pop()  # leere Auszeichnung
        else:
            self.out.append(marker)
        if trailing:
            self.out.append(' ')

    def handle_data(self, data):
        text = escape(data.replace('‍', '').replace('\n', ' '))
        if self.out and isinstance(self.out[-1], Open) and text[:1] == ' ':
            marker = self.out.pop()
            self.out.append(' ')
            self.out.append(marker)
            text = text.lstrip(' ')
        self.out.append(text)

    def result(self):
        self.flush()
        text = '\n\n'.join(b for b in self.blocks if b.strip('*_ []()#-\\'))
        # leere Links wie „[](…)“ aufräumen
        text = re.sub(r'(?<!!)\[\s*\]\([^)]*\)', '', text)
        # Listeneinträge ohne Leerzeile dazwischen
        text = re.sub(r'\n\n(?=(- |1\. ))', '\n', text)
        return text.strip() + '\n' if text.strip() else ''


def escape(text):
    return re.sub(r'([\\*_\[\]`{}<>])', r'\\\1', text)


def html_to_markdoc(html, folder, slug):
    if not html:
        return ''
    parser = ToMarkdoc(lambda img, name: image_ref(img, folder, slug, name))
    parser.feed(html)
    return parser.result()


# ── YAML schreiben (ohne Fremdpakete) ──────────────────────────────────────


def yaml_scalar(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', v):
        return v
    return json.dumps(v, ensure_ascii=False)


def to_yaml(data, indent=0):
    """Minimaler YAML-Schreiber für unsere flachen Strukturen (Objekte, Listen, einfache Werte)."""
    pad = '  ' * indent
    lines = []
    for key, value in data.items():
        if isinstance(value, dict):
            value = {k: v for k, v in value.items() if v not in (None, '')}
            if not value:
                lines.append(f'{pad}{key}: {{}}')
            else:
                lines.append(f'{pad}{key}:')
                lines.append(to_yaml(value, indent + 1))
        elif isinstance(value, list):
            if not value:
                lines.append(f'{pad}{key}: []')
                continue
            lines.append(f'{pad}{key}:')
            for entry in value:
                if isinstance(entry, dict):
                    inner = to_yaml(entry, indent + 2).split('\n')
                    lines.append(f'{pad}  - {inner[0].lstrip()}')
                    lines.extend(inner[1:])
                else:
                    lines.append(f'{pad}  - {yaml_scalar(entry)}')
        elif value is not None and value != '':
            lines.append(f'{pad}{key}: {yaml_scalar(value)}')
    return '\n'.join(lines)


def valid_url(value):
    """Keystatic prüft URL-Felder streng – „www.example.com“ wird ergänzt, Unbrauchbares verworfen."""
    if not value:
        return None
    value = re.sub(r'[\u200b-\u200f\ufeff\s]', '', value)  # unsichtbare Zeichen aus Webflow
    if not re.match(r'^[a-z]+:', value) and re.match(r'^[\w.-]+\.[a-z]{2,}(/|$)', value, re.I):
        value = 'https://' + value
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme in ('http', 'https') and parsed.netloc and ' ' not in value:
        return value
    print(f'  ! ungültiger Link verworfen: {value!r}')
    return None


def write_entry(folder, slug, data, contents=None, directory=True):
    """Schreibt einen Keystatic-Eintrag; `contents` sind die .mdoc-Felder (z. B. content, contentEn)."""
    for key in ('link', 'video'):
        if key in data:
            data[key] = valid_url(data[key])
    if directory:
        base = CONTENT / folder / slug
        base.mkdir(parents=True, exist_ok=True)
        (base / 'index.yaml').write_text(to_yaml(data) + '\n')
        for name, text in (contents or {}).items():
            if text:
                (base / f'{name}.mdoc').write_text(text)
    else:
        (CONTENT / folder).mkdir(parents=True, exist_ok=True)
        (CONTENT / folder / f'{slug}.yaml').write_text(to_yaml(data) + '\n')


# ── Ausstellungen & Events aus drei Webflow-Sammlungen zusammenführen ─────

SPACES = {'emmendinger': 'emmendinger', 'gvbk': 'gvbk', 'außenstelle': 'aussenstelle', 'bromberghof': 'bromberghof',
          'Basel': 'basel', 'Delphi': 'delphi', 'Public': 'public'}
KINDS = {'Group Exhibition': 'group-exhibition', 'Exhibition': 'exhibition', 'Collection': 'collection'}
EVENT_TYPES = {
    'curated-dinner', 'guided-tour', 'artist-talk', 'talk', 'midisage', 'finissage', 'opening', 'charity-event',
    'rave', 'concert', 'dance-performance', 'performance', 'workshop', 'public-space-exhibition', 'livestream',
    'reading', 'exhibition', 'group-exhibition', 'film-screening',
}


def norm(name):
    return re.sub(r'[^a-z0-9]', '', slugify(name or ''))


def team_credit(fd, *pairs):
    parts = []
    for label, key in pairs:
        value = fd.get(key)
        names = [ref_name(v) for v in (value if isinstance(value, list) else [value])] if value else []
        names = [n for n in names if n]
        if names:
            parts.append(f'{label}: {", ".join(names)}')
    return ' · '.join(parts) or None


def start_from_year_month(fd):
    year, month = (fd.get('jahr') or '').strip(), (fd.get('monat') or '').strip()
    if year.isdigit():
        return f'{year}-{int(month):02d}-01' if month.isdigit() and 1 <= int(month) <= 12 else f'{year}-01-01'
    return None


class Merger:
    """Sammelt Einträge; gleicher Slug oder gleicher Titel + Startdatum gelten als dasselbe Werk."""

    def __init__(self, date_key):
        self.entries = {}
        self.aliases = {}  # Webflow-Slug/ID → endgültiger Slug
        self.date_key = date_key

    def find(self, rec):
        if rec['slug'] in self.entries:
            return rec['slug']
        key = (norm(rec['title']), rec.get(self.date_key))
        for slug, existing in self.entries.items():
            if (norm(existing['title']), existing.get(self.date_key)) == key:
                return slug
        base = re.sub(r'-[a-z0-9]$', '', rec['slug'])
        if base in self.entries and norm(self.entries[base]['title']) == norm(rec['title']):
            return base
        return None

    def add(self, rec, webflow_id):
        webflow_slug = rec['slug']
        rec = {**rec, 'slug': re.sub(r'-{2,}', '-', webflow_slug)}
        target = self.find(rec)
        if target is None:
            target = rec['slug']
            while target in self.entries:
                target = f"{rec['slug']}-{(rec.get(self.date_key) or '')[:4] or 'x'}"
                if target in self.entries:
                    target += '-2'
            self.entries[target] = {**rec, 'slug': target, 'galleryImages': list(rec.get('galleryImages', []))}
        else:
            existing = self.entries[target]
            for key, value in rec.items():
                if key == 'galleryImages':
                    ids = {i['fileId'] for i in existing['galleryImages']}
                    existing['galleryImages'] += [i for i in value if i['fileId'] not in ids]
                elif key in ('artists', 'funders', 'performances'):
                    existing[key] = list(dict.fromkeys(existing.get(key, []) + value))
                elif not existing.get(key) and value:
                    existing[key] = value
        self.aliases[webflow_id] = target
        self.aliases[webflow_slug] = target
        return target


exhibitions = Merger('startDate')
events = Merger('date')

# Aktuelle Exhibitions-Sammlung
items, opts = collections['exhibitions']
for it in items:
    fd = it['fieldData']
    start = date_of(fd.get('date'))
    if not start:
        print('  ! Ausstellung ohne Startdatum übersprungen:', fd.get('name'))
        continue
    exhibitions.add({
        'slug': fd['slug'], 'title': fd['name'].strip(),
        'subtitle': clean_text(fd.get('untertitel')),
        'kind': KINDS.get(option(opts, 'type', fd.get('type')), 'exhibition'),
        'artistsText': clean_text(fd.get('artist-text')),
        'artists': [ref_slug(a) for a in fd.get('artists-2') or [] if ref_slug(a)],
        'startDate': start, 'endDate': date_of(fd.get('ende')),
        'openingHours': clean_text(fd.get('opening-hours')),
        'location': SPACES.get(option(opts, 'space', fd.get('space')), 'bromberghof'),
        'heroImage': fd.get('preview-image'), 'poster': fd.get('bild'),
        'galleryImages': (fd.get('bildergalerie') or []) + (fd.get('bildergalerie-2') or []),
        'video': (fd.get('trailer') or fd.get('video-link') or {}).get('url'),
        'link': fd.get('link'),
        'credits': team_credit(fd, ('Fotos', 'photograph-in'), ('Artwork', 'artwork'), ('Kuratiert von', 'curatorial-statement-reference-2')),
        'funders': [ref_slug(f) for f in fd.get('funding') or [] if ref_slug(f)],
        'openingInfo': fd.get('opening-info'), 'content': fd.get('textfeld'), 'contentEn': fd.get('optional-textfield-zb-en'),
    }, it['id'])

# PreviousEvents und Archive: Typ „Exhibition“ → Ausstellung, sonst → Event
previous_items, previous_opts = collections['previousevents']
archive_items, archive_opts = collections['archive']


def legacy_exhibition(fd, opts, source):
    start = date_of(fd.get('date') or fd.get('start')) or start_from_year_month(fd)
    subtitle = clean_text(fd.get('untertitel'))
    kind = 'exhibition'
    if subtitle and subtitle.upper() in ('GROUP EXHIBITION', 'GRUPPENAUSSTELLUNG'):
        kind, subtitle = 'group-exhibition', None
    return start, {
        'slug': fd['slug'], 'title': fd['name'].strip(), 'subtitle': subtitle, 'kind': kind,
        'startDate': start, 'endDate': date_of(fd.get('ende')),
        'location': SPACES.get(option(opts, 'ort', fd.get('ort')), 'delphi') if source == 'archive' else ('gvbk' if fd.get('gvbk') else 'delphi'),
        'heroImage': fd.get('preview-image'), 'poster': fd.get('bild'),
        'galleryImages': (fd.get('preview-bilder') or []) + (fd.get('bildergalerie') or []) + (fd.get('bildergalerie-2') or []),
        'video': (fd.get('trailer') or {}).get('url'),
        'link': fd.get('link'),
        'credits': ' · '.join(filter(None, [
            f"Fotos: {fd['name-fotograph']}" if fd.get('name-fotograph') else None,
            f"Flyer: {fd['flyer-designer']}" if fd.get('flyer-designer') else None,
            team_credit(fd, ('Fotos', 'fotograf-in')),
        ])) or None,
        'content': fd.get('textfeld'),
        'artists': [], 'funders': [],
    }


def legacy_event(fd, opts, source):
    start = date_of(fd.get('date') or fd.get('start')) or start_from_year_month(fd)
    category = ref_slug(fd.get('art')) if fd.get('art') else None
    return start, {
        'slug': fd['slug'], 'title': fd['name'].strip(), 'subtitle': clean_text(fd.get('untertitel')),
        'type': category if category in EVENT_TYPES else 'other',
        'date': start, 'endDate': date_of(fd.get('ende')), 'time': clean_text(fd.get('uhrzeit')),
        'location': SPACES.get(option(opts, 'ort', fd.get('ort')), 'delphi') if source == 'archive' else ('gvbk' if fd.get('gvbk') else 'delphi'),
        'image': fd.get('bild') or fd.get('preview-image'),
        'galleryImages': (fd.get('preview-bilder') or []) + (fd.get('bildergalerie') or []) + (fd.get('bildergalerie-2') or []),
        'link': fd.get('link'),
        'credits': ' · '.join(filter(None, [
            f"Fotos: {fd['name-fotograph']}" if fd.get('name-fotograph') else None,
            f"Flyer: {fd['flyer-designer']}" if fd.get('flyer-designer') else None,
            team_credit(fd, ('Fotos', 'fotograf-in')),
        ])) or None,
        'content': fd.get('textfeld'),
        'exhibitionRef': fd.get('exhibition'),
        'artists': [], 'performances': [],
    }


for source, items, opts in (('previousevents', previous_items, previous_opts), ('archive', archive_items, archive_opts)):
    for it in items:
        fd = it['fieldData']
        is_exhibition = option(opts, 'type', fd.get('type')) == 'Exhibition'
        start, rec = (legacy_exhibition if is_exhibition else legacy_event)(fd, opts, source)
        if not start:
            print(f'  ! {source}: ohne Datum übersprungen:', fd.get('name'))
            continue
        (exhibitions if is_exhibition else events).add(rec, it['id'])

# Aktuelle Events-Sammlung (inkl. in Webflow archivierter Events)
items, opts = collections['events']
for it in items:
    fd = it['fieldData']
    start = date_of(fd.get('datum'))
    if not start:
        print('  ! Event ohne Datum übersprungen:', fd.get('name'))
        continue
    link = fd.get('internal-link')
    if link and 'delphi-space.com' in link:
        link = None  # verweist auf die alte Webflow-Seite
    category = ref_slug(fd.get('veranstaltungsart'))
    events.add({
        'slug': fd['slug'], 'title': fd['name'].strip(),
        'subtitle': clean_text(fd.get('untertitel')),
        'type': category if category in EVENT_TYPES else 'other',
        'date': start, 'time': clean_text(fd.get('uhrzeit')),
        'location': SPACES.get(option(opts, 'space', fd.get('space')), 'bromberghof'),
        'exhibitionRef': fd.get('exhibition'),
        'seriesRef': fd.get('veranstaltungsreihe'),
        'image': fd.get('poster'),
        'galleryImages': fd.get('bildergalerie') or [],
        'link': link,
        'credits': team_credit(fd, ('Design & Fotos', 'designer-innen-photograph-innen')),
        'content': fd.get('infotext'),
        'performances': fd.get('performances') or [],
        'artists': [],
    }, it['id'])

# ── Veranstaltungsreihen ──────────────────────────────────────────────────

series_slugs = {}  # Webflow-ID → Slug
existing_series = {p.name: p for p in (CONTENT / 'series').iterdir()} if (CONTENT / 'series').exists() else {}
# Bestehende Reihen (aus dem ersten Aufbau) vom Einzeldatei- ins Ordnerformat bringen
for name, path in list(existing_series.items()):
    if path.is_file() and path.suffix == '.yaml':
        target = CONTENT / 'series' / path.stem
        target.mkdir(exist_ok=True)
        shutil.move(path, target / 'index.yaml')
        existing_series[path.stem] = target
        del existing_series[name]

items, opts = collections['veranstaltungsreihen']
for order, it in enumerate(items, start=1):
    fd = it['fieldData']
    slug = next((s for s in existing_series if norm(s) == norm(fd['name'])), fd['slug'])
    series_slugs[it['id']] = slug
    path = CONTENT / 'series' / slug / 'index.yaml'
    if path.exists():
        # Von Hand gepflegte Reihe: nur Bild, Galerie und Langtext aus Webflow ergänzen
        text = path.read_text()
        extra = {}
        poster = image_ref(fd.get('poster'), 'series', slug, 'poster')  # immer vormerken, auch wenn schon eingetragen
        if not re.search(r'^image:', text, re.M) and poster:
            extra['image'] = poster
        gallery = gallery_refs(fd.get('bildergalerie') or [], 'series', slug)
        if gallery and not re.search(r'^gallery:', text, re.M):
            extra['gallery'] = gallery
        if extra:
            path.write_text(text.rstrip('\n') + '\n' + to_yaml(extra) + '\n')
    else:
        write_entry('series', slug, {
            'title': fd['name'].strip(),
            'description': {'de': clean_text(fd.get('beschreibung'))},
            'link': fd.get('link'),
            'contact': ' '.join(filter(None, [clean_text(fd.get('verantwortlicher-organisator-ansprechpartner')), fd.get('kontakt-ansprechpartner')])) or None,
            'image': image_ref(fd.get('poster'), 'series', slug, 'poster'),
            'gallery': gallery_refs(fd.get('bildergalerie') or [], 'series', slug),
            'showOnHomepage': False,
            'order': 10 + order,
        })
    content = html_to_markdoc(fd.get('textfeld'), 'series', slug)
    if content and not (CONTENT / 'series' / slug / 'content.mdoc').exists():
        (CONTENT / 'series' / slug / 'content.mdoc').write_text(content)

# ── Künstler*innen ─────────────────────────────────────────────────────────

items, opts = collections['artists']
artist_slugs = {}
for it in items:
    fd = it['fieldData']
    slug = fd['slug']
    artist_slugs[it['id']] = slug
    content = '\n'.join(filter(None, [html_to_markdoc(fd.get('bio'), 'artists', slug), html_to_markdoc(fd.get('bio-details'), 'artists', slug)]))
    write_entry('artists', slug, {
        'name': fd['name'].strip(),
        'sortName': clean_text(fd.get('nachname')),
        'cities': ', '.join(filter(None, (clean_text(fd.get(k)) for k in ('ort-1', 'ort-2', 'ort-3')))) or None,
        'categories': [s for s in (ref_slug(c) for c in fd.get('artist-categories') or []) if s in {
            'visual-artists', 'performance-artists', 'dance-performers', 'musicians', 'djs', 'filmmakers', 'photographers',
            'writers', 'architects', 'curators', 'speakers', 'collectives', 'food-wine'}],
        'link': fd.get('artist-link'),
        'gallery': gallery_refs(fd.get('bildergalerie') or [], 'artists', slug),
        'hidden': bool(fd.get('do-not-show-in-artist-list')),
    }, {'content': content})
    # Rückverweise: Künstler*in → Ausstellungen / Events
    for ref in fd.get('exhibitions') or []:
        target = exhibitions.aliases.get(ref)
        if target:
            exhibitions.entries[target].setdefault('artists', []).append(slug)
    for ref in fd.get('events') or []:
        target = events.aliases.get(ref)
        if target:
            events.entries[target].setdefault('artists', []).append(slug)

# ── Förderer ──────────────────────────────────────────────────────────────

items, opts = collections['funding']
FUNDER_KINDS = {'Privat': 'private', 'Öffentliche Förderung': 'public', 'Kollektive': 'collective'}
for it in items:
    fd = it['fieldData']
    slug = fd['slug']
    write_entry('funders', slug, {
        'name': fd['name'].strip(),
        'category': FUNDER_KINDS.get(option(opts, 'kategorie', fd.get('kategorie')), 'public'),
        'logo': image_ref(fd.get('logo-2'), 'funders', slug, 'logo'),
        'link': fd.get('link'),
        'showInFooter': bool(fd.get('footer')),
        'showOnAbout': bool(fd.get('fundingseite')),
    })
    for ref in fd.get('ausstellungsspezifisches-funding') or []:
        target = exhibitions.aliases.get(ref)
        if target:
            exhibitions.entries[target]['funders'] = list(dict.fromkeys(exhibitions.entries[target].get('funders', []) + [slug]))

# ── Ausstellungen & Events schreiben ──────────────────────────────────────

for slug, rec in exhibitions.entries.items():
    write_entry('exhibitions', slug, {
        'title': rec['title'],
        'titleI18n': {},
        'subtitle': {'de': rec.get('subtitle')},
        'kind': rec.get('kind') or 'exhibition',
        'artistsText': rec.get('artistsText'),
        'artists': list(dict.fromkeys(rec.get('artists', []))),
        'startDate': rec['startDate'], 'endDate': rec.get('endDate'),
        'openingHours': {'de': rec.get('openingHours')},
        'location': rec.get('location') or 'bromberghof',
        'heroImage': image_ref(rec.get('heroImage'), 'exhibitions', slug, 'preview'),
        'poster': image_ref(rec.get('poster'), 'exhibitions', slug, 'poster'),
        'gallery': gallery_refs(rec['galleryImages'], 'exhibitions', slug),
        'video': rec.get('video'), 'link': rec.get('link'), 'credits': rec.get('credits'),
        'funders': list(dict.fromkeys(rec.get('funders', []))),
    }, {
        'content': html_to_markdoc(rec.get('content'), 'exhibitions', slug),
        'contentEn': html_to_markdoc(rec.get('contentEn'), 'exhibitions', slug),
        'openingInfo': html_to_markdoc(rec.get('openingInfo'), 'exhibitions', slug),
    })

performances = {it['id']: it['fieldData'] for it in collections['performing-mondays'][0]}
for slug, rec in events.entries.items():
    exhibition = exhibitions.aliases.get(rec.get('exhibitionRef')) if rec.get('exhibitionRef') else None
    content = html_to_markdoc(rec.get('content'), 'events', slug)
    for ref in rec.get('performances', []):
        perf = performances.get(ref)
        if perf:
            content += f"\n## {escape(perf['name'].strip())}\n\n" + html_to_markdoc(perf.get('infotext'), 'events', slug)
    write_entry('events', slug, {
        'title': rec['title'],
        'titleI18n': {},
        'subtitle': {'de': rec.get('subtitle')},
        'type': rec.get('type') or 'other',
        'date': rec['date'], 'endDate': rec.get('endDate') if rec.get('endDate') != rec['date'] else None,
        'time': rec.get('time'),
        'location': rec.get('location') or 'bromberghof',
        'exhibition': exhibition,
        'series': series_slugs.get(rec.get('seriesRef')),
        'artists': list(dict.fromkeys(rec.get('artists', []))),
        'image': image_ref(rec.get('image'), 'events', slug, 'poster'),
        'gallery': gallery_refs(rec['galleryImages'], 'events', slug),
        'link': rec.get('link'), 'credits': rec.get('credits'),
    }, {'content': content.strip() + '\n' if content.strip() else ''})

# ── Team, Kooperationen, Presse, Mitgliedschaften ─────────────────────────

items, opts = collections['team']
TEAM_KINDS = {'Photograph:in': 'photographer', 'Designer:in': 'designer', 'Kurator:in': 'curator'}
for order, it in enumerate(items):
    fd = it['fieldData']
    write_entry('team', fd['slug'], {
        'name': fd['name'].strip(),
        'role': {'de': clean_text(fd.get('rolle-funktion')), 'en': clean_text(fd.get('rolle-funktion-english'))},
        'bio': {'de': clean_text(fd.get('kurzbio')), 'en': clean_text(fd.get('kurzbio-english'))},
        'category': TEAM_KINDS.get(option(opts, 'kategorie', fd.get('kategorie')), 'team'),
        'active': bool(fd.get('aktives-mitglied')),
        'photo': image_ref(fd.get('photo'), 'team', fd['slug'], 'photo'),
        'email': fd.get('kontakt-email'), 'phone': fd.get('kontak-nummer'), 'link': fd.get('link'),
        'order': order,
    }, directory=False)

for it in collections['kooperationen'][0]:
    fd = it['fieldData']
    write_entry('partners', fd['slug'], {
        'name': fd['name'].strip(), 'area': clean_text(fd.get('bereich')), 'link': fd.get('link'),
    }, directory=False)

for it in collections['press'][0]:
    fd = it['fieldData']
    slug = fd['slug']
    file_ref = None
    if fd.get('file') and fd['file'].get('url'):
        name = slugify(urllib.parse.unquote(fd['file']['url'].rsplit('/', 1)[-1]).rsplit('.', 1)[0])[:60] + '.pdf'
        downloads[PUBLIC / 'press' / slug / name] = fd['file']['url']
        file_ref = f'/press/{slug}/{name}'
    write_entry('press', slug, {
        'title': clean_text(fd.get('titel-des-artikels')) or fd['name'].strip(),
        'publisher': clean_text(fd.get('herausgeber-zeitung')),
        'date': date_of(fd.get('date')),
        'link': fd.get('link'),
        'file': file_ref,
    })

for order, it in enumerate(collections['mitgliedschaften'][0]):
    fd = it['fieldData']
    write_entry('memberships', fd['slug'], {
        'name': (clean_text(fd.get('titel')) or fd['name']).strip(),
        'nameI18n': {},
        'link': fd.get('twingle-link'),
        'order': order,
    }, {'content': html_to_markdoc(fd.get('info-text'), 'memberships', fd['slug'])})

print(f'Ausstellungen: {len(exhibitions.entries)}  Events: {len(events.entries)}  Künstler*innen: {len(artist_slugs)}')
print(f'Bilder/Dateien vorgemerkt: {len(downloads)}')

# ── Bilder laden & verkleinern ────────────────────────────────────────────


TMP = ROOT / 'import' / 'tmp'  # außerhalb von public/, damit das CMS keine halben Dateien sieht


def max_side(path):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(path)], capture_output=True, text=True).stdout
    sizes = [int(n) for n in re.findall(r'pixel(?:Width|Height): (\d+)', out)]
    return max(sizes) if sizes else 0


def fetch(item):
    dest, url = item
    if dest.exists():
        return 'skip'
    dest.parent.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    tmp = TMP / f'{abs(hash(str(dest)))}{dest.suffix}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (DELPHI_space migration)'})
        with urllib.request.urlopen(req, timeout=60) as res, open(tmp, 'wb') as f:
            shutil.copyfileobj(res, f)
        # Titelbilder und Poster werden groß gezeigt und brauchen auf Retina-Bildschirmen mehr Pixel.
        limit = MAX_PX_COVER if dest.name.startswith(('preview-', 'poster-')) else MAX_PX
        # Nur verkleinern, nie vergrößern (sips -Z würde kleine Bilder hochskalieren). WebP kann sips nicht schreiben.
        if dest.suffix.lower() in ('.jpg', '.png', '.tif', '.tiff') and max_side(tmp) > limit:
            args = ['sips', '-Z', str(limit)]
            if dest.suffix.lower() == '.jpg':
                args += ['-s', 'formatOptions', str(JPEG_QUALITY)]
            subprocess.run(args + [str(tmp)], check=True, capture_output=True)
        shutil.move(tmp, dest)
        return 'ok'
    except Exception as e:  # noqa: BLE001 – einzelne Fehler sollen den Import nicht abbrechen
        tmp.unlink(missing_ok=True)
        return f'FEHLER {url}: {e}'


if '--images' in sys.argv:
    done = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for result in pool.map(fetch, downloads.items()):
            done += 1
            if result.startswith('FEHLER'):
                print('  !', result)
            if done % 100 == 0:
                print(f'  {done}/{len(downloads)} Dateien')
    print('Bilder fertig.')
