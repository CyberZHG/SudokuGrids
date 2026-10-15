const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { RULE_IDS } = require('../tools/solver');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', 'js', f), 'utf8');
const { I18N, LANGS } = new Function('settings', 'navigator', `${read('i18n.js')}\nreturn { I18N, LANGS };`)({}, { languages: ['en'] });
const { RULE_ICONS } = new Function(`${read('icons.js')}\nreturn { RULE_ICONS };`)();

test('every language defines the same keys', () => {
  const base = Object.keys(I18N.en).sort();
  for (const { id } of LANGS) {
    assert.ok(I18N[id], `dictionary for ${id}`);
    assert.deepStrictEqual(Object.keys(I18N[id]).sort(), base, `keys of ${id}`);
    for (const [k, v] of Object.entries(I18N[id])) assert.ok(v.trim(), `${id} ${k} is not empty`);
  }
});

test('every rule has a name, description and icon', () => {
  for (const rule of ['classic', ...RULE_IDS]) {
    for (const { id } of LANGS) {
      assert.ok(I18N[id][`rule.${rule}.name`], `${id} name of ${rule}`);
      assert.ok(I18N[id][`rule.${rule}.desc`], `${id} description of ${rule}`);
    }
    assert.ok(RULE_ICONS[rule], `icon of ${rule}`);
  }
});

test('placeholders match across languages', () => {
  const vars = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const { id } of LANGS) {
    for (const k of Object.keys(I18N.en)) assert.strictEqual(vars(I18N[id][k]), vars(I18N.en[k]), `${id} ${k}`);
  }
});
