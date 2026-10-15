const View = {
  cam: { x: 0, y: 0, s: 40 },
  W: 0,
  H: 0,
  dpr: 1,
  hover: -1,
  pending: false,
  saveTimer: 0,

  init() {
    this.cv = $('#board');
    this.ctx = this.cv.getContext('2d');
    new ResizeObserver(() => this.resize()).observe($('.stage'));
    this.resize();
    this.bindPointer();
    this.bindKeys();
    $('#zoomIn').onclick = () => this.zoomAt(this.W / 2, this.H / 2, 1.3);
    $('#zoomOut').onclick = () => this.zoomAt(this.W / 2, this.H / 2, 1 / 1.3);
    $('#fitBtn').onclick = () => this.fitAll();
    $('#focusBtn').onclick = () => this.focusCurrent();
    $('#targetBtn').onclick = () => this.gotoTarget();
    this.mini = $('#minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.bindMinimap();
  },

  centerCell() {
    return [this.cam.y + this.H / 2 / this.cam.s, this.cam.x + this.W / 2 / this.cam.s];
  },

  gotoTarget() {
    if (!Game.isMap()) return this.focusCurrent();
    const g = Game.nextTarget();
    if (!g) return;
    this.showRect(g.r, g.c, 9, 9);
    Render.flash([g.gi], 'target');
  },

  miniLayout() {
    const b = Game.map;
    const w = Math.round(Math.min(240, Math.max(120, this.W * 0.32)));
    const h = Math.round((w * b.rows) / b.cols);
    return { w, h, k: w / b.cols };
  },

  bindMinimap() {
    let dragging = false;
    const move = e => {
      const rect = this.mini.getBoundingClientRect();
      const { k } = this.miniLayout();
      const c = (e.clientX - rect.left) / k, r = (e.clientY - rect.top) / k;
      this.cam.x = c - this.W / 2 / this.cam.s;
      this.cam.y = r - this.H / 2 / this.cam.s;
      this.changed();
    };
    this.mini.addEventListener('pointerdown', e => {
      dragging = true;
      this.mini.setPointerCapture(e.pointerId);
      move(e);
    });
    this.mini.addEventListener('pointermove', e => dragging && move(e));
    const stop = () => (dragging = false);
    this.mini.addEventListener('pointerup', stop);
    this.mini.addEventListener('pointercancel', stop);
  },

  drawMinimap() {
    const show = Game.isMap() && this.W > 0;
    this.mini.hidden = !show;
    if (!show) return;
    const { w, h, k } = this.miniLayout();
    const W = Math.round(w * this.dpr), H = Math.round(h * this.dpr);
    if (this.mini.width !== W || this.mini.height !== H) {
      this.mini.width = W;
      this.mini.height = H;
      this.mini.style.width = `${w}px`;
      this.mini.style.height = `${h}px`;
    }
    Render.drawMinimap(this.miniCtx, k, w, h, this.dpr, this.cam, this.W, this.H);
  },

  resize() {
    const rect = $('.stage').getBoundingClientRect();
    const first = !this.W;
    this.dpr = window.devicePixelRatio || 1;
    if (!first) {
      this.cam.x += (this.W - rect.width) / 2 / this.cam.s;
      this.cam.y += (this.H - rect.height) / 2 / this.cam.s;
    }
    this.W = rect.width;
    this.H = rect.height;
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    if (first) this.restoreCamera();
    this.request();
  },

  request() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      if (!this.W || !this.H) return;
      Render.draw(this.ctx, this.cam, this.W, this.H, this.dpr);
      this.drawMinimap();
      if (Render.animating()) this.request();
    });
  },

  limits() {
    const b = Game.board;
    const fit = Math.min(this.W / (b.cols + 2), this.H / (b.rows + 2));
    return { min: Math.min(fit, 6), max: 140 };
  },

  clamp() {
    const b = Game.board, { min, max } = this.limits();
    this.cam.s = Math.min(max, Math.max(min, this.cam.s));
    const vw = this.W / this.cam.s, vh = this.H / this.cam.s;
    this.cam.x = Math.min(b.cols - vw * 0.2, Math.max(-vw * 0.8, this.cam.x));
    this.cam.y = Math.min(b.rows - vh * 0.2, Math.max(-vh * 0.8, this.cam.y));
  },

  changed() {
    this.clamp();
    this.request();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => store.set('cam.' + Game.mode, this.cam), 250);
  },

  showRect(r, c, h, w, fill = 0.85) {
    if (!this.W) return;
    this.cam.s = Math.min(this.W / w, this.H / h) * fill;
    this.cam.x = c + w / 2 - this.W / 2 / this.cam.s;
    this.cam.y = r + h / 2 - this.H / 2 / this.cam.s;
    this.changed();
  },

  fitAll() {
    const b = Game.board;
    this.showRect(0, 0, b.rows, b.cols, 0.95);
  },

  focusCurrent() {
    const b = Game.board;
    if (!Game.isMap()) return this.showRect(0, 0, 9, 9);
    const target = Game.sel >= 0 ? Game.sel : b.idx(b.regions[b.start].r + 4, b.regions[b.start].c + 4);
    const r = Math.floor(target / b.cols), c = target % b.cols;
    const g = Game.regionsOf(target).find(x => Game.status.visible[x.gi]) || b.regions[b.start];
    this.showRect(g.r, g.c, 9, 9);
    if (Game.sel >= 0) {
      this.cam.x = c + 0.5 - this.W / 2 / this.cam.s;
      this.cam.y = r + 0.5 - this.H / 2 / this.cam.s;
      this.changed();
    }
  },

  restoreCamera() {
    const saved = store.get('cam.' + Game.mode, null);
    if (saved && [saved.x, saved.y, saved.s].every(Number.isFinite)) {
      Object.assign(this.cam, saved);
      this.changed();
    } else this.focusCurrent();
  },

  zoomAt(sx, sy, f) {
    const wx = this.cam.x + sx / this.cam.s, wy = this.cam.y + sy / this.cam.s;
    const { min, max } = this.limits();
    this.cam.s = Math.min(max, Math.max(min, this.cam.s * f));
    this.cam.x = wx - sx / this.cam.s;
    this.cam.y = wy - sy / this.cam.s;
    this.changed();
  },

  cellAt(sx, sy) {
    const b = Game.board;
    const c = Math.floor(this.cam.x + sx / this.cam.s), r = Math.floor(this.cam.y + sy / this.cam.s);
    if (r < 0 || c < 0 || r >= b.rows || c >= b.cols) return -1;
    const i = r * b.cols + c;
    return b.exists[i] ? i : -1;
  },

  hoverRegions() {
    if (this.hover < 0) return [];
    return Game.regionsOf(this.hover).filter(g => Game.status.visible[g.gi] || Game.status.frontier[g.gi]);
  },

  setHover(i) {
    if (i === this.hover) return;
    this.hover = i;
    Panel.renderInfo();
    this.request();
  },

  bindPointer() {
    const cv = this.cv;
    const pts = new Map();
    let drag = null, pinch = null;
    const pos = e => {
      const rect = cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, pos(e));
      if (pts.size === 1) {
        const p = pos(e);
        drag = { x: p.x, y: p.y, cx: this.cam.x, cy: this.cam.y, moved: false };
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.cam.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cx: this.cam.x, cy: this.cam.y };
        drag = null;
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = pos(e);
      if (!pts.has(e.pointerId)) {
        if (e.pointerType === 'mouse') this.setHover(this.cellAt(p.x, p.y));
        return;
      }
      pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const wx = pinch.cx + pinch.mx / pinch.s, wy = pinch.cy + pinch.my / pinch.s;
        const { min, max } = this.limits();
        this.cam.s = Math.min(max, Math.max(min, (pinch.s * d) / Math.max(1, pinch.d)));
        this.cam.x = wx - mx / this.cam.s;
        this.cam.y = wy - my / this.cam.s;
        this.changed();
      } else if (drag) {
        const dx = p.x - drag.x, dy = p.y - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
        if (drag.moved) {
          this.cam.x = drag.cx - dx / this.cam.s;
          this.cam.y = drag.cy - dy / this.cam.s;
          this.changed();
        }
      }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      const p = pos(e);
      if (drag && !drag.moved && pts.size === 1 && e.type === 'pointerup') this.click(p.x, p.y);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!pts.size) drag = null;
      else if (pts.size === 1) {
        const q = [...pts.values()][0];
        drag = { x: q.x, y: q.y, cx: this.cam.x, cy: this.cam.y, moved: true };
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse' && !pts.size) this.setHover(-1);
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = pos(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.H : 1;
      const dx = e.deltaX * unit, dy = e.deltaY * unit;
      if (e.ctrlKey || e.deltaMode || (dx === 0 && Math.abs(dy) >= 40)) this.zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
      else {
        this.cam.x += dx / this.cam.s;
        this.cam.y += dy / this.cam.s;
        this.changed();
      }
    }, { passive: false });
  },

  click(x, y) {
    const i = this.cellAt(x, y);
    Panel.pin(i);
    Game.select(i);
  },

  bindKeys() {
    addEventListener('keydown', e => {
      if (typing() || dialogOpen()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        Game.undo(e.shiftKey);
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        Game.undo(true);
        return;
      }
      if (mod || e.altKey) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) {
        e.preventDefault();
        Game.input(Number(m[1]), e.shiftKey);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        Game.erase();
        return;
      }
      if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
        e.preventDefault();
        Panel.toggleNotes();
        return;
      }
      const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (dirs[e.key]) {
        e.preventDefault();
        this.move(...dirs[e.key]);
      }
    });
  },

  move(dr, dc) {
    const b = Game.board;
    if (Game.sel < 0) return this.focusCurrent();
    let r = Math.floor(Game.sel / b.cols), c = Game.sel % b.cols;
    for (let step = 0; step < 12; step++) {
      r += dr;
      c += dc;
      if (r < 0 || c < 0 || r >= b.rows || c >= b.cols) return;
      const i = r * b.cols + c;
      if (b.exists[i] && Game.status.cellVisible[i]) {
        Game.select(i);
        Panel.pin(i);
        this.ensureVisible(i);
        return;
      }
    }
  },

  ensureVisible(i) {
    const b = Game.board, r = Math.floor(i / b.cols), c = i % b.cols;
    const s = this.cam.s, sx = (c - this.cam.x) * s, sy = (r - this.cam.y) * s;
    if (sx >= s && sy >= s && sx <= this.W - 2 * s && sy <= this.H - 2 * s) return;
    this.cam.x = c + 0.5 - this.W / 2 / s;
    this.cam.y = r + 0.5 - this.H / 2 / s;
    this.changed();
  },
};
