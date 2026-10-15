importScripts('model.js', 'solver.js', 'bruteforce.js', 'cluegen.js', 'practice.js');

onmessage = e => {
  const { id, rules, seed } = e.data;
  let puzzle = null;
  for (let i = 0; i < 4 && !puzzle; i++) puzzle = Practice.generate(rules, (seed + i * 7919) >>> 0);
  postMessage({ id, puzzle });
};
