const Practice = (() => {
  const { regionProblem, randomFill, logicSolve, countSolutions, mulberry32, shuffle } = Solver;
  const MIN_GIVENS = 24;
  const FLOOR = { classic: 30, variant: 26 };
  const BRUTE_BUDGET = 6000;

  function rulesNeeded(g, givens) {
    for (const rule of g.rules) {
      const res = countSolutions(regionProblem(g, { rules: g.rules.filter(x => x !== rule) }), givens, 2, 20000);
      if (res.aborted || res.solutions < 2) return false;
    }
    return true;
  }

  function chooseGivens(g, val, rand, deadline) {
    const prob = regionProblem(g);
    const given = new Array(81).fill(true);
    const local = () => given.map((x, i) => (x ? val[i] : 0));
    const solvable = () => !!logicSolve(prob, local());
    const floor = g.rules.length ? FLOOR.variant : FLOOR.classic;
    let count = 81;
    for (const i of shuffle([...Array(81).keys()], rand)) {
      if (count <= floor) break;
      if (Date.now() > deadline) return null;
      given[i] = false;
      if (solvable()) count--;
      else given[i] = true;
    }
    const order = shuffle([...Array(81).keys()], rand);
    while (!rulesNeeded(g, local())) {
      if (Date.now() > deadline) return null;
      const at = order.find(i => {
        if (!given[i] || count <= MIN_GIVENS) return false;
        given[i] = false;
        if (solvable()) return true;
        given[i] = true;
        return false;
      });
      if (at === undefined) return null;
      count--;
    }
    const brute = BruteForce.bruteForce(g, local(), 2, BRUTE_BUDGET);
    return !brute.aborted && brute.solutions === 1 ? given : null;
  }

  function generate(rules, seed, timeLimit = 20000) {
    const rand = mulberry32(seed);
    const deadline = Date.now() + timeLimit;
    const g = { id: 0, r: 0, c: 0, rules: rules.slice() };
    const hard = rules.includes('antiConsecutive');
    while (Date.now() < deadline) {
      const val = randomFill(regionProblem(g), rand, { attempts: hard ? 8 : 3, limit: hard ? 3000 : 600 });
      if (!val) continue;
      const sol = (r, c) => val[r * 9 + c];
      g.clues = ClueGen.makeClues(g, sol, { cells: new Set(), edges: new Set() }, 1.1, rand);
      const given = chooseGivens(g, val, rand, deadline);
      if (given) return { rules: g.rules, clues: g.clues, solution: val.join(''), givens: given.map(x => (x ? '1' : '0')).join(''), seed };
    }
    return null;
  }

  return { generate, MIN_GIVENS };
})();
