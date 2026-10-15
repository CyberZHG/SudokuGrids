const { shuffle, RULE_ORDER: ORDER } = require('./solver');

const BLOCKED = [['antiConsecutive', 'consecutive'], ['antiConsecutive', 'renban']];
const SEED_FIRST = ['antiConsecutive'];
const SEED_AFTER = 2;

const PAIRS_PER_RULE = 5;
const TRIPLES_PER_RULE = 2;
const PARTNER_SPAN = 6;
const WIDTH_STRETCH = 2.8;
const RING_RADIUS = [0, 4, 9, 14];
const MAX_SKIPPED = 3;

const OFFSETS = [];
for (let a = -2; a <= 2; a++) {
  for (let b = -2; b <= 2; b++) {
    const shared = (3 - Math.abs(a)) * (3 - Math.abs(b));
    if (shared >= 1 && shared <= 4) OFFSETS.push([a, b, shared]);
  }
}

const MIN_OWN_BOXES = 3;
const MAX_NEIGHBORS = 3;

const comboKey = rules => rules.slice().sort().join('+');

function planCombos(rand, ok) {
  const buckets = [[], [], []];
  const seen = new Set(['']);
  const push = rules => {
    const sorted = rules.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const key = comboKey(sorted);
    if (seen.has(key)) return false;
    seen.add(key);
    if (BLOCKED.some(([a, b]) => sorted.includes(a) && sorted.includes(b))) return false;
    if (!ok(sorted)) return false;
    buckets[sorted.length - 1].push(sorted);
    return true;
  };
  ORDER.forEach((rule, k) => {
    push([rule]);
    const near = ORDER.slice(Math.max(0, k - PARTNER_SPAN), k);
    let pairs = 0;
    for (const other of shuffle(near.slice(), rand)) {
      if (pairs >= PAIRS_PER_RULE) break;
      if (push([rule, other])) pairs++;
    }
    let triples = 0;
    for (let t = 0; t < 40 && triples < TRIPLES_PER_RULE && near.length >= 2; t++) {
      const [a, b] = shuffle(near.slice(), rand);
      if (push([rule, a, b])) triples++;
    }
  });
  const plain = buckets[0].filter(r => !SEED_FIRST.includes(r[0]));
  const singles = [...plain.slice(0, SEED_AFTER), ...buckets[0].filter(r => SEED_FIRST.includes(r[0])), ...plain.slice(SEED_AFTER)];
  return [[], ...singles, ...buckets[1], ...buckets[2]];
}

function overlapBoxes(a, b) {
  const dr = Math.abs(a.br - b.br), dc = Math.abs(a.bc - b.bc);
  return dr < 3 && dc < 3 ? (3 - dr) * (3 - dc) : 0;
}

function boxesOf(g) {
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(`${g.br + i},${g.bc + j}`);
  return out;
}

function tryLayout(rand, filler, combos) {
  filler.reset();
  const placed = [];
  const cover = new Map();
  const add = g => {
    placed.push(g);
    for (const k of boxesOf(g)) cover.set(k, (cover.get(k) || 0) + 1);
  };
  const ownBoxes = (g, extra) => boxesOf(g).filter(k => (cover.get(k) || 0) + (extra && extra.has(k) ? 1 : 0) === 1).length;
  const valid = cand => {
    let neighbors = 0;
    for (const g of placed) {
      const size = overlapBoxes(g, cand);
      if (!size) continue;
      if (size > 4) return false;
      if (++neighbors > MAX_NEIGHBORS) return false;
    }
    const mine = new Set(boxesOf(cand));
    if (boxesOf(cand).filter(k => !cover.has(k)).length < MIN_OWN_BOXES) return false;
    for (const k of mine) if ((cover.get(k) || 0) >= 2) return false;
    return placed.every(g => !overlapBoxes(g, cand) || ownBoxes(g, mine) >= MIN_OWN_BOXES);
  };
  const shared = (a, b) => a.filter(r => b.includes(r)).length;
  const place = rules => {
    const prev = rules.length === 1 ? placed.filter(g => g.rules.length === 1).pop() : null;
    const related = placed.filter(g => shared(g.rules, rules));
    const tiers = rules.length === 1 ? [placed] : [related, placed].filter(t => t.length);
    for (const anchors of tiers) {
      const g = placeFrom(anchors, rules, prev);
      if (g) return g;
    }
    return null;
  };
  const placeFrom = (anchors, rules, prev) => {
    const cands = [], seen = new Set();
    for (const anchor of anchors) {
      for (const [a, b, size] of OFFSETS) {
        const cand = { br: anchor.br + a, bc: anchor.bc + b };
        const key = `${cand.br},${cand.bc}`;
        if (seen.has(key) || !valid(cand)) continue;
        seen.add(key);
        let touches = 0, kin = 0, strangers = 0;
        for (const g of placed) {
          if (overlapBoxes(g, cand)) touches++;
          const d = Math.max(Math.abs(g.br - cand.br), Math.abs(g.bc - cand.bc));
          if (d > 5) continue;
          const s = shared(g.rules, rules);
          if (s) kin += s;
          else if (g.rules.length) strangers++;
        }
        const dist = Math.hypot(cand.br, cand.bc / WIDTH_STRETCH);
        const outer = placed.filter(g => g.rules.length > rules.length && Math.max(Math.abs(g.br - cand.br), Math.abs(g.bc - cand.bc)) <= 4).length;
        const ring = -Math.abs(dist - RING_RADIUS[rules.length]) * 0.9 - dist * 0.1;
        const follow = prev && overlapBoxes(prev, cand) ? 1.5 : 0;
        const score = ring + follow + touches * 0.8 + kin * 0.9 - strangers * 0.25 - outer * 0.8 - (size === 4 ? 1.2 : 0) + (size === 2 ? 0.4 : 0) + rand() * 2.5;
        cands.push({ ...cand, score });
      }
    }
    cands.sort((x, y) => y.score - x.score);
    let tries = 0;
    for (const cand of cands) {
      if (tries >= 16) break;
      const probe = { r: cand.br * 3, c: cand.bc * 3, rules };
      if (!filler.feasible(probe)) continue;
      tries++;
      if (!filler.accept(probe)) continue;
      const g = { br: cand.br, bc: cand.bc, rules };
      add(g);
      return g;
    }
    return null;
  };
  if (!filler.accept({ r: 0, c: 0, rules: [] })) return null;
  add({ br: 0, bc: 0, rules: [] });
  const skipped = [];
  for (const rules of combos.slice(1)) if (!place(rules)) skipped.push(rules);
  return { placed, skipped };
}

function buildLayout(rand, filler, combos) {
  let res = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    res = tryLayout(rand, filler, combos);
    if (res && res.skipped.length <= MAX_SKIPPED) break;
    if (res) console.log(`  layout attempt ${attempt + 1} skipped ${res.skipped.map(r => r.join('+')).join(', ')}`);
  }
  if (!res || res.skipped.length > MAX_SKIPPED) throw new Error('Layout failed');
  const { placed, skipped } = res;
  const minR = Math.min(...placed.map(g => g.br)), minC = Math.min(...placed.map(g => g.bc));
  const regions = placed.map((g, id) => ({ id, r: (g.br - minR) * 3, c: (g.bc - minC) * 3, rules: g.rules }));
  const rows = Math.max(...regions.map(g => g.r)) + 9;
  const cols = Math.max(...regions.map(g => g.c)) + 9;
  return { rows, cols, start: 0, regions, skipped, value: (r, c) => filler.value(r + minR * 3, c + minC * 3) };
}

function preview(layout) {
  const grid = Array.from({ length: layout.rows / 3 }, () => Array(layout.cols / 3).fill(' '));
  for (const g of layout.regions) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cell = grid[g.r / 3 + i][g.c / 3 + j];
        grid[g.r / 3 + i][g.c / 3 + j] = cell === ' ' ? (g.rules.length ? String(g.rules.length) : 'C') : '#';
      }
    }
  }
  return grid.map(row => row.join('')).join('\n');
}

module.exports = { buildLayout, planCombos, preview, ORDER, BLOCKED, comboKey };

if (require.main === module) {
  const { PUZZLES } = require('./solver').load('puzzles.js', ['PUZZLES']);
  const { map } = PUZZLES;
  console.log(`${map.regions.length} regions, ${map.rows}x${map.cols}`);
  console.log(preview(map));
}
