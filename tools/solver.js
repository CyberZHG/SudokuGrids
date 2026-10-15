const fs = require('fs');
const path = require('path');

function load(files, names) {
  const src = [].concat(files).map(f => fs.readFileSync(path.join(__dirname, '..', 'site', 'js', f), 'utf8')).join('\n');
  return new Function(`${src}\nreturn { ${names.join(', ')} };`)();
}

const shared = load(['model.js', 'solver.js', 'bruteforce.js', 'cluegen.js'], ['Model', 'RULE_IDS', 'RULE_ORDER', 'CLUE_RULE', 'LINE_TYPES', 'Solver', 'BruteForce', 'ClueGen']);

module.exports = {
  load,
  Model: shared.Model,
  RULE_IDS: shared.RULE_IDS,
  RULE_ORDER: shared.RULE_ORDER,
  CLUE_RULE: shared.CLUE_RULE,
  LINE_TYPES: shared.LINE_TYPES,
  ClueGen: shared.ClueGen,
  ...shared.Solver,
  ...shared.BruteForce,
};
