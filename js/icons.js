const svg = (body, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v3M8 20h8l-1-3H9z"/>'),
  sliders: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>'),
  share: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  fit: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  erase: svg('<path d="M20 20H9l-5-5 10-10 7 7-6 6"/><path d="m7 12 6 6"/>'),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
};

const ruleSvg = body => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="1" style="stroke:var(--box-line)" stroke-width="1.5"/>${body}</svg>`;
const thin = 'style="stroke:var(--line)" stroke-width="1"';

const RULE_ICONS = {
  classic: ruleSvg(`<path d="M8.8 2.5v19M15.2 2.5v19M2.5 8.8h19M2.5 15.2h19" ${thin}/>`),
  diagonal: ruleSvg('<path d="M2.5 2.5l19 19M21.5 2.5l-19 19" style="stroke:var(--diag)" stroke-width="1.6"/>'),
  antiKing: ruleSvg(`<path d="M8.8 2.5v19M15.2 2.5v19M2.5 8.8h19M2.5 15.2h19" ${thin}/><rect x="8.8" y="8.8" width="6.4" height="6.4" style="fill:var(--accent)"/><path d="M4 4l3.4 3.4M7.4 4L4 7.4M16.6 4l3.4 3.4M20 4l-3.4 3.4M4 16.6l3.4 3.4M7.4 16.6L4 20M16.6 16.6l3.4 3.4M20 16.6l-3.4 3.4" style="stroke:var(--danger)" stroke-width="1.4"/>`),
  antiKnight: ruleSvg(`<circle cx="7" cy="17" r="2.4" style="fill:var(--accent)"/><path d="M7 17V7h5" style="stroke:var(--muted)" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M15 5l3.4 3.4M18.4 5L15 8.4" style="stroke:var(--danger)" stroke-width="1.6"/>`),
  windoku: ruleSvg('<rect x="5" y="5" width="6" height="6" style="fill:var(--clue)"/><rect x="13" y="5" width="6" height="6" style="fill:var(--clue)"/><rect x="5" y="13" width="6" height="6" style="fill:var(--clue)"/><rect x="13" y="13" width="6" height="6" style="fill:var(--clue)"/>'),
  consecutive: ruleSvg(`<path d="M12 2.5v19" ${thin}/><circle cx="12" cy="12" r="3" style="fill:var(--dot-white);stroke:var(--dot-edge)" stroke-width="1.5"/>`),
  double: ruleSvg(`<path d="M12 2.5v19" ${thin}/><circle cx="12" cy="12" r="3" style="fill:var(--dot-black);stroke:var(--dot-edge)" stroke-width="1.5"/>`),
  xv: ruleSvg(`<path d="M12 2.5v19" ${thin}/><path d="M9.5 6.5l5 5M14.5 6.5l-5 5" style="stroke:var(--text)" stroke-width="1.8"/><path d="M9.5 13.5l2.5 5 2.5-5" style="stroke:var(--text)" stroke-width="1.8"/>`),
  greater: ruleSvg(`<path d="M12 2.5v19" ${thin}/><path d="M14 8l-4 4 4 4" style="stroke:var(--text)" stroke-width="2"/>`),
  parity: ruleSvg('<rect x="4.5" y="7.5" width="7" height="7" rx="1" style="fill:var(--clue)"/><circle cx="16" cy="11" r="3.8" style="fill:var(--clue)"/>'),
  thermo: ruleSvg('<path d="M7 17V7h10" style="stroke:var(--clue)" stroke-width="3.2"/><circle cx="7" cy="17" r="3.4" style="fill:var(--clue)"/>'),
  arrow: ruleSvg('<circle cx="7" cy="17" r="3.4" style="stroke:var(--clue)" stroke-width="1.6"/><path d="M9.4 14.6 17.5 6.5M13 6.5h4.5V11" style="stroke:var(--clue)" stroke-width="1.6"/>'),
  killer: ruleSvg('<rect x="5" y="5" width="14" height="14" style="stroke:var(--text)" stroke-width="1.2" stroke-dasharray="2 1.6"/><text x="6.5" y="11" font-size="5.5" font-family="system-ui, sans-serif" style="fill:var(--text)">15</text>'),
  palindrome: ruleSvg('<path d="M5 17V9h7v8h7V7" style="stroke:var(--palindrome)" stroke-width="2.6"/><path d="M5 17V9h7v8h7V7" style="stroke:var(--line-pattern)" stroke-width="0.8" stroke-dasharray="1.2 1.2"/>'),
  whisper: ruleSvg('<path d="M5 17V9h7v8h7V7" style="stroke:var(--whisper)" stroke-width="2.6"/><path d="M5 17V9h7v8h7V7" style="stroke:var(--line-pattern)" stroke-width="0.8" stroke-dasharray="3 1.4"/>'),
  renban: ruleSvg('<path d="M5 17V9h7v8h7V7" style="stroke:var(--renban)" stroke-width="2.6"/>'),
  disjoint: ruleSvg(`<path d="M8.8 2.5v19M15.2 2.5v19M2.5 8.8h19M2.5 15.2h19" ${thin}/><rect x="3.5" y="3.5" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="9.8" y="3.5" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="16.2" y="3.5" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="3.5" y="9.8" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="9.8" y="9.8" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="16.2" y="9.8" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="3.5" y="16.2" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="9.8" y="16.2" width="2.6" height="2.6" style="fill:var(--accent)"/><rect x="16.2" y="16.2" width="2.6" height="2.6" style="fill:var(--accent)"/>`),
  antiConsecutive: ruleSvg(`<path d="M12 2.5v19" ${thin}/><text x="7.2" y="14.5" text-anchor="middle" font-size="7" font-family="system-ui, sans-serif" style="fill:var(--text)">4</text><text x="16.8" y="14.5" text-anchor="middle" font-size="7" font-family="system-ui, sans-serif" style="fill:var(--text)">5</text><path d="M10 9.5l4 5M14 9.5l-4 5" style="stroke:var(--danger)" stroke-width="1.6"/>`),
  between: ruleSvg('<path d="M8.5 15.5 15.5 8.5" style="stroke:var(--between)" stroke-width="1.8"/><circle cx="6.5" cy="17.5" r="2.8" style="stroke:var(--between)" stroke-width="1.6"/><circle cx="17.5" cy="6.5" r="2.8" style="stroke:var(--between)" stroke-width="1.6"/>'),
  quadruple: ruleSvg(`<path d="M12 2.5v19M2.5 12h19" ${thin}/><circle cx="12" cy="12" r="5.2" style="fill:var(--dot-white);stroke:var(--dot-edge)" stroke-width="1.2"/><text x="12" y="14.2" text-anchor="middle" font-size="5.6" font-weight="600" font-family="system-ui, sans-serif" style="fill:#1d2129">12</text>`),
  entropic: ruleSvg('<path d="M5 17V9h7v8h7V7" style="stroke:var(--entropic)" stroke-width="2.6"/><path d="M5 17V9h7v8h7V7" style="stroke:var(--line-pattern)" stroke-width="0.8" stroke-dasharray="0.01 1.6"/>'),
  modular: ruleSvg('<path d="M5 17V9h7v8h7V7" style="stroke:var(--modular)" stroke-width="2.6"/><path d="M5 17V9h7v8h7V7" style="stroke:var(--line-pattern)" stroke-width="0.8" stroke-dasharray="2.4 1 0.01 1"/>'),
  zipper: ruleSvg('<path d="M5 17V9h7v8h7V7" style="stroke:var(--zipper)" stroke-width="2.6"/><path d="M5 17V9h7v8h7V7" style="stroke:var(--line-pattern)" stroke-width="0.8" stroke-dasharray="0.01 0.9 0.01 2.4"/>'),
  regionSum: ruleSvg(`<path d="M12 2.5v19" style="stroke:var(--box-line)" stroke-width="1.2"/><path d="M5 17V9h14v8" style="stroke:var(--regionSum)" stroke-width="2.6"/><path d="M5 17V9h14v8" style="stroke:var(--line-pattern)" stroke-width="0.8"/>`),
  unknown: ruleSvg('<text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="700" font-family="system-ui, sans-serif" style="fill:var(--muted)">?</text>'),
};

function applyIcons() {
  for (const node of $$('[data-icon]')) node.innerHTML = ICONS[node.dataset.icon] || '';
}
