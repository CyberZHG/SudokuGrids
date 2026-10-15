const FONT = 'system-ui, -apple-system, "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Microsoft YaHei", "Yu Gothic UI", "Malgun Gothic", sans-serif';
const COLOR_NAMES = ['bg', 'surface', 'text', 'muted', 'accent', 'danger', 'cell', 'fog', 'fog-edge', 'frontier', 'line', 'box-line', 'entry', 'hl-peer', 'hl-same', 'hl-sel', 'hl-conflict', 'clue', 'shade', 'diag', 'whisper', 'renban', 'palindrome', 'between', 'entropic', 'modular', 'zipper', 'regionSum', 'dot-white', 'dot-black', 'dot-edge', 'line-pattern', 'mini-fog', 'flash-done', 'flash-new', 'ok'];

const LINE_PATTERNS = {
  palindrome: [0.12, 0.12],
  whisper: [0.3, 0.14],
  entropic: [0.001, 0.14],
  modular: [0.24, 0.1, 0.001, 0.1],
  zipper: [0.001, 0.08, 0.001, 0.24],
  regionSum: [],
};

const FLASH_MS = 1400;

const ruleHue = r => (360 * RULE_ORDER.indexOf(r)) / RULE_ORDER.length;

function hslRgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255));
}

const Render = {
  C: {},
  effects: [],

  flash(gis, kind) {
    const now = performance.now();
    for (const gi of gis) this.effects.push({ gi, kind, start: now, board: Game.board });
    View.request();
  },

  animating() {
    const now = performance.now();
    this.effects = this.effects.filter(e => now - e.start < FLASH_MS);
    return this.effects.length > 0;
  },

  drawEffects(ctx, X, Y, s) {
    const now = performance.now();
    for (const e of this.effects) {
      if (e.board !== Game.board) continue;
      const g = Game.board.regions[e.gi];
      const t = Math.min(1, (now - e.start) / FLASH_MS);
      const color = e.kind === 'done' ? this.C['flash-done'] : this.C['flash-new'];
      ctx.globalAlpha = 0.35 * Math.sin(Math.PI * t);
      ctx.fillStyle = color;
      ctx.fillRect(X(g.c), Y(g.r), 9 * s, 9 * s);
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.strokeRect(X(g.c), Y(g.r), 9 * s, 9 * s);
      ctx.globalAlpha = 1;
    }
  },

  drawMinimap(ctx, k, w, h, dpr, cam, W, H) {
    const C = this.C, b = Game.map, st = Game.status;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const fills = this.baseFills();
    for (const box of b.boxes) {
      const i = box.r * b.cols + box.c;
      let fill = fills[i];
      if (!fill) fill = box.regions.some(gi => st.frontier[gi]) ? C.muted : C['mini-fog'];
      ctx.fillStyle = fill;
      ctx.fillRect(box.c * k, box.r * k, 3 * k + 0.4, 3 * k + 0.4);
      if (box.regions.some(gi => st.done[gi])) {
        ctx.fillStyle = C['flash-done'];
        ctx.globalAlpha = 0.45;
        ctx.fillRect(box.c * k, box.r * k, 3 * k + 0.4, 3 * k + 0.4);
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cam.x * k, cam.y * k, (W / cam.s) * k, (H / cam.s) * k);
  },
  tone: { sat: 0.4, light: 0.92, overlap: 0.96, filled: 0.86, jitter: 0.02 },
  fills: null,
  fillsFor: null,

  loadColors() {
    const css = getComputedStyle(document.documentElement);
    for (const name of COLOR_NAMES) this.C[name] = css.getPropertyValue('--' + name).trim();
    for (const k of Object.keys(this.tone)) {
      const v = parseFloat(css.getPropertyValue('--region-' + k));
      if (Number.isFinite(v)) this.tone[k] = v;
    }
    this.fills = null;
  },

  regionRgb(g) {
    const light = this.tone.light + ((g.id % 3) - 1) * this.tone.jitter;
    if (!g.rules.length) return hslRgb(0, 0, light);
    let x = 0, y = 0;
    for (const r of g.rules) {
      const a = (ruleHue(r) * Math.PI) / 180;
      x += Math.cos(a);
      y += Math.sin(a);
    }
    const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const spread = Math.hypot(x, y) / g.rules.length;
    return hslRgb(hue, this.tone.sat * (0.55 + 0.45 * spread), light);
  },

  cellColors(b, visible) {
    const out = new Array(b.n).fill(null);
    const rgb = b.regions.map(g => this.regionRgb(g));
    for (let i = 0; i < b.n; i++) {
      if (!b.exists[i]) continue;
      const own = b.cellRegions[i].filter(gi => visible[gi]);
      if (!own.length) continue;
      const mix = [0, 1, 2].map(k => own.reduce((sum, gi) => sum + rgb[gi][k], 0) / own.length);
      out[i] = own.length > 1 ? mix.map(x => Math.min(255, x * this.tone.overlap)) : mix;
    }
    return out;
  },

  baseFills() {
    const b = Game.board, st = Game.status;
    if (this.fills && this.fillsFor === st) return this.fills;
    this.fills = this.cellColors(b, st.visible).map(c => (c ? `rgb(${c.map(Math.round).join(',')})` : null));
    this.fillsFor = st;
    return this.fills;
  },

  draw(ctx, cam, W, H, dpr) {
    const C = this.C, b = Game.board, st = Game.status, p = Game.cur();
    const s = cam.s;
    const X = c => (c - cam.x) * s;
    const Y = r => (r - cam.y) * s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const r0 = Math.max(0, Math.floor(cam.y)), r1 = Math.min(b.rows, Math.ceil(cam.y + H / s));
    const c0 = Math.max(0, Math.floor(cam.x)), c1 = Math.min(b.cols, Math.ceil(cam.x + W / s));
    const inView = g => g.r < r1 && g.r + 9 > r0 && g.c < c1 && g.c + 9 > c0;
    const sel = Game.sel, selVal = sel >= 0 ? Game.value(sel) : 0;
    const wrong = i => settings.autoCheck && !b.given[i] && p.values[i] && p.values[i] !== b.sol[i];

    const fills = this.baseFills();
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const i = r * b.cols + c;
        if (!b.exists[i]) continue;
        const x = X(c), y = Y(r);
        if (!st.cellVisible[i]) {
          ctx.fillStyle = st.cellFrontier[i] ? C.frontier : C.fog;
          ctx.fillRect(x, y, s + 0.6, s + 0.6);
          continue;
        }
        ctx.fillStyle = fills[i];
        ctx.fillRect(x, y, s + 0.6, s + 0.6);
        let over = st.cellShade[i] ? C.shade : null;
        if (over) {
          ctx.fillStyle = over;
          ctx.fillRect(x, y, s + 0.6, s + 0.6);
        }
        if (i === sel) over = C['hl-sel'];
        else if (Game.conflicts.has(i) || wrong(i)) over = C['hl-conflict'];
        else if (selVal && Game.value(i) === selVal) over = C['hl-same'];
        else if (Game.peers.has(i)) over = C['hl-peer'];
        else continue;
        ctx.fillStyle = over;
        ctx.fillRect(x, y, s + 0.6, s + 0.6);
      }
    }

    const visibleRegions = b.regions.filter(g => st.visible[g.gi] && inView(g));
    if (s >= 7) {
      ctx.beginPath();
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const i = r * b.cols + c;
          if (b.exists[i] && st.cellVisible[i]) ctx.rect(X(c), Y(r), s, s);
        }
      }
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (s >= 7) for (const g of visibleRegions) for (const k of g.clues) this.cellClue(ctx, k, X, Y, s);

    ctx.beginPath();
    const fogBoxes = new Path2D();
    for (const box of b.boxes) {
      if (box.r >= r1 || box.r + 3 <= r0 || box.c >= c1 || box.c + 3 <= c0) continue;
      if (box.regions.some(gi => st.visible[gi])) ctx.rect(X(box.c), Y(box.r), 3 * s, 3 * s);
      else fogBoxes.rect(X(box.c), Y(box.r), 3 * s, 3 * s);
    }
    ctx.strokeStyle = C['box-line'];
    ctx.lineWidth = Math.max(1.2, Math.min(3, s * 0.06));
    ctx.stroke();
    ctx.strokeStyle = C['fog-edge'];
    ctx.lineWidth = 1;
    ctx.stroke(fogBoxes);

    for (const g of visibleRegions) {
      if (!g.rules.includes('diagonal')) continue;
      ctx.beginPath();
      ctx.moveTo(X(g.c), Y(g.r));
      ctx.lineTo(X(g.c + 9), Y(g.r + 9));
      ctx.moveTo(X(g.c + 9), Y(g.r));
      ctx.lineTo(X(g.c), Y(g.r + 9));
      ctx.strokeStyle = C.diag;
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.stroke();
    }

    if (s >= 7) for (const g of visibleRegions) for (const k of g.clues) this.edgeClue(ctx, k, X, Y, s);

    for (const g of b.regions) {
      if (!st.frontier[g.gi] || !inView(g)) continue;
      ctx.setLineDash([Math.max(3, s * 0.2), Math.max(3, s * 0.15)]);
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.strokeRect(X(g.c) + 1, Y(g.r) + 1, 9 * s - 2, 9 * s - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = C.muted;
      ctx.font = `600 ${Math.round(s * 1.6)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', X(g.c + 4.5), Y(g.r + 4.6));
    }

    if (s >= 12) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const big = `${Math.round(s * 0.62)}px ${FONT}`, bigBold = `600 ${Math.round(s * 0.62)}px ${FONT}`, small = `${Math.max(7, Math.round(s * 0.24))}px ${FONT}`;
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const i = r * b.cols + c;
          if (!b.exists[i] || !st.cellVisible[i]) continue;
          const v = Game.value(i);
          if (v) {
            ctx.font = b.given[i] ? bigBold : big;
            ctx.fillStyle = b.given[i] ? C.text : Game.conflicts.has(i) || wrong(i) ? C.danger : C.entry;
            ctx.fillText(v, X(c + 0.5), Y(r + 0.55));
          } else if (p.notes[i] && s >= 22) {
            ctx.font = small;
            ctx.fillStyle = C.muted;
            for (let d = 1; d <= 9; d++) {
              if (!(p.notes[i] & bitOf(d))) continue;
              ctx.fillText(d, X(c + 0.2 + ((d - 1) % 3) * 0.3), Y(r + 0.22 + Math.floor((d - 1) / 3) * 0.3));
            }
          }
        }
      }
    }

    for (const g of View.hoverRegions()) {
      if (!inView(g)) continue;
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = Math.max(2, Math.min(4, s * 0.08));
      ctx.strokeRect(X(g.c), Y(g.r), 9 * s, 9 * s);
    }
    this.drawEffects(ctx, X, Y, s);
  },

  center(k, i, X, Y) {
    const [r, c] = k.cells[i];
    return [X(c + 0.5), Y(r + 0.5)];
  },

  polyline(ctx, k, X, Y) {
    ctx.beginPath();
    k.cells.forEach((_, i) => {
      const [x, y] = this.center(k, i, X, Y);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
  },

  cellClue(ctx, k, X, Y, s) {
    const C = this.C;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (k.type) {
      case 'even': {
        const [x, y] = this.center(k, 0, X, Y);
        ctx.fillStyle = C.clue;
        ctx.fillRect(x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.72);
        break;
      }
      case 'odd': {
        const [x, y] = this.center(k, 0, X, Y);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = C.clue;
        ctx.fill();
        break;
      }
      case 'thermo': {
        this.polyline(ctx, k, X, Y);
        ctx.strokeStyle = C.clue;
        ctx.lineWidth = s * 0.3;
        ctx.stroke();
        const [x, y] = this.center(k, 0, X, Y);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = C.clue;
        ctx.fill();
        break;
      }
      case 'palindrome': case 'whisper': case 'renban': case 'entropic': case 'modular': case 'zipper': case 'regionSum': {
        this.polyline(ctx, k, X, Y);
        ctx.strokeStyle = C[k.type];
        ctx.lineWidth = s * 0.24;
        ctx.stroke();
        const pattern = LINE_PATTERNS[k.type];
        if (pattern) {
          ctx.setLineDash(pattern.map(x => x * s));
          ctx.strokeStyle = C['line-pattern'];
          ctx.lineWidth = s * 0.07;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case 'between': {
        this.polyline(ctx, k, X, Y);
        ctx.strokeStyle = C.between;
        ctx.lineWidth = s * 0.14;
        ctx.stroke();
        const fills = this.baseFills();
        for (const i of [0, k.cells.length - 1]) {
          const [x, y] = this.center(k, i, X, Y);
          const [r, c] = k.cells[i];
          ctx.beginPath();
          ctx.arc(x, y, s * 0.38, 0, Math.PI * 2);
          ctx.fillStyle = fills[r * Game.board.cols + c] || C.cell;
          ctx.fill();
          ctx.strokeStyle = C.between;
          ctx.lineWidth = Math.max(1.5, s * 0.07);
          ctx.stroke();
        }
        break;
      }
      case 'arrow': {
        const pts = k.cells.map((_, i) => this.center(k, i, X, Y));
        const [x0, y0] = pts[0];
        const rad = s * 0.38;
        ctx.strokeStyle = C.clue;
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath();
        ctx.arc(x0, y0, rad, 0, Math.PI * 2);
        ctx.stroke();
        const [x1, y1] = pts[1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        ctx.beginPath();
        ctx.moveTo(x0 + ((x1 - x0) / len) * rad, y0 + ((y1 - y0) / len) * rad);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]);
        ctx.stroke();
        const [xa, ya] = pts[pts.length - 2], [xb, yb] = pts[pts.length - 1];
        const ang = Math.atan2(yb - ya, xb - xa), h = s * 0.22;
        ctx.beginPath();
        ctx.moveTo(xb - h * Math.cos(ang - 0.6), yb - h * Math.sin(ang - 0.6));
        ctx.lineTo(xb, yb);
        ctx.lineTo(xb - h * Math.cos(ang + 0.6), yb - h * Math.sin(ang + 0.6));
        ctx.stroke();
        break;
      }
      case 'killer':
        this.cage(ctx, k, X, Y, s);
        break;
    }
  },

  cage(ctx, k, X, Y, s) {
    const C = this.C;
    const inCage = new Set(k.cells.map(([r, c]) => r * 1000 + c));
    const has = (r, c) => inCage.has(r * 1000 + c);
    const d = 0.1;
    ctx.beginPath();
    const sides = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [r, c] of k.cells) {
      for (const [dr, dc] of sides) {
        if (has(r + dr, c + dc)) continue;
        const tr = dc, tc = -dr;
        const ends = [-1, 1].map(sign => {
          const ar = r + sign * tr, ac = c + sign * tc;
          if (!has(ar, ac)) return 0.5 - d;
          return has(ar + dr, ac + dc) ? 0.5 + d : 0.5;
        });
        const cr = r + 0.5 + dr * (0.5 - d), cc = c + 0.5 + dc * (0.5 - d);
        ctx.moveTo(X(cc - tc * ends[0]), Y(cr - tr * ends[0]));
        ctx.lineTo(X(cc + tc * ends[1]), Y(cr + tr * ends[1]));
      }
    }
    ctx.setLineDash([Math.max(2, s * 0.08), Math.max(2, s * 0.07)]);
    ctx.strokeStyle = C.text;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.stroke();
    ctx.setLineDash([]);
    const [r, c] = k.cells[0];
    const fs = Math.max(8, Math.round(s * 0.24));
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(k.sum).width;
    const i = r * Game.board.cols + c;
    ctx.fillStyle = this.baseFills()[i] || C.cell;
    ctx.fillRect(X(c + 0.04), Y(r + 0.04), w + 3, fs + 1);
    if (Game.status.cellShade[i]) {
      ctx.fillStyle = C.shade;
      ctx.fillRect(X(c + 0.04), Y(r + 0.04), w + 3, fs + 1);
    }
    ctx.fillStyle = C.text;
    ctx.fillText(k.sum, X(c + 0.04) + 1.5, Y(r + 0.04) + 1);
  },

  edgeClue(ctx, k, X, Y, s) {
    const C = this.C;
    if (k.type === 'quad') {
      const [r, c] = k.cells[3];
      const x = X(c), y = Y(r), rad = s * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = C['dot-white'];
      ctx.fill();
      ctx.strokeStyle = C['dot-edge'];
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.stroke();
      const fs = Math.max(6, Math.round(s * (k.digits.length > 2 ? 0.2 : 0.24)));
      ctx.font = `600 ${fs}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1d2129';
      const pos = k.digits.length > 2 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 0], [1, 0]];
      k.digits.forEach((d, i) => ctx.fillText(d, x + pos[i][0] * rad * 0.42, y + pos[i][1] * rad * 0.42 + 0.5));
      return;
    }
    if (!['white', 'black', 'x', 'v', 'gt'].includes(k.type)) return;
    const [[ra, ca], [rb, cb]] = k.cells;
    const x = X((ca + cb) / 2 + 0.5), y = Y((ra + rb) / 2 + 0.5);
    if (k.type === 'white' || k.type === 'black') {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = k.type === 'white' ? C['dot-white'] : C['dot-black'];
      ctx.fill();
      ctx.strokeStyle = C['dot-edge'];
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.stroke();
    } else if (k.type === 'x' || k.type === 'v') {
      const fs = Math.round(s * 0.4);
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = C.cell;
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.strokeText(k.type.toUpperCase(), x, y + fs * 0.05);
      ctx.fillStyle = C.text;
      ctx.fillText(k.type.toUpperCase(), x, y + fs * 0.05);
    } else {
      const dx = cb - ca, dy = rb - ra, h = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(x - dx * h + dy * h * 1.3, y - dy * h + dx * h * 1.3);
      ctx.lineTo(x + dx * h, y + dy * h);
      ctx.lineTo(x - dx * h - dy * h * 1.3, y - dy * h - dx * h * 1.3);
      ctx.strokeStyle = C.text;
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  },
};
