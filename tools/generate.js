const fs = require('fs');
const path = require('path');
const S = require('./solver');
const { buildLayout, planCombos, ORDER, BLOCKED, comboKey } = require('./layout');


const { Model, RULE_IDS, LINE_TYPES, ClueGen, bruteForce, regionProblem, logicSolve, countSolutions, randomFill, initialDomains, propagate, shuffle, mulberry32 } = S;

const SEED = Number(process.env.SEED || 20261014);
let rand = mulberry32(SEED);
const CACHE_FILE = path.join(__dirname, '.combo-cache.json');

function hashString(s) {
  let h = SEED | 0;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 0x5bd1e995);
  return h >>> 0;
}
const T0 = Date.now();

const FLOOR = { classic: 34, variant: 28, boss: 26 };
const MIN_GIVENS = 24;
const VALIDATE_MS = 20000;
const BRUTE_BUDGET = { map: 3000, boss: 6000 };

const makeClues = (g, sol, occ, scale) => ClueGen.makeClues(g, sol, occ, scale, rand);
const { edgeKey } = ClueGen;

function regionFiller(seedStart = false) {
  const values = new Map();
  const key = (r, c) => `${r},${c}`;
  return {
    reset() {
      values.clear();
    },
    feasible(g) {
      const cells = Model.regionCells(g);
      const p = regionProblem(g);
      const fixed = cells.map(([r, c]) => values.get(key(r, c)) || 0);
      return propagate(p, initialDomains(p, fixed));
    },
    accept(g) {
      const cells = Model.regionCells(g);
      const fixed = cells.map(([r, c]) => values.get(key(r, c)) || 0);
      const fill = soft => {
        const p = regionProblem(soft ? { ...g, rules: [...g.rules, 'antiConsecutive'] } : g);
        if (soft) p.bins = p.bins.filter(e => !fixed[e.a] && !fixed[e.b]);
        const hard = soft || g.rules.includes('antiConsecutive');
        return randomFill(p, rand, { init: initialDomains(p, fixed), attempts: hard ? 8 : 3, limit: hard ? 3000 : 400 });
      };
      const seed = seedStart && !values.size;
      let val = null;
      for (let i = 0; seed && !val && i < 20; i++) val = fill(true);
      val ||= fill(false);
      if (!val) return false;
      cells.forEach(([r, c], i) => values.set(key(r, c), val[i]));
      return true;
    },
    value(r, c) {
      return values.get(key(r, c));
    },
  };
}

function localGivens(g, given, sol) {
  return Model.regionCells(g).map(([r, c]) => (given(r, c) ? sol(r, c) : 0));
}

let deadline = Infinity;

function checkDeadline() {
  if (Date.now() > deadline) throw new Error('timeout');
}

function rulesNeeded(g, givens) {
  checkDeadline();
  for (const rule of g.rules) {
    const p = regionProblem(g, { rules: g.rules.filter(x => x !== rule) });
    const res = countSolutions(p, givens, 2, 20000);
    if (res.aborted || res.solutions < 2) return false;
  }
  return true;
}

function selectGivens(regions, cellRegions, sol, floorOf, reclue, budget, swap) {
  const given = new Map();
  for (const g of regions) for (const [r, c] of Model.regionCells(g)) given.set(Model.key(r, c), true);
  const isGiven = (r, c) => given.get(Model.key(r, c));
  const problems = regions.map(g => regionProblem(g));
  const counts = regions.map(() => 81);
  const solvable = gi => !!logicSolve(problems[gi], localGivens(regions[gi], isGiven, sol));
  const tryRemove = (cell, floor) => {
    checkDeadline();
    const k = Model.key(...cell);
    if (!given.get(k)) return false;
    const owners = cellRegions(...cell);
    if (owners.some(gi => counts[gi] <= (floor === true ? floorOf(regions[gi]) : MIN_GIVENS))) return false;
    given.set(k, false);
    if (owners.every(solvable)) {
      for (const gi of owners) counts[gi]--;
      return true;
    }
    given.set(k, true);
    return false;
  };
  const all = shuffle([...given.keys()].map(k => [Math.floor(k / 1000), k % 1000]), rand);
  for (const cell of all) tryRemove(cell, true);
  const restore = cell => {
    const k = Model.key(...cell);
    if (given.get(k)) return;
    given.set(k, true);
    for (const gi of cellRegions(...cell)) counts[gi]++;
  };
  const needed = gi => rulesNeeded(regions[gi], localGivens(regions[gi], isGiven, sol));
  const reason = gi => {
    const givens = localGivens(regions[gi], isGiven, sol);
    const count = givens.filter(Boolean).length;
    if (count < MIN_GIVENS) return `only ${count} givens`;
    if (!needed(gi)) return `rules not all necessary with ${count} givens`;
    const brute = bruteForce(regions[gi], givens, 2, budget);
    if (brute.aborted) return 'brute force over budget';
    return brute.solutions === 1 ? '' : 'not unique';
  };
  const acceptable = gi => !reason(gi);
  const fix = gi => {
    const g = regions[gi];
    const own = Model.regionCells(g).filter(cell => cellRegions(...cell).length === 1);
    for (let attempt = 0; attempt < 40; attempt++) {
      if (attempt && attempt % 10 === 0 && reclue) {
        Model.regionCells(g).forEach(restore);
        reclue(gi);
        problems[gi] = regionProblem(g);
      }
      if (attempt) {
        own.forEach(restore);
        shuffle(own, rand).forEach(cell => tryRemove(cell, true));
      }
      const cells = shuffle(attempt < 20 ? own.slice() : Model.regionCells(g), rand);
      while (!needed(gi)) {
        if (!cells.some(cell => tryRemove(cell, false))) break;
      }
      if (acceptable(gi)) return true;
    }
    return false;
  };
  for (let round = 0; round < 10; round++) {
    const bad = regions.map((g, gi) => gi).filter(gi => !acceptable(gi));
    if (!bad.length) return isGiven;
    if (round && regions.length > 1) console.log(`  round ${round}: adjusting regions ${bad.join(', ')}`);
    const failed = bad.filter(gi => !fix(gi));
    if (failed.length && !reclue) throw new Error(`Regions ${failed.join(', ')} cannot make every rule necessary`);
  }
  for (let pass = 0; swap && pass < 8; pass++) {
    const bad = regions.map((g, gi) => gi).filter(gi => !acceptable(gi));
    if (!bad.length) return isGiven;
    for (const gi of bad) {
      const before = regions[gi].rules.join('+');
      Model.regionCells(regions[gi]).forEach(restore);
      if (!swap(gi)) continue;
      problems[gi] = regionProblem(regions[gi]);
      console.log(`  region ${gi}: ${before} -> ${regions[gi].rules.join('+')}`);
      fix(gi);
    }
    for (let round = 0; round < 4; round++) {
      const again = regions.map((g, gi) => gi).filter(gi => !acceptable(gi));
      if (!again.length) return isGiven;
      again.forEach(fix);
    }
  }
  const bad = regions.map((g, gi) => gi).filter(gi => !acceptable(gi));
  if (!bad.length) return isGiven;
  for (const gi of bad) console.log(`  region ${gi} ${regions[gi].rules.join('+')}: ${reason(gi)}`);
  const err = new Error('Rule necessity did not converge');
  err.failedCombos = bad.map(gi => regions[gi].rules.join('+'));
  throw err;
}

function loadCache() {
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {}
  const signature = `${SEED}:${FLOOR.variant}:${MIN_GIVENS}:${BRUTE_BUDGET.map}:${VALIDATE_MS}`;
  return cache.signature === signature ? cache : { signature, results: {} };
}

function generateMap(cache) {
  const tested = { ok: 0, failed: [] };
  const combos = planCombos(rand, rules => {
    const name = rules.join('+');
    if (name in cache.results) {
      if (cache.results[name]) tested.ok++;
      else tested.failed.push(name);
      return cache.results[name];
    }
    const ok = validate(rules);
    cache.results[name] = ok;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    return ok;
  });
  function validate(rules) {
    const t = Date.now();
    deadline = t + VALIDATE_MS;
    const mainRand = rand;
    rand = mulberry32(hashString(rules.join('+')));
    try {
      standalone(rules, 1, FLOOR.variant, BRUTE_BUDGET.map);
      tested.ok++;
      console.log(`  ok ${rules.join('+')} ${Date.now() - t}ms`);
      return true;
    } catch {
      tested.failed.push(rules.join('+'));
      console.log(`  rejected ${rules.join('+')} ${Date.now() - t}ms`);
      return false;
    } finally {
      deadline = Infinity;
      rand = mainRand;
    }
  }
  console.log(`combos: ${combos.length} planned in ${((Date.now() - T0) / 1000).toFixed(1)}s, ${tested.failed.length} rejected${tested.failed.length ? ` (${tested.failed.join(', ')})` : ''}`);
  const layout = buildLayout(rand, regionFiller(true), combos);
  console.log(`layout: ${layout.regions.length} regions in ${((Date.now() - T0) / 1000).toFixed(1)}s`);
  if (layout.skipped.length) console.log(`skipped during placement: ${layout.skipped.map(r => r.join('+')).join(', ')}`);
  const { rows, cols, regions } = layout;
  const sol = layout.value;
  const occ = { cells: new Set(), edges: new Set() };
  const scaleOf = k => (k === 1 ? 1 : k === 2 ? 0.65 : 0.5);
  const order = shuffle(regions.slice(), rand);
  for (const g of order) g.clues = makeClues(g, sol, occ, scaleOf(g.rules.length));
  const owners = new Map();
  for (const g of regions) for (const [r, c] of Model.regionCells(g)) {
    const k = Model.key(r, c);
    if (!owners.has(k)) owners.set(k, []);
    owners.get(k).push(g.id);
  }
  const cellRegions = (r, c) => owners.get(Model.key(r, c));
  const reclue = gi => {
    const g = regions[gi];
    for (const k of g.clues) {
      if (k.type === 'quad') occ.edges.delete(`q${Model.key(...k.cells[3])}`);
      else if (k.cells.length === 2 && !LINE_TYPES.includes(k.type) && k.type !== 'killer') occ.edges.delete(edgeKey(...k.cells));
      else for (const p of k.cells) occ.cells.delete(Model.key(...p));
    }
    g.clues = makeClues(g, sol, occ, scaleOf(g.rules.length));
  };
  const used = new Set(regions.map(g => comboKey(g.rules)));
  const tried = regions.map(g => new Set([comboKey(g.rules)]));
  const fits = (g, rules) => {
    const h = { r: g.r, c: g.c, rules };
    if (Model.units(h).some(u => new Set(u.map(p => sol(...p))).size !== 9)) return false;
    if (Model.pairs(h).some(([p, q]) => sol(...p) === sol(...q))) return false;
    return !Model.nonConsecutive(h).some(([p, q]) => Math.abs(sol(...p) - sol(...q)) === 1);
  };
  const candidatesFor = g => {
    const near = regions.filter(o => o !== g && Math.abs(o.r - g.r) <= 12 && Math.abs(o.c - g.c) <= 12).flatMap(o => o.rules);
    const pool = new Map();
    const add = rules => {
      const sorted = [...new Set(rules)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      if (!sorted.length || sorted.length > 3) return;
      const key = comboKey(sorted);
      if (pool.has(key) || used.has(key) || BLOCKED.some(([a, b]) => sorted.includes(a) && sorted.includes(b))) return;
      if (cache.results[sorted.join('+')] === false) return;
      const score = sorted.filter(r => g.rules.includes(r)).length * 3 + sorted.filter(r => near.includes(r)).length - (sorted.length === g.rules.length ? 0 : 4);
      pool.set(key, { rules: sorted, score });
    };
    for (const a of ORDER) {
      add([a]);
      for (const b of ORDER) {
        add([a, b]);
        for (const r of g.rules) add([a, b, r]);
      }
    }
    return [...pool.values()].sort((x, y) => y.score - x.score);
  };
  const swap = gi => {
    const g = regions[gi];
    for (const cand of candidatesFor(g)) {
      const key = comboKey(cand.rules);
      if (tried[gi].has(key) || !fits(g, cand.rules)) continue;
      tried[gi].add(key);
      const name = cand.rules.join('+');
      if (!(name in cache.results)) {
        cache.results[name] = validate(cand.rules);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      }
      if (!cache.results[name]) continue;
      used.delete(comboKey(g.rules));
      used.add(key);
      g.rules = cand.rules;
      reclue(gi);
      return true;
    }
    return false;
  };
  const isGiven = selectGivens(regions, cellRegions, sol, g => (g.rules.length ? FLOOR.variant : FLOOR.classic), reclue, BRUTE_BUDGET.map, swap);
  let solution = '', givens = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const exists = regions.some(g => Model.contains(g, r, c));
      solution += exists ? sol(r, c) : '0';
      givens += exists && isGiven(r, c) ? '1' : '0';
    }
  }
  return { rows, cols, start: layout.start, regions, solution, givens };
}

function standalone(rules, scale, floor, budget) {
  const g = { id: 0, r: 0, c: 0, rules };
  const filler = regionFiller();
  let ok = false;
  for (let i = 0; i < 5 && !ok; i++) ok = filler.accept(g);
  if (!ok) throw new Error(`No solution for ${rules.join('+')}`);
  const sol = filler.value;
  g.clues = makeClues(g, sol, { cells: new Set(), edges: new Set() }, scale);
  const isGiven = selectGivens([g], () => [0], sol, () => floor, () => {
    g.clues = makeClues(g, sol, { cells: new Set(), edges: new Set() }, scale);
  }, budget);
  return {
    clues: g.clues,
    solution: Model.regionCells(g).map(([r, c]) => sol(r, c)).join(''),
    givens: Model.regionCells(g).map(([r, c]) => (isGiven(r, c) ? '1' : '0')).join(''),
  };
}

function generateBoss(rule) {
  const mainRand = rand;
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      rand = mulberry32(hashString(`boss:${rule}:${attempt}`));
      try {
        return { rule, ...standalone([rule], 1.2, FLOOR.boss, BRUTE_BUDGET.boss) };
      } catch (e) {
        if (!e.failedCombos) throw e;
      }
    }
  } finally {
    rand = mainRand;
  }
  throw new Error(`Trial for ${rule} could not be generated`);
}

function format(data) {
  const j = JSON.stringify;
  const clues = (list, pad) => list.length ? `[\n${list.map(k => `${pad}  ${j(k)},`).join('\n')}\n${pad}]` : '[]';
  const { map } = data;
  return [
    'const PUZZLES = {',
    `  seed: ${data.seed},`,
    '  map: {',
    `    rows: ${map.rows},`,
    `    cols: ${map.cols},`,
    `    start: ${map.start},`,
    `    solution: ${j(map.solution)},`,
    `    givens: ${j(map.givens)},`,
    '    regions: [',
    ...map.regions.map(g => `      { id: ${g.id}, r: ${g.r}, c: ${g.c}, rules: ${j(g.rules)}, clues: ${clues(g.clues, '      ')} },`),
    '    ],',
    '  },',
    '  bosses: [',
    ...data.bosses.map(b => `    { rule: ${j(b.rule)}, solution: ${j(b.solution)}, givens: ${j(b.givens)}, clues: ${clues(b.clues, '    ')} },`),
    '  ],',
    '};',
    '',
  ].join('\n');
}

function main() {
  const t0 = Date.now();
  const cache = loadCache();
  let map = null;
  for (let attempt = 0; attempt < 5 && !map; attempt++) {
    try {
      map = generateMap(cache);
    } catch (e) {
      if (!e.failedCombos) throw e;
      console.log(`excluding ${e.failedCombos.join(', ')} and regenerating`);
      for (const name of e.failedCombos) cache.results[name] = false;
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }
  }
  if (!map) throw new Error('Map generation failed');
  console.log(`map: ${map.regions.length} regions, ${map.rows}x${map.cols}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const bosses = RULE_IDS.map(rule => generateBoss(rule));
  console.log(`bosses: ${bosses.length}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const data = { seed: SEED, map, bosses };
  const out = path.join(__dirname, '..', 'site', 'js', 'puzzles.js');
  fs.writeFileSync(out, format(data));
  console.log(`written ${path.relative(process.cwd(), out)}`);
}

main();
