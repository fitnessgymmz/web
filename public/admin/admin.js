// Administrace webu – jednoduchý editor nad data.json
(() => {
  const D = window.ADMIN.data;
  const CSRF = window.ADMIN.csrf;
  const DAYS = ['', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
  const app = document.getElementById('app');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('status');
  let dirty = false;

  D.posts ??= []; D.schedule ??= []; D.pricing ??= []; D.pricing_notes ??= []; D.lessons ??= []; D.trainers ??= []; D.gallery ??= [];

  // ---------- helpers ----------
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    kids.flat().forEach(c => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const markDirty = () => { dirty = true; saveBtn.disabled = false; status('Neuložené změny', 'warn'); };
  const status = (t, cls = '') => { statusEl.textContent = t; statusEl.className = 'status ' + cls; };

  function field(label, obj, key, type = 'text', opts = {}) {
    let input;
    const onInput = e => {
      obj[key] = type === 'checkbox' ? e.target.checked : type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value;
      markDirty(); opts.onChange?.(obj[key]);
    };
    if (type === 'textarea') input = h('textarea', { rows: opts.rows || 5, oninput: onInput, placeholder: opts.placeholder || '' });
    else if (type === 'select') input = h('select', { onchange: onInput }, opts.options.map(([v, l]) => h('option', { value: v }, l)));
    else input = h('input', { type, oninput: onInput, onchange: type === 'checkbox' ? onInput : null, placeholder: opts.placeholder || '', list: opts.list || null });
    if (type === 'checkbox') input.checked = !!obj[key]; else input.value = obj[key] ?? '';
    if (type === 'checkbox') return h('label', { class: 'check' }, input, label);
    return h('label', { class: 'field ' + (opts.cls || '') }, h('span', {}, label), input, opts.hint ? h('small', {}, opts.hint) : null);
  }

  // Zmenší fotku z mobilu na max. 2000 px a převede na JPEG (rychlejší web, méně místa)
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Povolené formáty: JPG, PNG, WebP.');
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
      if (out && out.size < file.size) return out;
    } catch (_) {}
    if (file.size > 6 * 1024 * 1024) throw new Error('Obrázek je moc velký (max. 6 MB).');
    return file;
  }

  function imageField(label, obj, key) {
    const preview = h('div', { class: 'img-prev' });
    const paint = () => {
      preview.replaceChildren(obj[key] ? h('img', { src: (/^(https?:|\/)/.test(obj[key]) ? '' : '/') + obj[key], alt: '' }) : h('span', {}, 'bez obrázku'));
    };
    paint();
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      status('Zpracovávám obrázek…');
      try {
        const blob = await shrink(f);
        status('Nahrávám obrázek…');
        const r = await fetch('/admin/api/upload', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type, 'X-CSRF': CSRF } }).then(r => r.json());
        if (!r.ok) throw new Error(r.error);
        obj[key] = r.path; paint(); markDirty();
      } catch (err) { status(err.message || 'Chyba nahrávání', 'err'); }
      e.target.value = '';
    }});
    return h('div', { class: 'field img-field' }, h('span', {}, label), h('div', { class: 'img-row' }, preview,
      h('div', { class: 'img-btns' },
        h('button', { type: 'button', class: 'btn btn-line btn-sm', onclick: () => file.click() }, obj[key] ? 'Změnit' : 'Nahrát obrázek'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { obj[key] = ''; paint(); markDirty(); } }, 'Odebrat'),
        file)));
  }

  function listControls(arr, item, rerender) {
    const i = () => arr.indexOf(item);
    const move = d => { const k = i(), j = k + d; if (j < 0 || j >= arr.length) return; [arr[k], arr[j]] = [arr[j], arr[k]]; markDirty(); rerender(); };
    return h('div', { class: 'ctrl' },
      h('button', { type: 'button', title: 'Nahoru', onclick: () => move(-1) }, '↑'),
      h('button', { type: 'button', title: 'Dolů', onclick: () => move(1) }, '↓'),
      h('button', { type: 'button', title: 'Smazat', class: 'del', onclick: () => { if (confirm('Opravdu smazat?')) { arr.splice(i(), 1); markDirty(); rerender(); } } }, 'Smazat'));
  }

  const sectionHead = (title, desc, ...actions) => h('div', { class: 'sec-head' }, h('div', {}, h('h2', {}, title), desc ? h('p', { class: 'muted' }, desc) : null), h('div', { class: 'sec-actions' }, actions));

  // ---------- sections ----------
  const sections = {
    aktuality: { label: 'Aktuality a akce', render() {
      const wrap = h('div');
      const draw = () => {
        wrap.replaceChildren(sectionHead('Aktuality a akce', 'Novinky a akce se zobrazují od nejnovějšího data. Skryté příspěvky na webu nejsou vidět.',
          h('button', { class: 'btn btn-dark', onclick: () => { D.posts.unshift({ id: uid('p'), type: 'aktualita', title: 'Nový příspěvek', date: new Date().toISOString().slice(0, 10), event_date: '', text: '', image: '', published: true }); markDirty(); draw(); wrap.querySelector('details')?.setAttribute('open', ''); } }, '+ Nový příspěvek')));
        D.posts.forEach(p => {
          const sum = h('summary', {}, h('span', { class: 'tag ' + p.type }, p.type === 'akce' ? 'Akce' : 'Aktualita'), h('strong', {}, p.title || '(bez názvu)'), h('span', { class: 'muted' }, p.date), p.published ? null : h('span', { class: 'hidden-badge' }, 'skryto'));
          const evField = field('Termín akce (volný text)', p, 'event_date', 'text', { placeholder: 'např. 23.–25. 10. 2026' });
          evField.style.display = p.type === 'akce' ? '' : 'none';
          wrap.append(h('details', { class: 'item' }, sum, h('div', { class: 'item-body' },
            h('div', { class: 'grid g3' },
              field('Typ', p, 'type', 'select', { options: [['aktualita', 'Aktualita'], ['akce', 'Akce']], onChange: v => { evField.style.display = v === 'akce' ? '' : 'none'; } }),
              field('Datum zveřejnění', p, 'date', 'date'), evField),
            field('Nadpis', p, 'title'),
            field('Text', p, 'text', 'textarea', { rows: 7, hint: 'Odstavce oddělte prázdným řádkem.' }),
            imageField('Obrázek', p, 'image'),
            h('div', { class: 'row-between' }, field('Zobrazit na webu', p, 'published', 'checkbox'), listControls(D.posts, p, draw)))));
        });
      };
      draw(); return wrap;
    }},

    rozvrh: { label: 'Rozvrh', render() {
      const wrap = h('div');
      const lessonList = h('datalist', { id: 'dl-lessons' }, D.lessons.map(l => h('option', { value: l.name })));
      const trainerList = h('datalist', { id: 'dl-trainers' }, D.trainers.map(t => h('option', { value: t.name })));
      const draw = () => {
        wrap.replaceChildren(lessonList, trainerList, sectionHead('Rozvrh lekcí', `Kapacita: když ji necháte prázdnou, platí výchozích ${D.site.default_capacity || 10} osob (mění se v Základních info).`));
        for (let d = 1; d <= 7; d++) {
          const rows = D.schedule.filter(s => +s.day === d).sort((a, b) => a.start.localeCompare(b.start));
          const box = h('div', { class: 'day-box' }, h('h3', {}, DAYS[d], h('span', { class: 'muted' }, ` · ${rows.length} lekcí`)));
          if (rows.length) box.append(h('div', { class: 'sched-head' }, h('span', {}, 'Od'), h('span', {}, 'Do'), h('span', {}, 'Lekce'), h('span', {}, 'Lektor/ka'), h('span', {}, 'Kapacita'), h('span')));
          rows.forEach(s => {
            const inp = (key, type, extra = {}) => { const i = h('input', { type, value: s[key] ?? '', ...extra, oninput: e => { s[key] = type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value; markDirty(); } }); return i; };
            box.append(h('div', { class: 'sched-row' },
              inp('start', 'text', { placeholder: '17:00', pattern: '[0-2][0-9]:[0-5][0-9]', inputmode: 'numeric', maxlength: 5 }), inp('end', 'text', { placeholder: '17:55', pattern: '[0-2][0-9]:[0-5][0-9]', inputmode: 'numeric', maxlength: 5 }),
              inp('lesson', 'text', { list: 'dl-lessons', placeholder: 'Název lekce' }),
              inp('trainer', 'text', { list: 'dl-trainers', placeholder: 'nepovinné' }),
              inp('capacity', 'number', { min: 1, max: 50, placeholder: String(D.site.default_capacity || 10) }),
              h('button', { class: 'icon-del', title: 'Smazat', onclick: () => { D.schedule.splice(D.schedule.indexOf(s), 1); markDirty(); draw(); } }, '×')));
          });
          box.append(h('button', { class: 'btn btn-line btn-sm', onclick: () => {
            const last = rows[rows.length - 1];
            const toMin = t => { const [a, b] = (t || '16:55').split(':'); return +a * 60 + +b; };
            const fmt = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
            const start = last ? Math.ceil(toMin(last.end) / 5) * 5 + (toMin(last.end) % 60 === 55 ? 5 : 0) : 17 * 60;
            D.schedule.push({ id: uid('s'), day: d, start: fmt(start), end: fmt(start + 55), lesson: '', trainer: '', capacity: '' });
            markDirty(); draw();
          } }, '+ Přidat lekci'));
          wrap.append(box);
        }
      };
      draw(); return wrap;
    }},

    cenik: { label: 'Ceník', render() {
      const wrap = h('div');
      const draw = () => {
        wrap.replaceChildren(sectionHead('Ceník', 'Skupiny cen (např. Cvičení, Wellness Karta) a jejich položky.',
          h('button', { class: 'btn btn-dark', onclick: () => { D.pricing.push({ title: 'Nová skupina', note: '', items: [] }); markDirty(); draw(); } }, '+ Nová skupina')));
        D.pricing.forEach(g => {
          const items = h('div', { class: 'price-items' });
          const drawItems = () => {
            items.replaceChildren(h('div', { class: 'price-head-row' }, h('span', {}, 'Položka'), h('span', {}, 'Doplněk (např. navíc 10 %)'), h('span', {}, 'Cena'), h('span')));
            g.items.forEach(it => items.append(h('div', { class: 'price-row' },
              h('input', { value: it.label, placeholder: 'Název', oninput: e => { it.label = e.target.value; markDirty(); } }),
              h('input', { value: it.sub || '', placeholder: 'nepovinné', oninput: e => { it.sub = e.target.value; markDirty(); } }),
              h('input', { value: it.price, placeholder: '200 Kč', oninput: e => { it.price = e.target.value; markDirty(); } }),
              listControls(g.items, it, drawItems))));
            items.append(h('button', { class: 'btn btn-line btn-sm', onclick: () => { g.items.push({ label: '', sub: '', price: '' }); markDirty(); drawItems(); } }, '+ Přidat položku'));
          };
          drawItems();
          wrap.append(h('div', { class: 'card' },
            h('div', { class: 'grid g2' }, field('Název skupiny', g, 'title'), field('Poznámka pod nadpisem', g, 'note')),
            items, h('div', { class: 'row-end' }, listControls(D.pricing, g, draw))));
        });
        // poznámky
        const notes = h('div', { class: 'card' }, h('h3', {}, 'Poznámky pod ceníkem'), h('p', { class: 'muted' }, 'Např. studentská sleva, Multisport.'));
        D.pricing_notes.forEach((n, i) => notes.append(h('div', { class: 'note-row' },
          h('input', { value: n, oninput: e => { D.pricing_notes[i] = e.target.value; markDirty(); } }),
          h('button', { class: 'icon-del', onclick: () => { D.pricing_notes.splice(i, 1); markDirty(); draw(); } }, '×'))));
        notes.append(h('button', { class: 'btn btn-line btn-sm', onclick: () => { D.pricing_notes.push(''); markDirty(); draw(); } }, '+ Přidat poznámku'));
        wrap.append(notes);
      };
      draw(); return wrap;
    }},

    lektorky: { label: 'Lektorky', render() {
      const wrap = h('div');
      const draw = () => {
        wrap.replaceChildren(sectionHead('Lektorky', 'Zobrazují se na stránce O nás.',
          h('button', { class: 'btn btn-dark', onclick: () => { D.trainers.push({ id: uid('t'), name: '', role: 'Lektorka', bio: '', photo: '' }); markDirty(); draw(); } }, '+ Přidat lektorku')));
        D.trainers.forEach(t => wrap.append(h('div', { class: 'card' },
          h('div', { class: 'grid g2' }, field('Jméno', t, 'name'), field('Role', t, 'role', 'text', { placeholder: 'Lektorka pilates' })),
          field('Krátké představení', t, 'bio', 'textarea', { rows: 4 }),
          imageField('Fotka (ideálně na výšku)', t, 'photo'),
          h('div', { class: 'row-end' }, listControls(D.trainers, t, draw)))));
      };
      draw(); return wrap;
    }},

    lekce: { label: 'Druhy lekcí', render() {
      const wrap = h('div');
      const draw = () => {
        wrap.replaceChildren(sectionHead('Druhy lekcí', 'Popisy lekcí na stránce Rozvrh. Názvy se nabízejí i při úpravě rozvrhu.',
          h('button', { class: 'btn btn-dark', onclick: () => { D.lessons.push({ name: '', desc: '' }); markDirty(); draw(); } }, '+ Přidat lekci')));
        D.lessons.forEach(l => wrap.append(h('div', { class: 'card' },
          field('Název', l, 'name'), field('Popis', l, 'desc', 'textarea', { rows: 3 }),
          h('div', { class: 'row-end' }, listControls(D.lessons, l, draw)))));
      };
      draw(); return wrap;
    }},

    galerie: { label: 'Galerie', render() {
      const wrap = h('div');
      const draw = () => {
        wrap.replaceChildren(sectionHead('Galerie studia', 'Fotky na stránce O nás. Pořadí měníte šipkami.',
          h('button', { class: 'btn btn-dark', onclick: () => { D.gallery.push({ image: '', caption: '' }); markDirty(); draw(); } }, '+ Přidat fotku')));
        D.gallery.forEach(g => wrap.append(h('div', { class: 'card' },
          h('div', { class: 'grid g2' }, imageField('Fotka', g, 'image'), field('Popisek', g, 'caption', 'text', { placeholder: 'např. Kardio zóna' })),
          h('div', { class: 'row-end' }, listControls(D.gallery, g, draw)))));
      };
      draw(); return wrap;
    }},

    info: { label: 'Základní info', render() {
      const s = D.site; s.hours ??= [];
      const hours = h('div');
      const drawHours = () => {
        hours.replaceChildren(h('h3', {}, 'Otevírací doba'));
        s.hours.forEach(x => hours.append(h('div', { class: 'note-row two' },
          h('input', { value: x.days, placeholder: 'Pondělí – Pátek', oninput: e => { x.days = e.target.value; markDirty(); } }),
          h('input', { value: x.time, placeholder: '8:00 – 20:00', oninput: e => { x.time = e.target.value; markDirty(); } }),
          h('button', { class: 'icon-del', onclick: () => { s.hours.splice(s.hours.indexOf(x), 1); markDirty(); drawHours(); } }, '×'))));
        hours.append(h('button', { class: 'btn btn-line btn-sm', onclick: () => { s.hours.push({ days: '', time: '' }); markDirty(); drawHours(); } }, '+ Přidat řádek'));
      };
      drawHours();
      return h('div', {}, sectionHead('Základní informace', 'Kontakty, texty a hlavní fotky webu.'),
        h('div', { class: 'card' }, h('h3', {}, 'Kontakt'),
          h('div', { class: 'grid g2' }, field('Název', s, 'name'), field('Adresa', s, 'address'), field('Telefon', s, 'phone'), field('E‑mail', s, 'email'), field('IČO', s, 'ico'),
            field('Výchozí kapacita lekce', s, 'default_capacity', 'number', { hint: 'Zobrazuje se na webu jako „max X lidí“.' })),
          field('Odkaz na rezervační systém', s, 'reservation_url', 'url'),
          h('div', { class: 'grid g2' }, field('Facebook (URL)', s, 'facebook', 'url'), field('Instagram (URL)', s, 'instagram', 'url'))),
        h('div', { class: 'card' }, hours),
        h('div', { class: 'card' }, h('h3', {}, 'Texty'),
          field('Krátký popis (patička, vyhledávače)', s, 'tagline'),
          field('Nadpis stránky O nás', s, 'about_title'),
          field('Text O nás', s, 'about_text', 'textarea', { rows: 8, hint: 'Odstavce oddělte prázdným řádkem.' }),
          field('Text o pronájmu studia', s, 'rental_text', 'textarea', { rows: 4 })),
        h('div', { class: 'card' }, h('h3', {}, 'Fotky'),
          h('div', { class: 'grid g2' }, imageField('Hlavní fotka (úvod)', s, 'hero_image'), imageField('Fotka studia (O nás)', s, 'about_image'), imageField('Fotka u pronájmu (úvod)', s, 'rental_image'))));
    }},

    heslo: { label: 'Heslo', render() {
      const f = { old: '', new: '', new2: '' };
      const msg = h('p', { class: 'muted' });
      return h('div', {}, sectionHead('Změna hesla', 'Heslo do administrace. Doporučujeme aspoň 10 znaků.'),
        h('div', { class: 'card narrow' },
          h('label', { class: 'field' }, h('span', {}, 'Současné heslo'), h('input', { type: 'password', autocomplete: 'current-password', oninput: e => f.old = e.target.value })),
          h('label', { class: 'field' }, h('span', {}, 'Nové heslo'), h('input', { type: 'password', autocomplete: 'new-password', oninput: e => f.new = e.target.value })),
          h('label', { class: 'field' }, h('span', {}, 'Nové heslo znovu'), h('input', { type: 'password', autocomplete: 'new-password', oninput: e => f.new2 = e.target.value })),
          h('button', { class: 'btn btn-dark', onclick: async () => {
            if (f.new !== f.new2) { msg.textContent = 'Nová hesla se neshodují.'; msg.className = 'err'; return; }
            const r = await api('password', { old: f.old, new: f.new });
            msg.textContent = r.ok ? 'Heslo bylo změněno.' : r.error; msg.className = r.ok ? 'ok' : 'err';
            if (r.ok) { document.querySelector('.warn')?.remove(); if (!dirty) setTimeout(() => location.reload(), 1200); else msg.textContent += ' Uložte rozdělané změny a obnovte stránku.'; }
          } }, 'Změnit heslo'), msg));
    }},
  };

  async function api(action, body) {
    try {
      const r = await fetch('/admin/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF }, body: JSON.stringify(body) });
      if (r.status === 401) { alert('Byli jste odhlášeni. Přihlaste se znovu (změny si předtím zkopírujte).'); }
      return await r.json();
    } catch { return { ok: false, error: 'Chyba spojení se serverem.' }; }
  }

  // ---------- tabs & save ----------
  const tabs = document.getElementById('tabs');
  function show(key) {
    if (!sections[key]) key = 'aktuality';
    tabs.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.k === key));
    app.replaceChildren(sections[key].render());
    if (location.hash !== '#' + key) history.replaceState(null, '', '#' + key);
    scrollTo(0, 0);
  }
  Object.entries(sections).forEach(([k, s]) => tabs.append(h('a', { href: '#' + k, 'data-k': k, onclick: e => { e.preventDefault(); show(k); } }, s.label)));
  addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));

  async function save() {
    saveBtn.disabled = true; status('Ukládám…');
    const r = await api('save', D);
    if (r.ok) { dirty = false; status('Uloženo ✓', 'ok'); }
    else { saveBtn.disabled = false; status(r.error || 'Chyba při ukládání', 'err'); }
  }
  saveBtn.addEventListener('click', save);
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty) save(); } });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
