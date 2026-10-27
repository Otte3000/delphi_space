// Passwortschutz für die ganze Seite (Netlify Edge Function, läuft vor jeder Anfrage).
// Aktiv nur, wenn in Netlify die Umgebungsvariable SITE_PASSWORD gesetzt ist – ohne sie ist die Seite offen.
// Nach richtiger Eingabe merkt sich der Browser den Zugang 30 Tage lang (Cookie).

declare const Netlify: { env: { get(name: string): string | undefined } };
type Context = { next(): Promise<Response> };

const COOKIE = 'delphi_access';
const MAX_AGE = 60 * 60 * 24 * 30;

const texts = {
  de: { title: 'Passwort', hint: 'Diese Seite ist noch nicht öffentlich.', label: 'Passwort', button: 'Weiter', wrong: 'Das Passwort stimmt nicht.' },
  en: { title: 'Password', hint: 'This site is not public yet.', label: 'Password', button: 'Enter', wrong: 'Wrong password.' },
  fr: { title: 'Mot de passe', hint: 'Ce site n’est pas encore public.', label: 'Mot de passe', button: 'Entrer', wrong: 'Mot de passe incorrect.' },
};

async function tokenFor(password: string) {
  const data = new TextEncoder().encode(`${password}|delphi_space`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  return header.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function loginPage(url: URL, wrong: boolean) {
  const lang = url.pathname.startsWith('/en') ? 'en' : url.pathname.startsWith('/fr') ? 'fr' : 'de';
  const t = texts[lang];
  const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${t.title} – DELPHI_space</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100svh; display: grid; place-items: center; background: #fff; color: #111;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; }
    main { width: min(360px, 100%); display: flex; flex-direction: column; gap: 20px; }
    img { width: 184px; height: auto; }
    p { margin: 0; font-family: Georgia, serif; font-style: italic; color: #6e6e6e; font-size: 17px; }
    form { display: flex; gap: 8px; }
    input { flex: 1; min-width: 0; font: inherit; font-size: 16px; padding: 10px 16px; border: 1px solid #111; border-radius: 99px; }
    button { font: inherit; font-size: 16px; padding: 10px 18px; border: 1px solid #111; border-radius: 99px; background: #111; color: #fff; cursor: pointer; }
    button:hover { background: #40ff35; color: #111; }
    .wrong { color: #e5402b; font-style: normal; font-family: inherit; font-size: 15px; }
  </style>
</head>
<body>
  <main>
    <img src="/delphi-logo.svg" alt="DELPHI_space" width="184" height="38" />
    <p>${t.hint}</p>
    <form method="post" action="${escapeHtml(url.pathname + url.search)}">
      <input type="password" name="password" aria-label="${t.label}" placeholder="${t.label}" autocomplete="current-password" required autofocus />
      <button type="submit">${t.button}</button>
    </form>
    ${wrong ? `<p class="wrong" role="alert">${t.wrong}</p>` : ''}
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

export default async (request: Request, context: Context) => {
  const password = Netlify.env.get('SITE_PASSWORD');
  if (!password) return context.next();

  const token = await tokenFor(password);
  if (readCookie(request, COOKIE) === token) return context.next();

  const url = new URL(request.url);
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const entered = form?.get('password');
    if (typeof entered === 'string' && (await tokenFor(entered)) === token) {
      return new Response(null, {
        status: 303,
        headers: {
          location: url.pathname + url.search,
          'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          'cache-control': 'no-store',
        },
      });
    }
    return loginPage(url, true);
  }

  return loginPage(url, false);
};

export const config = {
  path: '/*',
  // Logo/Favicon für die Passwortseite selbst; GitHub-Anmeldung des CMS braucht freie Rückruf-Adressen
  excludedPath: ['/delphi-logo.svg', '/favicon.svg', '/favicon.ico', '/api/keystatic/*'],
};
