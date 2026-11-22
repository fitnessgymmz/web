// Mobilní menu, stín hlavičky, záložky dnů v rozvrhu
(() => {
  const toggle = document.querySelector('.nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open);
  });
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  document.querySelectorAll('.day-tabs button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.day-tabs button').forEach(b => b.setAttribute('aria-selected', b === btn));
    document.querySelectorAll('.week .day').forEach(d => d.classList.toggle('is-active', d.dataset.day === btn.dataset.day));
  }));

  document.querySelectorAll('[data-map-src]').forEach(btn => btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = btn.dataset.mapSrc; f.title = 'Mapa'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    btn.closest('.map-ph').replaceWith(f);
  }));
})();
