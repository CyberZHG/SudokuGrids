const test = require('node:test');
const assert = require('node:assert');
const S = require('../tools/solver');
const { bruteForce, verifySolution } = require('../tools/bruteforce');

const { Model, RULE_IDS, CLUE_RULE, regionProblem, logicSolve, countSolutions } = S;
const { PUZZLES } = S.load('puzzles.js', ['PUZZLES']);
const { map, bosses } = PUZZLES;

const MAX_BRUTE_NODES = 10000;
const MIN_GIVENS = 22;

const mapSol = (r, c) => Number(map.solution[r * map.cols + c]);
const mapGiven = (r, c) => map.givens[r * map.cols + c] === '1';
const localGivens = (g, sol, given) => Model.regionCells(g).map(([r, c]) => (given(r, c) ? sol(r, c) : 0));
const bossAsRegion = b => ({ id: 0, r: 0, c: 0, rules: [b.rule], clues: b.clues });
const bossSol = b => (r, c) => Number(b.solution[r * 9 + c]);
const bossGiven = b => (r, c) => b.givens[r * 9 + c] === '1';

const puzzles = [
  ...map.regions.map(g => ({ name: `region ${g.id}`, g, sol: mapSol, given: mapGiven })),
  ...bosses.map(b => ({ name: `boss ${b.rule}`, g: bossAsRegion(b), sol: bossSol(b), given: bossGiven(b) })),
];

const report = [];

test('map structure', () => {
  assert.strictEqual(map.solution.length, map.rows * map.cols);
  assert.strictEqual(map.givens.length, map.rows * map.cols);
  assert.ok(map.regions[map.start], 'start region exists');
  assert.deepStrictEqual(map.regions[map.start].rules, [], 'start region is classic');
  for (const g of map.regions) {
    assert.ok(g.r % 3 === 0 && g.c % 3 === 0, `region ${g.id} is box aligned`);
    assert.ok(g.r + 9 <= map.rows && g.c + 9 <= map.cols, `region ${g.id} inside map`);
    assert.ok(g.rules.length <= 3, `region ${g.id} has at most three rules`);
    assert.strictEqual(new Set(g.rules).size, g.rules.length);
    for (const rule of g.rules) assert.ok(RULE_IDS.includes(rule), `unknown rule ${rule}`);
    for (const k of g.clues) {
      assert.ok(g.rules.includes(CLUE_RULE[k.type]), `region ${g.id} clue ${k.type} matches a rule`);
      for (const [r, c] of k.cells) assert.ok(Model.contains(g, r, c), `region ${g.id} clue inside region`);
    }
  }
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const inside = map.regions.some(g => Model.contains(g, r, c));
      assert.strictEqual(mapSol(r, c) > 0, inside, `cell ${r},${c} existence`);
      if (!inside) assert.ok(!mapGiven(r, c));
    }
  }
});

test('regions are connected and every rule is reachable', () => {
  const overlaps = (a, b) => Math.abs(a.r - b.r) < 9 && Math.abs(a.c - b.c) < 9 && a !== b;
  const unlocked = new Set();
  const done = new Set();
  const visible = g => g.id === map.start || (g.rules.every(x => unlocked.has(x)) && map.regions.some(o => done.has(o.id) && overlaps(o, g)));
  for (let step = 0; step < 1000; step++) {
    const next = map.regions.find(g => !done.has(g.id) && visible(g));
    if (next) {
      done.add(next.id);
      continue;
    }
    const frontier = map.regions.filter(g => !visible(g) && map.regions.some(o => done.has(o.id) && overlaps(o, g)));
    const rule = frontier.flatMap(g => g.rules).find(x => !unlocked.has(x));
    if (!rule) break;
    unlocked.add(rule);
  }
  assert.strictEqual(done.size, map.regions.length, 'all regions can be completed');
  assert.strictEqual(unlocked.size, RULE_IDS.length, 'all rules are unlocked along the way');
});

test('every region has a distinct rule set', () => {
  const seen = new Map();
  for (const g of map.regions) {
    const key = g.rules.slice().sort().join('+');
    assert.ok(!seen.has(key), `regions ${seen.get(key)} and ${g.id} share rules ${key || 'classic'}`);
    seen.set(key, g.id);
  }
});

test('every rule has a boss', () => {
  assert.deepStrictEqual(bosses.map(b => b.rule).sort(), RULE_IDS.slice().sort());
  for (const b of bosses) {
    assert.strictEqual(b.solution.length, 81);
    assert.strictEqual(b.givens.length, 81);
  }
});

for (const p of puzzles) {
  test(`${p.name}: valid, unique, beginner friendly`, () => {
    assert.deepStrictEqual(verifySolution(p.g, p.sol), [], 'solution satisfies all constraints');
    const givens = localGivens(p.g, p.sol, p.given);
    const expected = Model.regionCells(p.g).map(([r, c]) => p.sol(r, c));
    assert.ok(givens.filter(Boolean).length >= MIN_GIVENS, `at least ${MIN_GIVENS} givens`);
    const brute = bruteForce(p.g, givens);
    assert.ok(!brute.aborted, 'brute force finished');
    assert.strictEqual(brute.solutions, 1, 'exactly one solution');
    assert.deepStrictEqual(brute.solution, expected, 'brute force finds the stored solution');
    assert.ok(brute.nodes <= MAX_BRUTE_NODES, `brute force nodes ${brute.nodes} <= ${MAX_BRUTE_NODES}`);
    const logic = logicSolve(regionProblem(p.g), givens);
    assert.deepStrictEqual(logic, expected, 'solvable by logic without guessing');
    for (const rule of p.g.rules) {
      const without = countSolutions(regionProblem(p.g, { rules: p.g.rules.filter(x => x !== rule) }), givens, 2);
      assert.ok(without.solutions >= 2, `rule ${rule} is required`);
    }
    report.push({ name: p.name, rules: p.g.rules.join('+') || 'classic', givens: givens.filter(Boolean).length, clues: (p.g.clues || []).length, nodes: brute.nodes });
  });
}

test.after(() => {
  if (!report.length) return;
  const pad = (s, n) => String(s).padEnd(n);
  const lines = report.map(x => `${pad(x.name, 18)}${pad(x.rules, 38)}${pad(x.givens, 8)}${pad(x.clues, 7)}${x.nodes}`);
  const nodes = report.map(x => x.nodes).sort((a, b) => a - b);
  console.log(['', `${pad('puzzle', 18)}${pad('rules', 38)}${pad('givens', 8)}${pad('clues', 7)}brute-force nodes`, ...lines,
    `median nodes ${nodes[nodes.length >> 1]}, max nodes ${nodes[nodes.length - 1]}`].join('\n'));
});
