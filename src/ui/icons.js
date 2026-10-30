// İnce çizgili SVG simgeler (currentColor) ve birkaç renkli kaynak simgesi.

const svg = (body, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const line = (d, w = 1.9) => svg(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);

export const ICONS = {
  wood: svg(`
    <rect x="2.5" y="8" width="15" height="8.5" rx="4.2" fill="url(#kWood)"/>
    <path d="M6 11h6.5M7.5 13.8h5" stroke="#2a1a0e" stroke-width="1" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="17.6" cy="12.25" rx="3.6" ry="4.25" fill="url(#kEnd)" stroke="#4a2e18" stroke-width=".9"/>
    <ellipse cx="17.6" cy="12.25" rx="1.8" ry="2.2" fill="none" stroke="#8a6440" stroke-width=".8"/>`, 'color'),
  food: svg(`
    <path d="M5 9.5h14l-1.3 9.2a2.2 2.2 0 0 1-2.2 1.8H8.5a2.2 2.2 0 0 1-2.2-1.8z" fill="url(#kCan)"/>
    <rect x="4.4" y="7.4" width="15.2" height="2.6" rx="1.1" fill="#9aa0a6"/>
    <path d="M7 13.5h10" stroke="#5a1f1a" stroke-width="2.4"/>
    <circle cx="9" cy="5" r="1.6" fill="#5a2a52"/><circle cx="12" cy="4.2" r="1.6" fill="#6b3262"/><circle cx="15" cy="5" r="1.6" fill="#4a2244"/>`, 'color'),
  fire: svg(`<path d="M12 2.8c.6 3.2 4.8 5 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.4 1.2-3.8 2.2-5 .3 1.6 1 2.4 1.8 2.6-.4-3.2.2-5.6.8-7.6z" fill="currentColor"/>`),
  moon: line('M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z'),
  sun: line('M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4'),
  axe: line('M6 20.5l9.5-9.5M12.6 3.6c3.6-.3 7.2 2.6 7.4 7.2l-3.7.4-4.6-4.6z', 2),
  hammer: line('M14.5 4.5l5 5M12 7l5 5M16.8 2.2l5 5-2.6 2.6-5-5zM13 9.5L4 18.5a1.8 1.8 0 0 0 2.5 2.5l9-9'),
  shop: line('M4 20V9.5L12 4l8 5.5V20M9 20v-6h6v6M2.5 10.5L12 4l9.5 6.5', 1.9),
  info: line('M12 11v6M12 7.2v.1M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z'),
  up: line('M12 19V6M6.5 11.5L12 6l5.5 5.5'),
  check: line('M5 12.5l4.5 4.5L19 7.5', 2.6),
  close: line('M6 6l12 12M18 6L6 18', 2.4),
  gear: svg(`<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM19.4 13.5l1.6 1.2-1.8 3.2-1.9-.7a7.6 7.6 0 0 1-1.9 1.1l-.3 2H11l-.3-2a7.6 7.6 0 0 1-1.9-1.1l-1.9.7-1.8-3.2 1.6-1.2a7.4 7.4 0 0 1 0-2.9L5.1 9.3 6.9 6l1.9.7a7.6 7.6 0 0 1 1.9-1.1l.3-2h3.9l.3 2a7.6 7.6 0 0 1 1.9 1.1l1.9-.7 1.8 3.3-1.6 1.2a7.4 7.4 0 0 1 0 2.9z"/>`),
  move: line('M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3', 1.7),
  trash: line('M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5'),
  clock: line('M12 7v5l3 2M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19z'),
  lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/>`),
  heart: svg(`<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z" fill="currentColor"/>`),
  skull: svg(`<path d="M12 3a7.5 7.5 0 0 0-4.5 13.5V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2.5A7.5 7.5 0 0 0 12 3z" fill="currentColor"/><circle cx="9.2" cy="11.5" r="1.8" fill="#000" opacity=".75"/><circle cx="14.8" cy="11.5" r="1.8" fill="#000" opacity=".75"/><path d="M10.5 20v-2.5M13.5 20v-2.5" stroke="#000" stroke-width="1" opacity=".6"/>`),
  person: line('M12 11.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6zM4.5 20.5a7.5 7.5 0 0 1 15 0'),
  people: svg(`<circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0z" fill="currentColor"/><circle cx="16.8" cy="9" r="2.6" fill="currentColor" opacity=".55"/><path d="M15.8 13.3a5 5 0 0 1 5.6 6.2h-4.6" fill="currentColor" opacity=".55"/>`),
  flash: line('M8 3h8l-1.5 5h-5zM9.5 8l-.5 13h6l-.5-13M12 12v3', 1.8),
  trap: line('M4 14a8 8 0 0 0 16 0M4 14l2-3 2 3 2-3 2 3 2-3 2 3 2-3 2 3M12 22v-3', 1.7),
  warning: line('M12 3.5l9.5 16.5h-19zM12 10v4.5M12 17.2v.1', 2),
  shield: line('M12 3l8 3v6c0 5-3.6 8-8 9-4.4-1-8-4-8-9V6z'),
  tent: line('M2.5 20L12 4l9.5 16zM12 4v16M8.5 20l3.5-6 3.5 6'),
  sound: line('M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'),
  music: line('M9 17.5V5.5l10-2v12M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'),
  reset: line('M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5'),
  expand: line('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  skip: line('M5 5.5v13l8-6.5zM14 5.5v13l7-6.5z', 1.8),
  eye: line('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'),
  radio: line('M5 9h14v11H5zM8.5 9L17 3.5M8 13h4M8 16.5h4M16 14.8a1.8 1.8 0 1 1 0 .1'),
  scroll: line('M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 9h7M8.5 12.5h7M8.5 16h4'),
};

export const ICON_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="kWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6240"/><stop offset="1" stop-color="#4a3020"/></linearGradient>
<radialGradient id="kEnd" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#d9b88a"/><stop offset="1" stop-color="#a07a50"/></radialGradient>
<linearGradient id="kCan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a6e72"/><stop offset=".45" stop-color="#c8ccd0"/><stop offset="1" stop-color="#6a6e72"/></linearGradient>
</defs></svg>`;

export const icon = (name) => ICONS[name] ?? '';
