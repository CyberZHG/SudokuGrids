const bitOf = d => 1 << d;

function buildBoard(def) {
  const { rows, cols } = def;
  const n = rows * cols;
  const sol = new Uint8Array(n), given = new Uint8Array(n), exists = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    sol[i] = Number(def.solution[i]);
    given[i] = def.givens[i] === '1' ? 1 : 0;
    exists[i] = sol[i] ? 1 : 0;
  }
  const idx = (r, c) => r * cols + c;
  const cellRegions = Array.from({ length: n }, () => []);
  const regions = def.regions.map((g, gi) => {
    const cells = Model.regionCells(g).map(([r, c]) => idx(r, c));
    for (const i of cells) cellRegions[i].push(gi);
    return {
      id: g.id,
      gi,
      r: g.r,
      c: g.c,
      rules: g.rules,
      cells,
      units: Model.units(g).map(u => u.map(([r, c]) => idx(r, c))),
      basic: Model.units({ r: g.r, c: g.c, rules: [] }).map(u => u.map(([r, c]) => idx(r, c))),
      pairs: Model.pairs(g).map(([p, q]) => [idx(...p), idx(...q)]),
      apart: Model.nonConsecutive(g).map(([p, q]) => [idx(...p), idx(...q)]),
      clues: (g.clues || []).map(k => ({ ...k, idx: k.cells.map(([r, c]) => idx(r, c)) })),
    };
  });
  const overlaps = regions.map(a => regions.filter(b => b !== a && Math.abs(a.r - b.r) < 9 && Math.abs(a.c - b.c) < 9).map(b => b.gi));
  const boxMap = new Map();
  for (const g of regions) {
    for (let i = 0; i < 9; i += 3) {
      for (let j = 0; j < 9; j += 3) {
        const key = idx(g.r + i, g.c + j);
        if (!boxMap.has(key)) boxMap.set(key, { r: g.r + i, c: g.c + j, regions: [] });
        boxMap.get(key).regions.push(g.gi);
      }
    }
  }
  return { rows, cols, n, sol, given, exists, regions, cellRegions, overlaps, boxes: [...boxMap.values()], idx, start: def.start || 0 };
}

const Game = {
  map: null,
  bossBoards: {},
  mode: 'map',
  board: null,
  progress: {},
  done: new Set(),
  rules: new Set(),
  won: new Set(),
  sel: -1,
  notesMode: false,
  history: {},
  status: null,
  conflicts: new Set(),
  peers: new Set(),
  listeners: [],

  init() {
    const sig = `${PUZZLES.seed}:${PUZZLES.map.rows}x${PUZZLES.map.cols}:${PUZZLES.map.regions.length}:${PUZZLES.map.solution.length}`;
    if (store.get('data', null) !== sig) {
      const seenHelp = store.get('seenHelp', false);
      store.clear();
      store.set('settings', settings);
      store.set('seenHelp', seenHelp);
      store.set('data', sig);
    }
    this.map = buildBoard(PUZZLES.map);
    for (const b of PUZZLES.bosses) {
      this.bossBoards[b.rule] = buildBoard({ rows: 9, cols: 9, solution: b.solution, givens: b.givens, regions: [{ id: 0, r: 0, c: 0, rules: [b.rule], clues: b.clues }] });
    }
    this.done = new Set(store.get('done', []));
    this.rules = new Set(store.get('rules', []).filter(r => RULE_IDS.includes(r)));
    this.won = new Set(store.get('won', []).filter(r => RULE_IDS.includes(r)));
    this.practice = store.get('practice', null);
    this.practiceDone = store.get('practiceDone', false);
    if (this.practice) this.practiceBoard = this.practiceToBoard(this.practice);
    const mode = store.get('mode', 'map');
    this.setMode(mode === 'map' || this.bossBoards[mode] || (mode === 'practice' && this.practiceBoard) ? mode : 'map');
  },

  practiceToBoard(pz) {
    return buildBoard({ rows: 9, cols: 9, solution: pz.solution, givens: pz.givens, regions: [{ id: 0, r: 0, c: 0, rules: pz.rules, clues: pz.clues }] });
  },

  startPractice(pz) {
    this.practice = pz;
    this.practiceBoard = this.practiceToBoard(pz);
    this.practiceDone = false;
    store.set('practice', pz);
    store.set('practiceDone', false);
    store.set('progress.practice', null);
    store.set('sel.practice', -1);
    delete this.progress.practice;
    this.history.practice = { undo: [], redo: [] };
    if (this.mode === 'practice') this.board = null;
    this.setMode('practice');
  },

  onChange(fn) {
    this.listeners.push(fn);
  },

  emit(kind, data) {
    for (const fn of this.listeners) fn(kind, data);
  },

  isMap() {
    return this.mode === 'map';
  },

  isPractice() {
    return this.mode === 'practice';
  },

  isBoss() {
    return !this.isMap() && !this.isPractice();
  },

  load(key, board) {
    if (this.progress[key]) return this.progress[key];
    const saved = store.get('progress.' + key, null);
    const values = new Uint8Array(board.n), notes = new Uint16Array(board.n);
    if (saved && typeof saved.v === 'string' && saved.v.length === board.n) {
      for (let i = 0; i < board.n; i++) if (board.exists[i] && !board.given[i]) values[i] = Number(saved.v[i]) || 0;
      for (const [i, m] of saved.n || []) if (i >= 0 && i < board.n && board.exists[i]) notes[i] = m & 0x3fe;
    }
    return (this.progress[key] = { values, notes, sel: store.get('sel.' + key, -1) });
  },

  save() {
    const p = this.cur();
    const notes = [];
    p.notes.forEach((m, i) => m && notes.push([i, m]));
    store.set('progress.' + this.mode, { v: p.values.join(''), n: notes });
    store.set('sel.' + this.mode, this.sel);
  },

  cur() {
    return this.progress[this.mode];
  },

  setMode(mode) {
    if (this.board) {
      this.cur().sel = this.sel;
      store.set('sel.' + this.mode, this.sel);
    }
    this.mode = mode;
    store.set('mode', mode);
    this.board = mode === 'map' ? this.map : mode === 'practice' ? this.practiceBoard : this.bossBoards[mode];
    const p = this.load(mode, this.board);
    this.history[mode] ||= { undo: [], redo: [] };
    this.refreshStatus();
    this.sel = p.sel >= 0 && p.sel < this.board.n && this.status.cellVisible[p.sel] ? p.sel : -1;
    this.refreshPeers();
    this.refreshConflicts();
    this.emit('mode');
  },

  value(i) {
    const b = this.board;
    return b.given[i] ? b.sol[i] : this.cur().values[i];
  },

  computeVisibility(board, done, rules) {
    const nR = board.regions.length;
    const visible = new Uint8Array(nR), frontier = new Uint8Array(nR);
    if (board !== this.map) {
      visible.fill(1);
      return { visible, frontier };
    }
    for (const g of board.regions) {
      const near = board.overlaps[g.gi].some(o => done.has(board.regions[o].id));
      if (g.gi === board.start || done.has(g.id) || (near && g.rules.every(r => rules.has(r)))) visible[g.gi] = 1;
      else if (near) frontier[g.gi] = 1;
    }
    return { visible, frontier };
  },

  refreshStatus() {
    const b = this.board;
    const { visible, frontier } = this.computeVisibility(b, this.done, this.rules);
    const doneR = new Uint8Array(b.regions.length);
    for (const g of b.regions) doneR[g.gi] = this.isMap() ? (this.done.has(g.id) ? 1 : 0) : this.isPractice() ? (this.practiceDone ? 1 : 0) : this.won.has(this.mode) ? 1 : 0;
    const cellVisible = new Uint8Array(b.n), cellFrontier = new Uint8Array(b.n), cellDone = new Uint8Array(b.n), cellShade = new Uint8Array(b.n);
    for (const g of b.regions) {
      for (const i of g.cells) {
        if (visible[g.gi]) cellVisible[i] = 1;
        if (frontier[g.gi]) cellFrontier[i] = 1;
        if (doneR[g.gi]) cellDone[i] = 1;
      }
      if (visible[g.gi] && g.rules.includes('windoku')) for (const u of g.units.slice(-4)) for (const i of u) cellShade[i] = 1;
    }
    this.status = { visible, frontier, done: doneR, cellVisible, cellFrontier, cellDone, cellShade };
  },

  trials() {
    if (!this.isMap()) return [];
    const out = new Set();
    this.map.regions.forEach(g => {
      if (!this.status.frontier[g.gi]) return;
      for (const r of g.rules) if (!this.rules.has(r)) out.add(r);
    });
    return RULE_IDS.filter(r => out.has(r));
  },

  canEdit(i) {
    const b = this.board, st = this.status;
    return i >= 0 && b.exists[i] && st.cellVisible[i] && !b.given[i] && !st.cellDone[i];
  },

  regionsOf(i) {
    return i >= 0 ? this.board.cellRegions[i].map(gi => this.board.regions[gi]) : [];
  },

  select(i) {
    this.sel = i >= 0 && this.board.exists[i] && this.status.cellVisible[i] ? i : -1;
    this.refreshPeers();
    store.set('sel.' + this.mode, this.sel);
    this.emit('select');
  },

  refreshPeers() {
    this.peers = new Set();
    if (this.sel < 0) return;
    for (const g of this.regionsOf(this.sel)) {
      if (!this.status.visible[g.gi]) continue;
      for (const u of g.basic) if (u.includes(this.sel)) for (const j of u) this.peers.add(j);
    }
  },

  visiblePeers(i) {
    const out = new Set();
    for (const g of this.regionsOf(i)) {
      if (!this.status.visible[g.gi]) continue;
      for (const u of g.units) if (u.includes(i)) for (const j of u) if (j !== i) out.add(j);
      for (const [p, q] of g.pairs) {
        if (p === i) out.add(q);
        if (q === i) out.add(p);
      }
    }
    return out;
  },

  refreshConflicts() {
    const b = this.board, st = this.status, out = new Set();
    for (const g of b.regions) {
      if (!st.visible[g.gi]) continue;
      for (const u of g.units) {
        const seen = new Map();
        for (const i of u) {
          const v = this.value(i);
          if (!v) continue;
          if (seen.has(v)) {
            out.add(i);
            out.add(seen.get(v));
          } else seen.set(v, i);
        }
      }
      for (const [p, q] of g.pairs) {
        const v = this.value(p);
        if (v && v === this.value(q)) {
          out.add(p);
          out.add(q);
        }
      }
      for (const [p, q] of g.apart) {
        const v = this.value(p), w = this.value(q);
        if (v && w && Math.abs(v - w) === 1) {
          out.add(p);
          out.add(q);
        }
      }
      for (const k of g.clues) {
        if (!Model.check(k, k.idx.map(i => this.value(i)))) for (const i of k.idx) if (!b.given[i]) out.add(i);
      }
    }
    this.conflicts = out;
  },

  apply(changes, dir) {
    const p = this.cur();
    for (const ch of changes) {
      const [i, ov, on, nv, nn] = ch;
      p.values[i] = dir === 'undo' ? ov : nv;
      p.notes[i] = dir === 'undo' ? on : nn;
    }
  },

  commit(changes) {
    if (!changes.length) return;
    const h = this.history[this.mode];
    h.undo.push(changes);
    if (h.undo.length > 500) h.undo.shift();
    h.redo = [];
    this.apply(changes, 'redo');
    this.afterChange(changes.map(c => c[0]));
  },

  input(d, asNote) {
    const i = this.sel;
    if (!this.canEdit(i)) return;
    const p = this.cur();
    const changes = [];
    const change = (j, nv, nn) => {
      if (p.values[j] !== nv || p.notes[j] !== nn) changes.push([j, p.values[j], p.notes[j], nv, nn]);
    };
    if (asNote || this.notesMode) {
      if (p.values[i]) return;
      change(i, 0, p.notes[i] ^ bitOf(d));
    } else if (p.values[i] === d) {
      change(i, 0, p.notes[i]);
    } else {
      change(i, d, 0);
      for (const j of this.visiblePeers(i)) if (p.notes[j] & bitOf(d) && !p.values[j]) change(j, p.values[j], p.notes[j] & ~bitOf(d));
    }
    this.commit(changes);
  },

  erase() {
    const i = this.sel;
    if (!this.canEdit(i)) return;
    const p = this.cur();
    if (p.values[i]) this.commit([[i, p.values[i], p.notes[i], 0, p.notes[i]]]);
    else if (p.notes[i]) this.commit([[i, 0, p.notes[i], 0, 0]]);
  },

  undo(redo) {
    const h = this.history[this.mode];
    const changes = (redo ? h.redo : h.undo).pop();
    if (!changes) return;
    (redo ? h.undo : h.redo).push(changes);
    this.apply(changes, redo ? 'redo' : 'undo');
    this.afterChange(changes.map(c => c[0]));
  },

  afterChange(cells) {
    this.save();
    this.refreshConflicts();
    if (this.isMap()) this.checkRegions(cells);
    else if (this.isPractice()) this.checkPractice();
    else this.checkBoss();
    this.emit('values');
  },

  regionSolved(g) {
    return g.cells.every(i => this.value(i) === this.board.sol[i]);
  },

  regionFull(g) {
    return g.cells.every(i => this.value(i));
  },

  checkRegions(cells) {
    const b = this.map, touched = new Set();
    for (const i of cells) for (const gi of b.cellRegions[i]) touched.add(gi);
    const completed = [];
    for (const gi of touched) {
      const g = b.regions[gi];
      if (!this.status.visible[gi] || this.done.has(g.id)) continue;
      if (this.regionSolved(g)) completed.push(g);
      else if (this.regionFull(g)) toast(t('toast.filledWrong', { n: g.id + 1 }));
    }
    if (!completed.length) return;
    const before = this.status;
    const trialsBefore = new Set(this.trials());
    for (const g of completed) {
      this.done.add(g.id);
      toast(t('toast.regionDone', { n: g.id + 1 }));
    }
    store.set('done', [...this.done]);
    this.refreshStatus();
    const revealed = this.reportReveal(before);
    this.emit('flash', { done: completed.map(g => g.gi), revealed });
    for (const r of this.trials()) if (!trialsBefore.has(r)) toast(t('toast.newTrial', { rule: ruleName(r) }));
    this.refreshPeers();
    this.refreshConflicts();
    Achv.check();
    this.emit('status');
  },

  reportReveal(before) {
    const revealed = [];
    this.status.visible.forEach((v, gi) => {
      if (v && !before.visible[gi]) revealed.push(gi);
    });
    if (revealed.length) toast(t('toast.revealed', { count: revealed.length }));
    return revealed;
  },

  checkPractice() {
    if (this.practiceDone || !this.regionSolved(this.board.regions[0])) return;
    this.practiceDone = true;
    store.set('practiceDone', true);
    this.refreshStatus();
    toast(t('practice.done'));
    this.emit('flash', { done: [0], revealed: [] });
    this.emit('status');
  },

  nextTarget() {
    const b = this.map, st = this.computeVisibility(b, this.done, this.rules);
    const [cr, cc] = View.centerCell();
    const dist = g => Math.hypot(g.r + 4.5 - cr, g.c + 4.5 - cc);
    const open = b.regions.filter(g => st.visible[g.gi] && !this.done.has(g.id)).sort((x, y) => dist(x) - dist(y));
    if (open.length) return open[0];
    return b.regions.filter(g => st.frontier[g.gi]).sort((x, y) => dist(x) - dist(y))[0] || null;
  },

  checkBoss() {
    const rule = this.mode;
    if (this.won.has(rule) || !this.regionSolved(this.board.regions[0])) return;
    this.pendingReveal = this.computeVisibility(this.map, this.done, this.rules);
    this.won.add(rule);
    this.rules.add(rule);
    store.set('won', [...this.won]);
    store.set('rules', [...this.rules]);
    this.refreshStatus();
    Achv.check();
    this.emit('won');
  },

  enterBoss(rule) {
    if (!this.bossBoards[rule]) return;
    this.setMode(rule);
  },

  leaveBoss() {
    if (this.isMap()) return;
    const before = this.pendingReveal;
    this.pendingReveal = null;
    this.setMode('map');
    if (before) {
      const revealed = this.reportReveal(before);
      if (revealed.length) this.emit('flash', { done: [], revealed });
    }
    this.emit('status');
  },

  stats() {
    const b = this.map;
    let filled = 0, total = 0;
    const p = this.load('map', b);
    const { visible } = this.computeVisibility(b, this.done, this.rules);
    const seen = new Uint8Array(b.n);
    for (const g of b.regions) if (visible[g.gi]) for (const i of g.cells) seen[i] = 1;
    for (let i = 0; i < b.n; i++) {
      if (!b.exists[i]) continue;
      total++;
      if (seen[i] && (b.given[i] || p.values[i])) filled++;
    }
    return { regions: this.done.size, regionsTotal: b.regions.length, rules: this.rules.size, rulesTotal: RULE_IDS.length, filled, total };
  },

  reset() {
    store.clear();
    store.set('settings', settings);
    this.progress = {};
    this.history = {};
    this.done = new Set();
    this.rules = new Set();
    this.won = new Set();
    this.practice = null;
    this.practiceBoard = null;
    this.practiceDone = false;
    Achv.unlocked = {};
    this.board = null;
    this.setMode('map');
    this.emit('status');
  },
};
