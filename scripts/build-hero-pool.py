"""Stellt die Bilder für den Hero der Startseite zusammen: Fotos mit Menschen plus einzelne Kunstwerke.

Grundlage ist die Personenerkennung von scripts/detect-people.swift (macOS Vision):
    find public/images/exhibitions public/images/events -type f \\( -iname '*.jpg' -o -iname '*.png' -o -iname '*.webp' \\) \\
        ! -name 'poster-*' | swift scripts/detect-people.swift > import/people.jsonl
    python3 -I scripts/build-hero-pool.py

Ergebnis: src/data/hero-pool.json. Die Startseite nutzt es, solange im CMS keine Hero-Bilder gewählt sind.
"""

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTWORKS_PER_PEOPLE = 1 / 6  # auf etwa sechs Menschen-Bilder kommt ein Kunstwerk

rows = [json.loads(line) for line in (ROOT / 'import' / 'people.jsonl').read_text().splitlines() if line.strip()]

# Echte Menschen im Raum: mindestens zwei Personen oder zwei Gesichter.
# Einzelne Personen sind oft Teil eines Kunstwerks (Fotografien, figürliche Skulpturen).
# Bilder aus Fließtexten (text-…) sind meist Filmstills oder Flyer und bleiben draußen.
people = sorted(r['path'] for r in rows if (r['people'] >= 2 or r['faces'] >= 2) and '/text-' not in r['path'])

# Kunstwerke: Ausstellungsansichten ganz ohne erkannte Personen, keine Bilder aus Fließtexten
artwork_candidates = sorted(
    r['path'] for r in rows
    if r['people'] == 0 and r['faces'] == 0 and '/exhibitions/' in r['path'] and '/gallery-' in r['path']
)
random.seed(2019)
artworks = random.sample(artwork_candidates, round(len(people) * ARTWORKS_PER_PEOPLE))

to_url = lambda path: '/' + str(Path(path)).split('public/', 1)[1]
out = ROOT / 'src' / 'data' / 'hero-pool.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'people': [to_url(p) for p in people], 'artworks': [to_url(a) for a in artworks]}, indent=2) + '\n')
print(f'{len(people)} Bilder mit Menschen, {len(artworks)} Kunstwerke → {out.relative_to(ROOT)}')
