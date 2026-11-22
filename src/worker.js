// Fitness Gym Martiny Zábranské – web na Cloudflare Workers
// Data webu a nahrané fotky jsou v KV úložišti (binding DATA), statické soubory v /public.
import seed from './seed.js';
import * as T from './render.js';

const DEFAULT_PASSWORD = 'zabranska2026'; // platí jen do první změny hesla v administraci
const SESSION_HOURS = 12;
const enc = new TextEncoder();

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      console.error(err);
      return new Response('Omlouváme se, nastala chyba. Zkuste to prosím za chvíli.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  }
};

async function route(req, env) {
  const url = new URL(req.url);
  let path = url.pathname;

  // přesměrování starých adres a koncových lomítek
  if (/^\/rozvrh-hodin\/?$/.test(path)) return Response.redirect(url.origin + '/rozvrh', 301);
  if (/^\/(index|o-nas|rozvrh|cenik|aktuality|kontakt)(\.php|\/)$/.test(path)) return Response.redirect(url.origin + path.replace(/(\.php|\/)$/, '').replace('/index', '/') + url.search, 301);

  if (path.startsWith('/media/')) return media(path.slice(7), env);
  if (path === '/admin') return Response.redirect(url.origin + '/admin/', 302);
  if (path.startsWith('/admin/')) return admin(req, env, url);
  if (path === '/robots.txt') return new Response(`User-agent: *\nDisallow: /admin/\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
  if (path === '/sitemap.xml') return sitemap(url, env);

  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
  const pages = { '/': T.home, '/o-nas': T.about, '/rozvrh': T.schedule, '/cenik': T.pricing, '/aktuality': T.news, '/kontakt': T.contact };
  const data = await getData(env, true);
  const fn = pages[path];
  let view = fn ? fn(data, url) : null;
  const status = view ? 200 : 404;
  view ||= T.notFound();
  return html(T.layout(data, { ...view, origin: url.origin }), status, { 'cache-control': 'public, max-age=60' });
}

// ---------- data ----------
async function getData(env, cached = false) {
  const d = await env.DATA.get('data', cached ? { type: 'json', cacheTtl: 30 } : { type: 'json' });
  return d || structuredClone(seed);
}

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...headers
    }
  });
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function media(name, env) {
  if (!/^[\w.-]+$/.test(name)) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.DATA.getWithMetadata('media:' + name, { type: 'arrayBuffer', cacheTtl: 86400 });
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, { headers: { 'content-type': metadata?.type || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}

async function sitemap(url, env) {
  const data = await getData(env, true);
  const locs = ['/', '/o-nas', '/rozvrh', '/cenik', '/aktuality', '/kontakt', ...T.publishedPosts(data).map(p => '/aktuality?id=' + encodeURIComponent(p.id))];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map(l => `<url><loc>${T.e(url.origin + l)}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}

// ---------- kryptografie a přihlášení ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
let hmacKey = null;

async function key(env) {
  if (hmacKey) return hmacKey;
  let s = await env.DATA.get('secret');
  if (!s) { s = b64u(crypto.getRandomValues(new Uint8Array(32))); await env.DATA.put('secret', s); }
  hmacKey = await crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hmacKey;
}
const sign = async (env, msg) => b64u(await crypto.subtle.sign('HMAC', await key(env), enc.encode(msg)));

function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256));
}
const getAuth = env => env.DATA.get('auth', { type: 'json' });

async function checkPassword(env, pw) {
  const a = await getAuth(env);
  if (!a) return safeEqual(pw, DEFAULT_PASSWORD);
  return safeEqual(await pbkdf2(pw, fromB64u(a.salt), a.iter), a.hash);
}
async function setPassword(env, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iter = 10000;
  await env.DATA.put('auth', JSON.stringify({ salt: b64u(salt), iter, hash: await pbkdf2(pw, salt, iter) }));
}
const authVersion = async env => (await getAuth(env))?.hash.slice(0, 12) || 'default';

function cookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
async function session(req, env) {
  const c = cookie(req, 'mz_admin');
  if (!c) return null;
  const [exp, nonce, sig] = c.split('.');
  if (!exp || !nonce || !sig || +exp < Date.now() / 1000) return null;
  const good = await sign(env, `${exp}.${nonce}.${await authVersion(env)}`);
  return safeEqual(sig, good) ? { nonce, csrf: (await sign(env, 'csrf.' + nonce)).slice(0, 32) } : null;
}
async function newSessionCookie(env, secure) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  const nonce = b64u(crypto.getRandomValues(new Uint8Array(16)));
  const sig = await sign(env, `${exp}.${nonce}.${await authVersion(env)}`);
  return `mz_admin=${exp}.${nonce}.${sig}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure ? '; Secure' : ''}`;
}

// ---------- administrace ----------
const ADMIN_HEADERS = { 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow' };

async function admin(req, env, url) {
  const path = url.pathname;
  const secure = url.protocol === 'https:';

  if (path === '/admin/login' && req.method === 'POST') {
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const failKey = 'fail:' + ip;
    const fails = +(await env.DATA.get(failKey) || 0);
    if (fails >= 10) return html(T.adminLogin('Příliš mnoho pokusů. Zkuste to znovu za 15 minut.'), 429, ADMIN_HEADERS);
    const form = await req.formData();
    if (await checkPassword(env, String(form.get('password') || ''))) {
      if (fails) await env.DATA.delete(failKey);
      return new Response(null, { status: 303, headers: { location: '/admin/', 'set-cookie': await newSessionCookie(env, secure), ...ADMIN_HEADERS } });
    }
    await env.DATA.put(failKey, String(fails + 1), { expirationTtl: 900 });
    await new Promise(r => setTimeout(r, 800));
    return html(T.adminLogin('Nesprávné heslo.'), 401, ADMIN_HEADERS);
  }

  if (path === '/admin/logout') {
    return new Response(null, { status: 303, headers: { location: '/admin/', 'set-cookie': `mz_admin=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`, ...ADMIN_HEADERS } });
  }

  const s = await session(req, env);

  if (path === '/admin/') {
    if (!s) return html(T.adminLogin(), 200, ADMIN_HEADERS);
    return html(T.adminApp(await getData(env), s.csrf, !(await getAuth(env))), 200, ADMIN_HEADERS);
  }

  if (path.startsWith('/admin/api/')) {
    if (!s) return json({ ok: false, error: 'Nejste přihlášeni.' }, 401);
    const action = path.slice('/admin/api/'.length);

    if (action === 'export' && req.method === 'GET') {
      const d = await getData(env);
      return new Response(JSON.stringify(d, null, 1), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="zaloha-web-${new Date().toISOString().slice(0, 10)}.json"`, ...ADMIN_HEADERS } });
    }
    if (req.method !== 'POST') return json({ ok: false, error: 'Metoda není povolena.' }, 405);
    if (!safeEqual(req.headers.get('x-csrf') || '', s.csrf)) return json({ ok: false, error: 'Neplatný token, obnovte stránku.' }, 403);

    if (action === 'save') {
      let d;
      try { d = await req.json(); } catch { return json({ ok: false, error: 'Neplatná data.' }, 400); }
      for (const k of ['site', 'pricing', 'schedule', 'lessons', 'trainers', 'posts'])
        if (!d || typeof d[k] !== 'object' || d[k] === null) return json({ ok: false, error: `Chybí sekce ${k}.` }, 400);
      d.schedule = d.schedule.filter(x => +x.day >= 1 && +x.day <= 7 && String(x.lesson || '').trim());
      d.gallery = (d.gallery || []).filter(g => g && g.image);
      const prev = await env.DATA.get('data');
      if (prev) await env.DATA.put('data_prev', prev);
      await env.DATA.put('data', JSON.stringify(d));
      return json({ ok: true });
    }

    if (action === 'upload') {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 6 * 1024 * 1024) return json({ ok: false, error: 'Obrázek je větší než 6 MB.' }, 400);
      const b = new Uint8Array(buf.slice(0, 12));
      const type = b[0] === 0xff && b[1] === 0xd8 ? 'jpg'
        : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? 'png'
        : String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' ? 'webp' : null;
      if (!type) return json({ ok: false, error: 'Povolené formáty: JPG, PNG, WebP.' }, 400);
      const name = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + [...crypto.getRandomValues(new Uint8Array(5))].map(x => x.toString(16).padStart(2, '0')).join('') + '.' + type;
      await env.DATA.put('media:' + name, buf, { metadata: { type: { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[type] } });
      return json({ ok: true, path: 'media/' + name });
    }

    if (action === 'password') {
      let inp = {};
      try { inp = await req.json(); } catch {}
      if (!(await checkPassword(env, String(inp.old || '')))) return json({ ok: false, error: 'Současné heslo nesouhlasí.' }, 400);
      const nw = String(inp.new || '');
      if (nw.length < 8) return json({ ok: false, error: 'Nové heslo musí mít aspoň 8 znaků.' }, 400);
      await setPassword(env, nw);
      // po změně hesla se staré přihlášení zneplatní – pošleme nové
      return new Response(JSON.stringify({ ok: true, reload: true }), { headers: { 'content-type': 'application/json', 'set-cookie': await newSessionCookie(env, secure) } });
    }
    return json({ ok: false, error: 'Neznámá akce.' }, 400);
  }
  return html(T.adminLogin(), 404, ADMIN_HEADERS);
}
