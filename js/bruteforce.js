const BruteForce = (() => {
  function buildChecker(g) {
    const cells = Model.regionCells(g);
    const loc = ([r, c]) => (r - g.r) * 9 + (c - g.c);
    const peers = Array.from({ length: 81 }, () => new Set());
    for (const u of Model.units(g)) for (const a of u) for (const b of u) if (a !== b) peers[loc(a)].add(loc(b));
    for (const [p, q] of Model.pairs(g)) {
      peers[loc(p)].add(loc(q));
      peers[loc(q)].add(loc(p));
    }
    const apart = Array.from({ length: 81 }, () => []);
    for (const [p, q] of Model.nonConsecutive(g)) {
      apart[loc(p)].push(loc(q));
      apart[loc(q)].push(loc(p));
    }
    const clues = (g.clues || []).filter(k => g.rules.includes(CLUE_RULE[k.type])).map(k => ({ clue: k, idx: k.cells.map(loc) }));
    const byCell = Array.from({ length: 81 }, () => []);
    for (const k of clues) for (const i of k.idx) byCell[i].push(k);
    return { cells, peers: peers.map(s => [...s]), apart, clues, byCell };
  }

  function consistent(ch, val, i) {
    const d = val[i];
    for (const j of ch.peers[i]) if (val[j] === d) return false;
    for (const j of ch.apart[i]) if (val[j] && Math.abs(val[j] - d) === 1) return false;
    for (const k of ch.byCell[i]) if (!Model.check(k.clue, k.idx.map(j => val[j]))) return false;
    return true;
  }

  function bruteForce(g, givens, limit = 2, maxNodes = 5e6) {
    const ch = buildChecker(g);
    const val = givens.slice();
    const stats = { solutions: 0, nodes: 0, aborted: false, solution: null };
    for (let i = 0; i < 81; i++) if (val[i] && !consistent(ch, val, i)) return stats;
    const candidates = i => {
      const out = [];
      for (let d = 1; d <= 9; d++) {
        val[i] = d;
        if (consistent(ch, val, i)) out.push(d);
      }
      val[i] = 0;
      return out;
    };
    const rec = () => {
      if (stats.solutions >= limit || stats.aborted) return;
      let best = -1, bestC = null;
      for (let i = 0; i < 81; i++) {
        if (val[i]) continue;
        const c = candidates(i);
        if (!bestC || c.length < bestC.length) {
          best = i;
          bestC = c;
          if (c.length <= 1) break;
        }
      }
      if (best < 0) {
        stats.solutions++;
        if (!stats.solution) stats.solution = val.slice();
        return;
      }
      for (const d of bestC) {
        if (++stats.nodes > maxNodes) {
          stats.aborted = true;
          return;
        }
        val[best] = d;
        rec();
        val[best] = 0;
        if (stats.solutions >= limit) return;
      }
    };
    rec();
    return stats;
  }

  function verifySolution(g, sol) {
    const errors = [];
    for (const u of Model.units(g)) {
      const seen = new Set(u.map(([r, c]) => sol(r, c)));
      if (seen.size !== 9 || [...seen].some(d => d < 1 || d > 9)) errors.push(`unit ${JSON.stringify(u[0])}..${JSON.stringify(u[8])}`);
    }
    for (const [p, q] of Model.pairs(g)) if (sol(...p) === sol(...q)) errors.push(`pair ${p} ${q}`);
    for (const [p, q] of Model.nonConsecutive(g)) if (Math.abs(sol(...p) - sol(...q)) === 1) errors.push(`consecutive ${p} ${q}`);
    for (const k of g.clues || []) {
      if (!Model.check(k, k.cells.map(([r, c]) => sol(r, c)))) errors.push(`clue ${k.type} ${JSON.stringify(k.cells)}`);
    }
    return errors;
  }

  return { bruteForce, verifySolution };
})();
