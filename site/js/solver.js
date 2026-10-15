const Solver = (() => {
  const ALL = 0x3fe;
  const bit = d => 1 << d;
  const pop = m => {
    let n = 0;
    while (m) {
      m &= m - 1;
      n++;
    }
    return n;
  };
  const single = m => m && !(m & (m - 1));
  const digitOf = m => 31 - Math.clz32(m);

  const RELATIONS = {
    white: (a, b) => Math.abs(a - b) === 1,
    black: (a, b) => a === 2 * b || b === 2 * a,
    x: (a, b) => a + b === 10,
    v: (a, b) => a + b === 5,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b,
    eq: (a, b) => a === b,
    far: (a, b) => Math.abs(a - b) >= 5,
    apart: (a, b) => Math.abs(a - b) !== 1,
  };

  function binary(a, b, rel) {
    const ab = new Uint16Array(10), ba = new Uint16Array(10);
    for (let x = 1; x <= 9; x++) {
      for (let y = 1; y <= 9; y++) {
        if (!rel(x, y)) continue;
        ab[x] |= bit(y);
        ba[y] |= bit(x);
      }
    }
    return { a, b, ab, ba };
  }

  function regionProblem(g, opts = {}) {
    const rules = opts.rules || g.rules;
    const region = { r: g.r, c: g.c, rules };
    const loc = ([r, c]) => (r - g.r) * 9 + (c - g.c);
    const units = Model.units(region).map(u => u.map(loc));
    const peers = Array.from({ length: 81 }, () => new Set());
    for (const u of units) for (const a of u) for (const b of u) if (a !== b) peers[a].add(b);
    for (const [p, q] of Model.pairs(region)) {
      peers[loc(p)].add(loc(q));
      peers[loc(q)].add(loc(p));
    }
    const unary = new Uint16Array(81).fill(ALL);
    const bins = [], nary = [];
    for (const [p, q] of Model.nonConsecutive(region)) bins.push(binary(loc(p), loc(q), RELATIONS.apart));
    for (const k of g.clues || []) {
      if (!rules.includes(CLUE_RULE[k.type])) continue;
      const cl = k.cells.map(loc);
      switch (k.type) {
        case 'white': case 'black': case 'x': case 'v': case 'gt':
          bins.push(binary(cl[0], cl[1], RELATIONS[k.type]));
          break;
        case 'even': unary[cl[0]] &= 0x154; break;
        case 'odd': unary[cl[0]] &= 0x2aa; break;
        case 'thermo':
          for (let i = 0; i + 1 < cl.length; i++) bins.push(binary(cl[i], cl[i + 1], RELATIONS.lt));
          nary.push({ cells: cl, clue: k });
          break;
        case 'whisper':
          for (let i = 0; i + 1 < cl.length; i++) bins.push(binary(cl[i], cl[i + 1], RELATIONS.far));
          break;
        case 'palindrome':
          for (let i = 0; i < cl.length - 1 - i; i++) bins.push(binary(cl[i], cl[cl.length - 1 - i], RELATIONS.eq));
          break;
        default:
          nary.push({ cells: cl, clue: k });
      }
    }
    return { n: 81, units, peers: peers.map(s => [...s]), unary, bins, nary, origin: g };
  }

  function naryPrune(con, dom) {
    const { cells, clue } = con, n = cells.length;
    const v = new Array(n).fill(0), sup = new Array(n).fill(0);
    const rec = i => {
      if (i === n) {
        for (let k = 0; k < n; k++) sup[k] |= bit(v[k]);
        return;
      }
      const m = dom[cells[i]];
      for (let d = 1; d <= 9; d++) {
        if (!(m & bit(d))) continue;
        v[i] = d;
        if (Model.check(clue, v)) rec(i + 1);
      }
      v[i] = 0;
    };
    rec(0);
    let changed = false;
    for (let k = 0; k < n; k++) {
      const nm = dom[cells[k]] & sup[k];
      if (!nm) return -1;
      if (nm !== dom[cells[k]]) {
        dom[cells[k]] = nm;
        changed = true;
      }
    }
    return changed ? 1 : 0;
  }

  function propagate(p, dom) {
    for (;;) {
      let changed = false;
      for (let i = 0; i < p.n; i++) {
        const m = dom[i];
        if (!m) return false;
        if (!single(m)) continue;
        for (const j of p.peers[i]) {
          if (!(dom[j] & m)) continue;
          dom[j] &= ~m;
          if (!dom[j]) return false;
          changed = true;
        }
      }
      for (const u of p.units) {
        for (let d = 1; d <= 9; d++) {
          const b = bit(d);
          let cnt = 0, at = -1;
          for (const i of u) {
            if (dom[i] & b) {
              cnt++;
              at = i;
            }
          }
          if (!cnt) return false;
          if (cnt === 1 && dom[at] !== b) {
            dom[at] = b;
            changed = true;
          }
        }
      }
      for (const e of p.bins) {
        let na = 0, nb = 0;
        for (let x = 1; x <= 9; x++) {
          if (dom[e.a] & bit(x) && e.ab[x] & dom[e.b]) na |= bit(x);
          if (dom[e.b] & bit(x) && e.ba[x] & dom[e.a]) nb |= bit(x);
        }
        if (!na || !nb) return false;
        if (na !== dom[e.a] || nb !== dom[e.b]) {
          dom[e.a] = na;
          dom[e.b] = nb;
          changed = true;
        }
      }
      if (!changed) {
        for (const con of p.nary) {
          const res = naryPrune(con, dom);
          if (res < 0) return false;
          if (res) changed = true;
        }
      }
      if (!changed) return true;
    }
  }

  function initialDomains(p, givens) {
    const dom = new Uint16Array(p.n);
    for (let i = 0; i < p.n; i++) dom[i] = givens[i] ? bit(givens[i]) & p.unary[i] : p.unary[i];
    return dom;
  }

  function logicSolve(p, givens) {
    const dom = initialDomains(p, givens);
    if (!propagate(p, dom)) return null;
    for (let i = 0; i < p.n; i++) if (!single(dom[i])) return null;
    return [...dom].map(digitOf);
  }

  function countSolutions(p, givens, limit = 2, maxBranches = Infinity) {
    const stats = { solutions: 0, branches: 0, solution: null, aborted: false };
    const rec = dom => {
      if (stats.aborted || !propagate(p, dom)) return;
      let best = -1, bc = 10;
      for (let i = 0; i < p.n; i++) {
        const c = pop(dom[i]);
        if (c > 1 && c < bc) {
          bc = c;
          best = i;
        }
      }
      if (best < 0) {
        stats.solutions++;
        if (!stats.solution) stats.solution = [...dom].map(digitOf);
        return;
      }
      if (++stats.branches > maxBranches) {
        stats.aborted = true;
        return;
      }
      for (let d = 1; d <= 9 && stats.solutions < limit && !stats.aborted; d++) {
        if (!(dom[best] & bit(d))) continue;
        const next = dom.slice();
        next[best] = bit(d);
        rec(next);
      }
    };
    rec(initialDomains(p, givens));
    return stats;
  }

  function randomFill(p, rand, opts = {}) {
    const limit = opts.limit || 5000;
    for (let attempt = 0; attempt < (opts.attempts || 40); attempt++) {
      let nodes = 0;
      const rec = dom => {
        if (++nodes > limit || !propagate(p, dom)) return null;
        let best = -1, bc = 10;
        for (let i = 0; i < p.n; i++) {
          const c = pop(dom[i]);
          if (c > 1 && (c < bc || (c === bc && rand() < 0.3))) {
            bc = c;
            best = i;
          }
        }
        if (best < 0) return dom;
        const ds = [];
        for (let d = 1; d <= 9; d++) if (dom[best] & bit(d)) ds.push(d);
        for (const d of shuffle(ds, rand)) {
          const next = dom.slice();
          next[best] = bit(d);
          const res = rec(next);
          if (res) return res;
          if (nodes > limit) return null;
        }
        return null;
      };
      const res = rec(opts.init ? opts.init.slice() : p.unary.slice());
      if (res) return [...res].map(digitOf);
    }
    return null;
  }

  function shuffle(a, rand) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mulberry32(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { ALL, bit, pop, single, digitOf, regionProblem, propagate, initialDomains, logicSolve, countSolutions, randomFill, shuffle, mulberry32 };
})();
