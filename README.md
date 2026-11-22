# Web – Fitness Gym Martiny Zábranské (Cloudflare)

Web běží zdarma na Cloudflare Workers. Platí se jen doména.

- **Stránky:** Úvod, O nás, Rozvrh, Ceník, Aktuality a akce, Kontakt
- **Administrace:** `/admin/`. Výchozí heslo je `zabranska2026`, **hned po prvním přihlášení ho změňte** (záložka Heslo).
- Obsah z administrace (ceník, rozvrh, aktuality, fotky…) je uložený na Cloudflaru (KV úložiště), **ne v Gitu**.
  Push do GitHubu tedy nikdy nepřepíše, co Martina změnila v adminu.
- V adminu je tlačítko **Záloha**, které stáhne veškerý obsah jako soubor. Občas si ji stáhněte.

## Zprovoznění (jednorázově)

1. Účet zdarma na **dash.cloudflare.com**.
2. **Storage & databases → Workers KV → Create instance**, název `mz-data` → zkopírovat **ID**.
3. V GitHubu otevřít `wrangler.jsonc` → tužka (Edit) → `SEM_VLOZ_ID` nahradit zkopírovaným ID → Commit.
4. **Workers & Pages → Create → Import a repository** → připojit GitHub → vybrat repo → **Deploy** (nic neměnit).
5. Otevřít adresu `…workers.dev`, kterou Cloudflare ukáže → zkontrolovat web → `/admin/` → změnit heslo.

## Připojení domény

6. Cloudflare → **Add a domain** → zadat doménu → plán **Free**.
7. Cloudflare ukáže **2 nameservery**. U registrátora domény (např. vedos.cz) je nastavit jako DNS servery domény.
8. Až Cloudflare hlásí doménu jako aktivní (minuty až 24 h): **Workers & Pages → fitness-gym-mz → Settings → Domains & Routes → Add → Custom domain** → `vasedomena.cz`, a ještě jednou pro `www.vasedomena.cz`.

⚠️ Pokud na doméně běží e-mail (např. martina@…), je před krokem 7 potřeba vyřešit poštu, jinak přestane chodit.

## Úpravy kódu

Každý push do větve `main` se na Cloudflare nasadí automaticky (za ~1 minutu).
Lokálně: `npm install` a pak `npm run dev`.

## Struktura

- `src/worker.js`: směrování, přihlášení, API administrace, fotky
- `src/render.js`: HTML šablony stránek
- `src/seed.js`: výchozí obsah (použije se, dokud se v adminu poprvé neuloží)
- `public/`: CSS, JS, administrace a výchozí fotky
