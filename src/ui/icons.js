// SF Symbols ruhunda çizilmiş SVG simgeler. Kaynak simgeleri (altın, kereste) renkli,
// arayüz simgeleri tek renk (currentColor).

const svg = (body, vb = '0 0 24 24', cls = '') =>
  `<svg class="ico ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

const line = (d, w = 2.2) =>
  svg(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);

export const ICONS = {
  gold: svg(`
    <ellipse cx="12" cy="13.2" rx="9.2" ry="8.8" fill="#C27A12"/>
    <circle cx="12" cy="12" r="9" fill="url(#gC)"/>
    <circle cx="12" cy="12" r="6.4" fill="none" stroke="#E5A21F" stroke-width="1.4"/>
    <path d="M12 7.6l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#FFF6CF" opacity=".95"/>
  `, '0 0 24 24', 'color'),
  wood: svg(`
    <rect x="3" y="7" width="15" height="10" rx="5" fill="url(#wB)"/>
    <path d="M6 10.2h7M7.5 13.6h6" stroke="#6A4022" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="17.6" cy="12" rx="3.6" ry="5" fill="url(#wE)" stroke="#8A5A33" stroke-width="1"/>
    <ellipse cx="17.6" cy="12" rx="1.9" ry="2.7" fill="none" stroke="#B8834F" stroke-width=".9"/>
    <circle cx="17.6" cy="12" r=".7" fill="#8A5A33"/>
  `, '0 0 24 24', 'color'),
  xp: svg(`
    <path d="M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="url(#xS)" stroke="#1F5FB8" stroke-width="1" stroke-linejoin="round"/>
  `, '0 0 24 24', 'color'),
  builder: svg(`
    <path d="M4.5 14a7.5 7.5 0 0 1 15 0z" fill="#FFD640" stroke="#D9A010" stroke-width="1.2"/>
    <rect x="3" y="13.6" width="18" height="3" rx="1.5" fill="#F2B90F"/>
    <path d="M10.6 6.8h2.8v6.4h-2.8z" fill="#FFE68A"/>
  `, '0 0 24 24', 'color'),
  hammer: line('M14.5 4.5l5 5M12 7l5 5M16.8 2.2l5 5-2.6 2.6-5-5zM13 9.5L4 18.5a1.8 1.8 0 0 0 2.5 2.5l9-9'),
  shop: svg(`
    <path d="M4 10.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z" fill="currentColor" opacity=".25"/>
    <path d="M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  info: line('M12 11v6M12 7.2v.1M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z'),
  up: line('M12 19V6M6.5 11.5L12 6l5.5 5.5'),
  check: line('M5 12.5l4.5 4.5L19 7.5', 2.8),
  close: line('M6 6l12 12M18 6L6 18', 2.6),
  gear: svg(`<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM19.4 13.5l1.6 1.2-1.8 3.2-1.9-.7a7.6 7.6 0 0 1-1.9 1.1l-.3 2H11l-.3-2a7.6 7.6 0 0 1-1.9-1.1l-1.9.7-1.8-3.2 1.6-1.2a7.4 7.4 0 0 1 0-2.9L5.1 9.3 6.9 6l1.9.7a7.6 7.6 0 0 1 1.9-1.1l.3-2h3.9l.3 2a7.6 7.6 0 0 1 1.9 1.1l1.9-.7 1.8 3.3-1.6 1.2a7.4 7.4 0 0 1 0 2.9z"/>`),
  move: line('M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3', 1.9),
  trash: line('M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5'),
  axe: line('M5 20L15 10M13.5 4.5c3.5-.5 6 2 6 6l-3.2.3-3.6-3.6z', 2),
  bolt: svg(`<path d="M13.2 2.5L5 13.5h6l-1.2 8 8.2-11h-6z" fill="currentColor"/>`),
  clock: line('M12 7v5l3 2M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z'),
  lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>`),
  scroll: svg(`
    <path d="M6 4h11a3 3 0 0 1 3 3v0H9v11a3 3 0 0 1-6 0v-1h3z" fill="#F7E3B4" stroke="#B88A4A" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M9 7h11v10a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3z" fill="#FFF1CF" stroke="#B88A4A" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M11.5 11h6M11.5 14h4.5" stroke="#B88A4A" stroke-width="1.3" stroke-linecap="round"/>
  `, '0 0 24 24', 'color'),
  gift: svg(`<path d="M4 11h16v9.5H4z" fill="#FF6B6B"/><path d="M3 7.5h18V11H3z" fill="#FF8787"/><path d="M11 7.5h2v13h-2z" fill="#FFD640"/><path d="M12 7.5C10 4 7 4.5 7.5 6.5S12 7.5 12 7.5s4-1 4.5-1S14 4 12 7.5z" fill="none" stroke="#FFD640" stroke-width="1.6"/>`, '0 0 24 24', 'color'),
  sound: line('M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'),
  music: line('M9 17.5V5.5l10-2v12M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'),
  reset: line('M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5'),
  expand: line('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  people: svg(`<circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0z" fill="currentColor"/><circle cx="16.8" cy="9" r="2.6" fill="currentColor" opacity=".6"/><path d="M15.8 13.3a5 5 0 0 1 5.6 6.2h-4.6" fill="currentColor" opacity=".6"/>`),
  box: line('M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9'),
  plus: line('M12 5v14M5 12h14', 2.6),
  minus: line('M5 12h14', 2.6),
};

// Degrade tanımları belgede bir kez, görünür (display:none olmayan) bir SVG içinde durur.
export const ICON_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="gC" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".45" stop-color="#FFC93D"/><stop offset="1" stop-color="#E0911A"/></radialGradient>
<linearGradient id="wB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B57A45"/><stop offset="1" stop-color="#7C4F2A"/></linearGradient>
      <radialGradient id="wE" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#F6D3A0"/><stop offset="1" stop-color="#D9A266"/></radialGradient>
<linearGradient id="xS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FD3FF"/><stop offset="1" stop-color="#2F7FE0"/></linearGradient>
</defs></svg>`;

export const icon = (name) => ICONS[name] ?? '';

export const RES_ICON = { gold: ICONS.gold, wood: ICONS.wood, xp: ICONS.xp };
