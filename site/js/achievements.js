const Achv = {
  unlocked: store.get('achv', {}),

  defs() {
    const s = Game.stats();
    const pct = (100 * s.regions) / s.regionsTotal;
    return [
      { id: 'first', group: 'completion', name: t('achv.first'), done: s.regions >= 1 },
      ...[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => ({ id: `pct${p}`, group: 'completion', name: t('achv.percent', { pct: p }), done: pct >= p })),
      ...RULE_IDS.map(r => ({ id: `trial.${r}`, group: 'trials', rule: r, name: t('achv.trial', { rule: ruleName(r) }), done: Game.won.has(r) })),
      { id: 'share', group: 'other', icon: 'share', name: t('achv.share'), done: !!this.unlocked.share },
    ];
  },

  unlock(id) {
    if (this.unlocked[id]) return;
    this.unlocked[id] = Date.now();
    store.set('achv', this.unlocked);
    const def = this.defs().find(d => d.id === id);
    if (def) toast(t('toast.achievement', { name: def.name }));
    if ($('#achvDlg').open) this.render();
  },

  check() {
    let changed = false;
    for (const d of this.defs()) {
      if (!d.done || this.unlocked[d.id]) continue;
      this.unlocked[d.id] = Date.now();
      changed = true;
      toast(t('toast.achievement', { name: d.name }));
    }
    if (changed) store.set('achv', this.unlocked);
  },

  open() {
    this.render();
    $('#achvDlg').showModal();
  },

  render() {
    const defs = this.defs();
    const got = defs.filter(d => this.unlocked[d.id]).length;
    $('#achvCount').textContent = t('achv.count', { done: got, total: defs.length });
    const s = Game.stats();
    $('#achvStats').replaceChildren(...[
      ['progress.regions', s.regions, s.regionsTotal],
      ['progress.rules', s.rules, s.rulesTotal],
      ['progress.cells', s.filled, s.total],
    ].map(([k, a, b]) => el('div', { className: 'tile' },
      el('div', { className: 'tile-label', textContent: t(k) }),
      el('div', { className: 'tile-value', textContent: `${Math.floor((100 * a) / b)}%` }),
      el('div', { className: 'tile-sub', textContent: `${a} / ${b}` }))));
    const list = $('#achvList');
    list.replaceChildren();
    for (const group of ['completion', 'trials', 'other']) {
      list.append(el('h3', { textContent: t(`achv.${group}`) }));
      const grid = el('div', { className: 'achv-grid' });
      for (const d of defs.filter(x => x.group === group)) {
        const at = this.unlocked[d.id];
        const icon = el('span', { className: 'achv-icon' });
        icon.innerHTML = d.rule ? RULE_ICONS[at ? d.rule : 'unknown'] : ICONS[d.icon || 'trophy'];
        grid.append(el('div', { className: `achv ${at ? 'got' : ''}` }, icon,
          el('div', {},
            el('div', { className: 'achv-name', textContent: d.name }),
            el('div', { className: 'achv-date', textContent: at ? dayKey(new Date(at)) : t('achv.locked') }))));
      }
      list.append(grid);
    }
  },
};
