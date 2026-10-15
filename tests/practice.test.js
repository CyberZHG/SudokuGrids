const test = require('node:test');
const assert = require('node:assert');
const S = require('../tools/solver');

const { Practice } = S.load(['model.js', 'solver.js', 'bruteforce.js', 'cluegen.js', 'practice.js'], ['Practice']);
const { Model, regionProblem, logicSolve, countSolutions, bruteForce, verifySolution } = S;

const CASES = [[], ['thermo'], ['killer', 'parity'], ['diagonal', 'xv', 'whisper'], ['antiConsecutive'], ['quadruple', 'between'], ['regionSum', 'zipper', 'entropic']];

for (const rules of CASES) {
  test(`practice ${rules.join('+') || 'classic'}: valid, unique, every rule needed`, () => {
    const pz = Practice.generate(rules, 4242);
    assert.ok(pz, 'puzzle generated');
    const g = { id: 0, r: 0, c: 0, rules: pz.rules, clues: pz.clues };
    const sol = (r, c) => Number(pz.solution[r * 9 + c]);
    assert.deepStrictEqual(verifySolution(g, sol), []);
    const givens = Model.regionCells(g).map(([r, c]) => (pz.givens[r * 9 + c] === '1' ? sol(r, c) : 0));
    assert.ok(givens.filter(Boolean).length >= Practice.MIN_GIVENS);
    const brute = bruteForce(g, givens);
    assert.strictEqual(brute.solutions, 1);
    assert.deepStrictEqual(logicSolve(regionProblem(g), givens), Model.regionCells(g).map(([r, c]) => sol(r, c)));
    for (const rule of rules) assert.ok(countSolutions(regionProblem(g, { rules: rules.filter(x => x !== rule) }), givens, 2).solutions >= 2, `${rule} needed`);
  });
}
