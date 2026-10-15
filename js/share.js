const SITE_URL = 'https://cyberzhg.github.io/SudokuGrids/';
const share = { blob: null, url: '' };

function drawShareCard() {
  const C = Render.C;
  const b = Game.map;
  const vis = Game.computeVisibility(b, Game.done, Game.rules);
  const p = Game.load('map', b);
  const W = 1080, pad = 80;
  const cell = Math.floor((W - 2 * pad) / b.cols);
  const mapW = cell * b.cols, mapH = cell * b.rows;
  const top = 250, H = top + mapH + 360;
  const cv = el('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;
  const text = (s, x, y, size, fill, weight, align = 'left') => {
    g.font = font(size, weight);
    g.fillStyle = fill;
    g.textAlign = align;
    g.fillText(s, x, y);
  };
  const box = (x, y, w, h, r, fill, stroke) => {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 2;
      g.stroke();
    }
  };

  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  text(APP_NAME, pad, 140, 60, C.text, 700);
  text(dayKey(), pad, 195, 30, C.muted);

  const x0 = pad + Math.floor((W - 2 * pad - mapW) / 2);
  const colors = Render.cellColors(b, vis.visible);
  const frontier = new Uint8Array(b.n);
  for (const r of b.regions) if (vis.frontier[r.gi]) for (const i of r.cells) frontier[i] = 1;
  for (let i = 0; i < b.n; i++) {
    if (!b.exists[i]) continue;
    const r = Math.floor(i / b.cols), c = i % b.cols;
    let fill = frontier[i] ? C.frontier : C.fog;
    if (colors[i]) {
      const rgb = b.given[i] || p.values[i] ? colors[i].map(x => Math.min(255, x * Render.tone.filled)) : colors[i];
      fill = `rgb(${rgb.map(Math.round).join(',')})`;
    }
    g.fillStyle = fill;
    g.fillRect(x0 + c * cell, top + r * cell, cell - 1, cell - 1);
  }
  g.strokeStyle = C.bg;
  g.lineWidth = 2;
  for (const bx of b.boxes) g.strokeRect(x0 + bx.c * cell - 0.5, top + bx.r * cell - 0.5, 3 * cell, 3 * cell);

  const s = Game.stats();
  const items = [
    [t('share.regions'), `${s.regions} / ${s.regionsTotal}`],
    [t('share.rules'), `${s.rules} / ${s.rulesTotal}`],
    [t('share.cells'), `${Math.floor((100 * s.filled) / s.total)}%`],
  ];
  const tileW = (W - 2 * pad - 40) / 3, ty = top + mapH + 50;
  items.forEach(([label, value], k) => {
    const x = pad + k * (tileW + 20);
    box(x, ty, tileW, 150, 20, C.surface, C['box-line']);
    text(label, x + 28, ty + 52, 28, C.muted);
    text(value, x + 28, ty + 118, 50, C.text, 700);
  });
  g.fillStyle = C.line;
  g.fillRect(pad, H - 92, W - 2 * pad, 2);
  text(SITE_URL, pad, H - 40, 28, C.accent, 600);
  text(APP_NAME, W - pad, H - 40, 28, C.muted, 600, 'right');
  return cv;
}

async function openShare() {
  Achv.unlock('share');
  const cv = drawShareCard();
  share.blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  URL.revokeObjectURL(share.url);
  share.url = URL.createObjectURL(share.blob);
  $('#shareImg').src = share.url;
  const file = new File([share.blob], 'SudokuGrids.png', { type: 'image/png' });
  $('#shareSend').hidden = !navigator.canShare?.({ files: [file] });
  $('#shareDlg').showModal();
}

function bindShare() {
  $('#shareBtn').onclick = openShare;
  $('#shareClose').onclick = () => $('#shareDlg').close();
  $('#shareSave').onclick = () => {
    const a = el('a', { href: share.url, download: `SudokuGrids-${dayKey()}.png` });
    a.click();
  };
  $('#shareSend').onclick = async () => {
    try {
      await navigator.share({ files: [new File([share.blob], `SudokuGrids-${dayKey()}.png`, { type: 'image/png' })], title: APP_NAME, url: SITE_URL });
    } catch {}
  };
}
