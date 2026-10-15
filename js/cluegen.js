const ClueGen = (() => {
  const CLUE_PLAN = {
    consecutive: { kind: 'edge', type: 'white', count: 14 },
    double: { kind: 'edge', type: 'black', count: 8 },
    xv: { kind: 'edge', type: 'xv', count: 12 },
    greater: { kind: 'edge', type: 'gt', count: 16 },
    parity: { kind: 'cell', count: 14 },
    thermo: { kind: 'line', type: 'thermo', count: 5, min: 3, max: 6 },
    arrow: { kind: 'line', type: 'arrow', count: 5, min: 2, max: 4 },
    palindrome: { kind: 'line', type: 'palindrome', count: 4, min: 3, max: 6 },
    whisper: { kind: 'line', type: 'whisper', count: 5, min: 3, max: 6 },
    renban: { kind: 'line', type: 'renban', count: 5, min: 3, max: 5 },
    killer: { kind: 'cage', count: 10, min: 2, max: 4 },
    between: { kind: 'line', type: 'between', count: 5, min: 3, max: 5 },
    entropic: { kind: 'line', type: 'entropic', count: 4, min: 3, max: 6 },
    modular: { kind: 'line', type: 'modular', count: 4, min: 3, max: 6 },
    zipper: { kind: 'line', type: 'zipper', count: 4, min: 3, max: 5 },
    regionSum: { kind: 'line', type: 'regionSum', count: 4, min: 3, max: 5 },
    quadruple: { kind: 'quad', count: 7 },
  };

  function orth(g, r, c) {
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => Model.contains(g, y, x));
  }

  function edgeKey(a, b) {
    const ka = Model.key(...a), kb = Model.key(...b);
    return ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
  }

  function makeClues(g, sol, occ, scale, rand) {
    const pick = a => a[Math.floor(rand() * a.length)];
    const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
    const clues = [];
    const cells = Model.regionCells(g);
    const free = ([r, c]) => !occ.cells.has(Model.key(r, c));
    for (const rule of g.rules) {
      const plan = CLUE_PLAN[rule];
      if (!plan) continue;
      const want = Math.max(2, Math.round(plan.count * scale));
      let made = 0;
      if (plan.kind === 'edge') {
        const edges = [];
        for (const [r, c] of cells) {
          for (const [y, x] of [[r + 1, c], [r, c + 1]]) {
            if (Model.contains(g, y, x)) edges.push([[r, c], [y, x]]);
          }
        }
        Solver.shuffle(edges, rand);
        for (const [a, b] of edges) {
          if (made >= want) break;
          if (occ.edges.has(edgeKey(a, b))) continue;
          const va = sol(...a), vb = sol(...b);
          let clue = null;
          if (plan.type === 'white' && Math.abs(va - vb) === 1) clue = { type: 'white', cells: [a, b] };
          if (plan.type === 'black' && (va === 2 * vb || vb === 2 * va)) clue = { type: 'black', cells: [a, b] };
          if (plan.type === 'xv' && va + vb === 10) clue = { type: 'x', cells: [a, b] };
          if (plan.type === 'xv' && va + vb === 5) clue = { type: 'v', cells: [a, b] };
          if (plan.type === 'gt') clue = { type: 'gt', cells: va > vb ? [a, b] : [b, a] };
          if (!clue) continue;
          occ.edges.add(edgeKey(a, b));
          clues.push(clue);
          made++;
        }
      } else if (plan.kind === 'cell') {
        for (const cell of Solver.shuffle(cells.slice(), rand)) {
          if (made >= want) break;
          if (!free(cell)) continue;
          occ.cells.add(Model.key(...cell));
          clues.push({ type: sol(...cell) % 2 ? 'odd' : 'even', cells: [cell] });
          made++;
        }
      } else if (plan.kind === 'line') {
        for (let tries = 0; tries < 4000 && made < want; tries++) {
          const len = randInt(plan.min, plan.max);
          const start = pick(cells);
          if (!free(start)) continue;
          const pathCells = [start];
          const probe = { type: plan.type, cells: pathCells };
          const vals = () => {
            const v = pathCells.map(p => sol(...p));
            while (v.length < len) v.push(0);
            return v;
          };
          if (!Model.check(probe, vals())) continue;
          while (pathCells.length < len) {
            const [r, c] = pathCells[pathCells.length - 1];
            const opts = orth(g, r, c).filter(p => free(p) && !pathCells.some(q => q[0] === p[0] && q[1] === p[1]));
            Solver.shuffle(opts, rand);
            let next = null;
            for (const p of opts) {
              pathCells.push(p);
              if (Model.check(probe, vals())) {
                next = p;
                break;
              }
              pathCells.pop();
            }
            if (!next) break;
          }
          if (pathCells.length < len) continue;
          if (plan.type === 'palindrome' && len < 4 && rand() < 0.7) continue;
          if (plan.type === 'thermo' && sol(...pathCells[0]) > 9 - len + 1) continue;
          if (plan.type === 'regionSum' && new Set(pathCells.map(([r, c]) => Math.floor(r / 3) * 1000 + Math.floor(c / 3))).size < 2) continue;
          for (const p of pathCells) occ.cells.add(Model.key(...p));
          clues.push({ type: plan.type, cells: pathCells });
          made++;
        }
      } else if (plan.kind === 'quad') {
        const corners = [];
        for (let r = 1; r < 9; r++) for (let c = 1; c < 9; c++) corners.push([g.r + r, g.c + c]);
        for (const [r, c] of Solver.shuffle(corners, rand)) {
          if (made >= want) break;
          const key = `q${Model.key(r, c)}`;
          if (occ.edges.has(key)) continue;
          const quad = [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]];
          const digits = Solver.shuffle(quad.map(p => sol(...p)), rand).slice(0, rand() < 0.5 ? 3 : 4).sort((a, b) => a - b);
          occ.edges.add(key);
          clues.push({ type: 'quad', cells: quad, digits });
          made++;
        }
      } else if (plan.kind === 'cage') {
        for (let tries = 0; tries < 4000 && made < want; tries++) {
          const size = randInt(plan.min, plan.max);
          const start = pick(cells);
          if (!free(start)) continue;
          const cage = [start];
          const used = new Set([sol(...start)]);
          while (cage.length < size) {
            const opts = [];
            for (const [r, c] of cage) {
              for (const p of orth(g, r, c)) {
                if (!free(p) || used.has(sol(...p)) || cage.some(q => q[0] === p[0] && q[1] === p[1])) continue;
                opts.push(p);
              }
            }
            if (!opts.length) break;
            const p = pick(opts);
            cage.push(p);
            used.add(sol(...p));
          }
          if (cage.length < size) continue;
          cage.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
          for (const p of cage) occ.cells.add(Model.key(...p));
          clues.push({ type: 'killer', cells: cage, sum: [...used].reduce((s, x) => s + x, 0) });
          made++;
        }
      }
    }
    return clues;
  }

  return { CLUE_PLAN, makeClues, edgeKey };
})();
