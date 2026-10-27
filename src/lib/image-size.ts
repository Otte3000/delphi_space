import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Liest Breite und Höhe eines Bildes aus public/ direkt aus dem Dateikopf (JPEG und PNG) – ohne Zusatzpaket.
const cache = new Map<string, { width: number; height: number } | null>();

export function imageSize(publicPath: string) {
  if (cache.has(publicPath)) return cache.get(publicPath)!;
  let size: { width: number; height: number } | null = null;
  try {
    const buf = readFileSync(join(process.cwd(), 'public', publicPath));
    if (buf.readUInt32BE(0) === 0x89504e47) {
      size = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    } else if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        // SOF-Marker (Start of Frame) enthalten die Bildmaße
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {
    size = null;
  }
  cache.set(publicPath, size);
  return size;
}

export const isPortrait = (src: string) => {
  const s = imageSize(src);
  return Boolean(s && s.height > s.width);
};

export const isLandscape = (src: string) => {
  const s = imageSize(src);
  return Boolean(s && s.width > s.height);
};
