// Šablony stránek – vykreslení HTML na serveru (Cloudflare Worker)

export const DAYS = { 1: 'Pondělí', 2: 'Úterý', 3: 'Středa', 4: 'Čtvrtek', 5: 'Pátek', 6: 'Sobota', 7: 'Neděle' };
const DAYS_SHORT = { 1: 'Po', 2: 'Út', 3: 'St', 4: 'Čt', 5: 'Pá', 6: 'So', 7: 'Ne' };
const MONTHS = ['', 'ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const V = '3'; // verze CSS/JS kvůli cache

export const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = s => String(s || '').trim().split(/\n\s*\n/).filter(p => p.trim()).map(p => '<p>' + e(p.trim()).replace(/\n/g, '<br>\n') + '</p>').join('');
const czDate = ymd => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); return m ? `${+m[3]}. ${MONTHS[+m[2]]} ${m[1]}` : ''; };
const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const src = p => !p ? '' : /^(https?:|\/)/.test(p) ? p : '/' + p;
const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const img = (p, alt, cls = '') => !p
  ? `<div class="ph ${e(cls)}" role="img" aria-label="${e(alt)}"><span>foto</span></div>`
  : `<img class="${e(cls)}" src="${e(src(p))}" alt="${e(alt)}" loading="lazy">`;
const ext = 'target="_blank" rel="noopener"';

export function pragueNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return { dow, day: +parts.day, month: +parts.month, year: +parts.year };
}

function scheduleByDay(data) {
  const by = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
  for (const s of data.schedule || []) if (by[+s.day]) by[+s.day].push(s);
  for (const k in by) by[k].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return by;
}
const capacity = (s, data) => +(s.capacity || data.site.default_capacity || 10);
export function publishedPosts(data, type = null) {
  return (data.posts || []).filter(p => p.published && (!type || p.type === type)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// ---------- layout ----------
const NAV = [['/', 'index', 'Úvod'], ['/o-nas', 'o-nas', 'O nás'], ['/rozvrh', 'rozvrh', 'Rozvrh'], ['/cenik', 'cenik', 'Ceník'], ['/aktuality', 'aktuality', 'Aktuality a akce'], ['/kontakt', 'kontakt', 'Kontakt']];
const LOGO = `<span class="logo-text"><b>Fitness Gym</b><i>Martiny Zábranské</i></span>`;

export function layout(data, { page, title, desc, body, origin }) {
  const s = data.site;
  const full = (title ? title + ' – ' : '') + s.name;
  const d = desc || s.tagline;
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(full)}</title>
<meta name="description" content="${e(d)}">
<meta property="og:title" content="${e(full)}">
<meta property="og:description" content="${e(d)}">
<meta property="og:type" content="website">
${s.hero_image && origin ? `<meta property="og:image" content="${e(origin + src(s.hero_image))}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v=${V}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23161616'/><text x='16' y='21.5' font-family='Arial' font-size='13' font-weight='700' fill='white' text-anchor='middle'>MZ</text></svg>">
</head>
<body class="page-${e(page)}">
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="/" aria-label="${e(s.name)} – úvod">${LOGO}</a>
    <nav class="main-nav" id="nav" aria-label="Hlavní navigace">
      ${NAV.map(([href, slug, label]) => `<a href="${href}"${slug === page ? ' aria-current="page"' : ''}>${e(label)}</a>`).join('\n      ')}
      <a class="btn btn-dark nav-cta" href="${e(s.reservation_url)}" ${ext}>Rezervovat lekci</a>
    </nav>
    <button class="nav-toggle" aria-controls="nav" aria-expanded="false" aria-label="Menu"><span></span><span></span></button>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="logo logo-footer" href="/">${LOGO}</a>
      <p class="muted">${e(s.tagline)}</p>
    </div>
    <div>
      <h4>Kontakt</h4>
      <p>${e(s.address)}<br>
      <a href="${e(telHref(s.phone))}">${e(s.phone)}</a><br>
      <a href="mailto:${e(s.email)}">${e(s.email)}</a></p>
    </div>
    <div>
      <h4>Otevírací doba</h4>
      ${hours(s)}
    </div>
    <div>
      <h4>Rychlé odkazy</h4>
      <p><a href="${e(s.reservation_url)}" ${ext}>Rezervační systém ↗</a><br>
      <a href="/rozvrh">Rozvrh lekcí</a><br><a href="/cenik">Ceník</a>
      ${s.facebook ? `<br><a href="${e(s.facebook)}" ${ext}>Facebook ↗</a>` : ''}
      ${s.instagram ? `<br><a href="${e(s.instagram)}" ${ext}>Instagram ↗</a>` : ''}</p>
    </div>
  </div>
  <div class="wrap footer-bottom muted">
    <span>© ${pragueNow().year} ${e(s.name)}${s.ico ? ' · IČO ' + e(s.ico) : ''}</span>
    <a href="/admin/" rel="nofollow">Administrace</a>
  </div>
</footer>
<script src="/assets/main.js?v=${V}" defer></script>
</body>
</html>`;
}

const hours = s => `<dl class="hours">${(s.hours || []).map(h => `<dt>${e(h.days)}</dt><dd>${e(h.time)}</dd>`).join('')}</dl>`;

const postCard = p => `
<article class="card">
  <a href="/aktuality?id=${encodeURIComponent(p.id)}" class="card-link">
    ${img(p.image, p.title, 'card-img')}
    <div class="card-body">
      <p class="meta"><span class="tag tag-${e(p.type)}">${p.type === 'akce' ? 'Akce' : 'Aktualita'}</span>
        ${p.type === 'akce' && p.event_date ? e(p.event_date) : e(czDate(p.date))}</p>
      <h3>${e(p.title)}</h3>
      <p class="muted">${e(short(p.text, 140))}</p>
    </div>
  </a>
</article>`;

const cta = (title, text, buttons) => `
<section class="wrap cta">
  <h2>${title}</h2>
  <p>${text}</p>
  <div class="actions center">${buttons}</div>
</section>`;

// ---------- stránky ----------
export function home(data) {
  const s = data.site, now = pragueNow(), cap = +(s.default_capacity || 10);
  const today = scheduleByDay(data)[now.dow];
  const posts = publishedPosts(data).slice(0, 3);
  const res = `href="${e(s.reservation_url)}" ${ext}`;
  return {
    page: 'index', title: '', desc: s.tagline, body: `
<section class="hero wrap">
  <div class="hero-text">
    <p class="eyebrow">Fitness studio · Brno</p>
    <h1>Cvičení v&nbsp;malé skupině, kousek od&nbsp;centra.</h1>
    <p class="lead">Maximálně ${cap} lidí na lekci, klimatizované studio a lektorky, které vás znají jménem. Pro muže i&nbsp;ženy, začátečníky i&nbsp;pokročilé.</p>
    <div class="actions">
      <a class="btn btn-dark" ${res}>Rezervovat lekci</a>
      <a class="btn btn-line" href="/rozvrh">Zobrazit rozvrh</a>
    </div>
  </div>
  <div class="hero-media">${img(s.hero_image, 'Studio ' + s.name, 'hero-img')}</div>
</section>

<section class="wrap benefits" aria-label="Proč k nám">
  <div class="benefit"><span class="num">01</span><h3>Blízko centra</h3><p>Pár minut z centra Brna, snadno se k nám dostanete MHD i autem.</p></div>
  <div class="benefit"><span class="num">02</span><h3>Max ${cap} lidí na lekci</h3><p>Malé skupiny, takže lektorka má čas na každého a opraví vám techniku.</p></div>
  <div class="benefit"><span class="num">03</span><h3>Klimatizované studio</h3><p>Příjemné cvičení po celý rok, i v nejteplejších letních dnech.</p></div>
  <div class="benefit"><span class="num">04</span><h3>Pro muže i ženy</h3><p>Lekce jsou pro každého bez ohledu na věk a kondici, ať začínáte, nebo cvičíte léta.</p></div>
  <div class="benefit"><span class="num">05</span><h3>Přátelské prostředí</h3><p>Žádný anonymní fitness řetězec. U nás se lidé znají a rádi se vracejí.</p></div>
  <div class="benefit"><span class="num">06</span><h3>Studio jen pro vás</h3><p>Celé studio si můžete rezervovat pro sebe, svou partu nebo svého trenéra.</p></div>
</section>

<section class="band">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Dnes · ${DAYS[now.dow]} ${now.day}. ${now.month}.</p>
      <h2>Dnešní lekce</h2>
      <p class="muted">Kompletní týdenní přehled najdete v rozvrhu. Místo si rezervujete online za pár vteřin.</p>
      <a class="link-arrow" href="/rozvrh">Celý rozvrh →</a>
    </div>
    <div>
      ${today.length ? `<ul class="lesson-list">${today.map(l => `
        <li>
          <span class="time">${e(l.start)}–${e(l.end)}</span>
          <span class="name">${e(l.lesson)}${l.trainer ? `<small>${e(l.trainer)}</small>` : ''}</span>
          <a class="btn btn-sm btn-line" ${res}>Rezervovat</a>
        </li>`).join('')}
      </ul>` : `<p class="empty">Dnes nemáme žádné skupinové lekce. Podívejte se na <a href="/rozvrh">rozvrh na další dny</a>.</p>`}
    </div>
  </div>
</section>

<section class="wrap split rental">
  <div class="rental-media">${img(s.rental_image || s.about_image, 'Interiér studia', 'cover')}</div>
  <div>
    <p class="eyebrow">Pronájem studia</p>
    <h2>Zarezervujte si studio jen pro sebe</h2>
    ${para(s.rental_text)}
    <div class="actions">
      <a class="btn btn-dark" href="${e(telHref(s.phone))}">Zavolat ${e(s.phone)}</a>
      <a class="btn btn-line" href="mailto:${e(s.email)}?subject=Pron%C3%A1jem%20studia">Napsat e‑mail</a>
    </div>
  </div>
</section>

${posts.length ? `<section class="wrap section">
  <div class="section-head">
    <h2>Aktuality a akce</h2>
    <a class="link-arrow" href="/aktuality">Všechny zprávy →</a>
  </div>
  <div class="cards">${posts.map(postCard).join('')}</div>
</section>` : ''}
${cta('První lekce? Stačí přijít.', 'Vyberte si termín v rezervačním systému, vezměte si pohodlné oblečení a pití. Zbytek vyřešíme spolu.',
      `<a class="btn btn-dark" ${res}>Rezervovat lekci</a><a class="btn btn-line" href="/cenik">Ceník</a>`)}`
  };
}

export function about(data) {
  const s = data.site;
  const [lead, ...rest] = data.trainers || [];
  const gallery = data.gallery || [];
  return {
    page: 'o-nas', title: 'O nás', desc: 'Kdo jsme a kdo s vámi cvičí – lektorky ' + s.name + ' v Brně.', body: `
<section class="wrap page-head">
  <p class="eyebrow">O nás</p>
  <h1>${e(s.about_title)}</h1>
</section>
<section class="wrap split about">
  <div class="prose">${para(s.about_text)}</div>
  <div>${img(s.about_image, 'Studio', 'cover tall')}</div>
</section>
<section class="band">
  <div class="wrap facts">
    <div><strong>max ${+(s.default_capacity || 10)}</strong><span>lidí na lekci</span></div>
    <div><strong>${(data.lessons || []).length}+</strong><span>druhů lekcí</span></div>
    <div><strong>klima</strong><span>po celý rok</span></div>
    <div><strong>5 min</strong><span>od centra Brna</span></div>
  </div>
</section>
${gallery.length ? `<section class="wrap section" id="studio">
  <div class="section-head"><h2>Naše studio</h2><p class="muted">Klimatizované prostory kousek od centra Brna.</p></div>
  <div class="gallery">${gallery.map(g => `
    <figure>
      <a href="${e(src(g.image))}" ${ext}>${img(g.image, g.caption || 'Studio', 'gal-img')}</a>
      ${g.caption ? `<figcaption>${e(g.caption)}</figcaption>` : ''}
    </figure>`).join('')}
  </div>
</section>` : ''}
<section class="wrap section" id="lektorky">
  <div class="section-head"><h2>Naše lektorky</h2></div>
  ${lead ? `<article class="trainer-lead">
    <div>${img(lead.photo, lead.name, 'portrait')}</div>
    <div>
      <p class="eyebrow">${e(lead.role)}</p>
      <h3>${e(lead.name)}</h3>
      <div class="prose">${para(lead.bio)}</div>
    </div>
  </article>` : ''}
  ${rest.length ? `<div class="trainers">${rest.map(t => `
    <article class="trainer">
      ${img(t.photo, t.name, 'portrait')}
      <div>
        <h3>${e(t.name)}</h3>
        <p class="role">${e(t.role)}</p>
        <div class="muted">${para(t.bio)}</div>
      </div>
    </article>`).join('')}
  </div>` : ''}
</section>
${cta('Přijďte se podívat', 'Vyberte si lekci, která vám sedí, a zarezervujte si místo.',
      `<a class="btn btn-dark" href="${e(s.reservation_url)}" ${ext}>Rezervovat lekci</a><a class="btn btn-line" href="/rozvrh">Rozvrh</a>`)}`
  };
}

export function schedule(data) {
  const s = data.site, by = scheduleByDay(data), today = pragueNow().dow;
  return {
    page: 'rozvrh', title: 'Rozvrh lekcí', desc: 'Týdenní rozvrh skupinových lekcí – pilates, kruhový trénink, HIIT, TAE-BO a další.', body: `
<section class="wrap page-head">
  <p class="eyebrow">Rozvrh</p>
  <h1>Rozvrh lekcí</h1>
  <p class="lead">Na každou lekci je max. ${+(s.default_capacity || 10)} míst, pokud není uvedeno jinak. Místo si rezervujte předem v&nbsp;rezervačním systému.</p>
  <div class="actions"><a class="btn btn-dark" href="${e(s.reservation_url)}" ${ext}>Otevřít rezervace ↗</a></div>
</section>
<section class="wrap">
  <div class="day-tabs" role="tablist" aria-label="Dny v týdnu">
    ${Object.entries(DAYS_SHORT).map(([n, d]) => `<button role="tab" data-day="${n}" aria-selected="${+n === today}">${d}</button>`).join('')}
  </div>
  <div class="week">
    ${Object.entries(DAYS).map(([n, day]) => `
    <div class="day${+n === today ? ' is-today is-active' : ''}" data-day="${n}">
      <h3>${day}${+n === today ? ' <span class="today-dot">dnes</span>' : ''}</h3>
      ${!by[n].length ? '<p class="empty">Bez lekcí</p>' : by[n].map(l => `
        <a class="slot" href="${e(s.reservation_url)}" ${ext}>
          <span class="time">${e(l.start)}–${e(l.end)}</span>
          <span class="name">${e(l.lesson)}</span>
          <span class="sub">${l.trainer ? e(l.trainer) + ' · ' : ''}max ${capacity(l, data)} osob</span>
        </a>`).join('')}
    </div>`).join('')}
  </div>
  <p class="muted small">Kliknutím na lekci přejdete do rezervačního systému. Změny rozvrhu sledujte v <a href="/aktuality">aktualitách</a>.</p>
</section>
${(data.lessons || []).length ? `<section class="wrap section">
  <div class="section-head"><h2>Co u nás cvičíme</h2></div>
  <div class="lessons">${data.lessons.map(l => `
    <article class="lesson"><h3>${e(l.name)}</h3><p class="muted">${e(l.desc)}</p></article>`).join('')}
  </div>
</section>` : ''}`
  };
}

export function pricing(data) {
  const s = data.site;
  return {
    page: 'cenik', title: 'Ceník', desc: 'Ceník lekcí, permanentek a Wellness Karty s kreditem navíc.', body: `
<section class="wrap page-head">
  <p class="eyebrow">Ceník</p>
  <h1>Jednoduché ceny, žádné závazky</h1>
  <p class="lead">Přijďte jednorázově, kupte si permanentku, nebo si nabijte Wellness Kartu a získejte kredit navíc.</p>
</section>
<section class="wrap price-groups">
  ${(data.pricing || []).map(g => `
  <div class="price-group">
    <div class="price-head">
      <h2>${e(g.title)}</h2>
      ${g.note ? `<p class="muted">${e(g.note)}</p>` : ''}
    </div>
    <ul class="price-list">${(g.items || []).map(it => `
      <li>
        <span class="label">${e(it.label)}${it.sub ? ` <em>${e(it.sub)}</em>` : ''}</span>
        <span class="dots" aria-hidden="true"></span>
        <span class="price">${e(it.price)}</span>
      </li>`).join('')}
    </ul>
  </div>`).join('')}
</section>
${(data.pricing_notes || []).filter(Boolean).length ? `<section class="wrap"><ul class="notes">${data.pricing_notes.filter(Boolean).map(n => `<li>${e(n)}</li>`).join('')}</ul></section>` : ''}
${cta('Pronájem studia', 'Chcete studio jen pro sebe? Cenu a termín domluvíme individuálně.',
      `<a class="btn btn-dark" href="${e(telHref(s.phone))}">${e(s.phone)}</a><a class="btn btn-line" href="mailto:${e(s.email)}">Napsat e‑mail</a>`)}`
  };
}

export function news(data, url) {
  const s = data.site;
  const id = url.searchParams.get('id');
  if (id) {
    const p = publishedPosts(data).find(x => x.id === id);
    if (!p) return null;
    return {
      page: 'aktuality', title: p.title, desc: short(p.text, 155), body: `
<article class="wrap post">
  <a class="link-arrow back" href="/aktuality">← Zpět na aktuality</a>
  <p class="meta"><span class="tag tag-${e(p.type)}">${p.type === 'akce' ? 'Akce' : 'Aktualita'}</span> ${e(czDate(p.date))}</p>
  <h1>${e(p.title)}</h1>
  ${p.type === 'akce' && p.event_date ? `<p class="event-date">Termín: <strong>${e(p.event_date)}</strong></p>` : ''}
  ${p.image ? img(p.image, p.title, 'post-img') : ''}
  <div class="prose">${para(p.text)}</div>
  <div class="actions"><a class="btn btn-dark" href="${e(telHref(s.phone))}">Zeptat se: ${e(s.phone)}</a></div>
</article>`
    };
  }
  const t = url.searchParams.get('typ');
  const filter = t === 'akce' || t === 'aktualita' ? t : null;
  const posts = publishedPosts(data, filter);
  const f = (href, label, on) => `<a href="${href}"${on ? ' aria-current="page"' : ''}>${label}</a>`;
  return {
    page: 'aktuality', title: 'Aktuality a akce', desc: 'Novinky ze studia, změny rozvrhu a připravované akce.', body: `
<section class="wrap page-head">
  <p class="eyebrow">Aktuality a akce</p>
  <h1>Co se u nás děje</h1>
  <nav class="filters" aria-label="Filtr">
    ${f('/aktuality', 'Vše', !filter)}${f('/aktuality?typ=aktualita', 'Aktuality', filter === 'aktualita')}${f('/aktuality?typ=akce', 'Akce', filter === 'akce')}
  </nav>
</section>
<section class="wrap section-tight">
  ${posts.length ? `<div class="cards">${posts.map(postCard).join('')}</div>` : '<p class="empty">Zatím tu nic není.</p>'}
</section>`
  };
}

export function contact(data) {
  const s = data.site;
  const q = encodeURIComponent(s.address || '');
  return {
    page: 'kontakt', title: 'Kontakt', desc: 'Adresa, telefon a otevírací doba – ' + s.name + ', Brno.', body: `
<section class="wrap page-head">
  <p class="eyebrow">Kontakt</p>
  <h1>Kde nás najdete</h1>
</section>
<section class="wrap split contact">
  <div class="contact-info">
    <div><h4>Adresa</h4><p class="big">${e(s.address)}</p><p class="muted">Pár minut od centra Brna.</p></div>
    <div><h4>Telefon</h4><p class="big"><a href="${e(telHref(s.phone))}">${e(s.phone)}</a></p></div>
    <div><h4>E‑mail</h4><p class="big"><a href="mailto:${e(s.email)}">${e(s.email)}</a></p></div>
    <div><h4>Otevírací doba</h4>${hours(s)}</div>
    <div class="actions"><a class="btn btn-dark" href="${e(s.reservation_url)}" ${ext}>Rezervovat lekci</a></div>
  </div>
  <div class="map">
    <div class="map-ph">
      <p>${e(s.address)}</p>
      <button class="btn btn-dark" type="button" data-map-src="https://maps.google.com/maps?q=${q}&amp;z=16&amp;output=embed">Zobrazit mapu</button>
      <p class="small muted">Mapa se načte z Google Maps.<br><a href="https://mapy.com/?q=${q}" ${ext}>Otevřít v Mapy.com</a> · <a href="https://www.google.com/maps/search/?api=1&amp;query=${q}" ${ext}>Google Maps</a></p>
    </div>
  </div>
</section>`
  };
}

export function notFound() {
  return {
    page: '404', title: 'Stránka nenalezena', desc: '', body: `
<section class="wrap page-head" style="padding-bottom:120px">
  <p class="eyebrow">Chyba 404</p>
  <h1>Tahle stránka tu není.</h1>
  <p class="lead">Možná se změnila adresa. Zkuste to přes menu nahoře.</p>
  <div class="actions"><a class="btn btn-dark" href="/">Na úvod</a><a class="btn btn-line" href="/rozvrh">Rozvrh</a></div>
</section>`
  };
}

// ---------- administrace ----------
export function adminLogin(error = '') {
  return `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Administrace</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/admin/admin.css?v=${V}"></head>
<body><main class="login">
  <form method="post" action="/admin/login" class="login-box">
    <div class="logo-mark">MZ</div>
    <h1>Administrace webu</h1>
    <p class="muted">Fitness Gym Martiny Zábranské</p>
    ${error ? `<p class="err">${e(error)}</p>` : ''}
    <label>Heslo<input type="password" name="password" autofocus required autocomplete="current-password"></label>
    <button class="btn btn-dark" type="submit">Přihlásit se</button>
    <a class="muted small" href="/">← Zpět na web</a>
  </form>
</main></body></html>`;
}

export function adminApp(data, csrf, defaultPassword) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
  return `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Administrace – Fitness Gym Martiny Zábranské</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/admin/admin.css?v=${V}"></head>
<body>
  <header class="bar">
    <div class="bar-left"><span class="logo-mark sm">MZ</span><strong>Administrace</strong></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="bar-right">
      <span id="status" class="status"></span>
      <button id="save" class="btn btn-dark" disabled>Uložit změny</button>
      <a class="btn btn-line" href="/" target="_blank">Web ↗</a>
      <a class="btn btn-line" href="/admin/api/export" title="Stáhnout zálohu obsahu">Záloha</a>
      <a class="btn btn-line" href="/admin/logout">Odhlásit</a>
    </div>
  </header>
  ${defaultPassword ? '<div class="warn">Používáte výchozí heslo. Změňte ho prosím v záložce <a href="#heslo">Heslo</a>.</div>' : ''}
  <main id="app" class="app"></main>
  <script>window.ADMIN = { data: ${json}, csrf: ${JSON.stringify(csrf)} };</script>
  <script src="/admin/admin.js?v=${V}"></script>
</body></html>`;
}
