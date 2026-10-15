const Panel = {
  pinned: -1,
  infoKey: '',
  picked: new Set(store.get('practiceRules', [])),
  generating: false,

  init() {
    const pad = $('#pad');
    for (let d = 1; d <= 9; d++) {
      const btn = el('button', { type: 'button', className: 'digit', textContent: d });
      let timer = 0, long = false;
      btn.addEventListener('pointerdown', () => {
        long = false;
        timer = setTimeout(() => {
          long = true;
          Game.input(d, true);
        }, 450);
      });
      const cancel = () => clearTimeout(timer);
      btn.addEventListener('pointerup', cancel);
      btn.addEventListener('pointerleave', cancel);
      btn.addEventListener('contextmenu', e => e.preventDefault());
      btn.onclick = () => {
        if (!long) Game.input(d, false);
        long = false;
      };
      pad.append(btn);
    }
    $('#collapseBtn').onclick = () => {
      settings.panelCollapsed = !settings.panelCollapsed;
      saveSettings();
      this.renderCollapse();
    };
    $('#practiceBtn').onclick = () => this.generate([...this.picked]);
    $('#againBtn').onclick = () => Game.practice && this.generate(Game.practice.rules);
    this.renderCollapse();
    $('#notesBtn').onclick = () => this.toggleNotes();
    $('#eraseBtn').onclick = () => Game.erase();
    $('#undoBtn').onclick = () => Game.undo(false);
    $('#redoBtn').onclick = () => Game.undo(true);
    $('#leaveBtn').onclick = () => Game.leaveBoss();
    this.pinned = Game.sel;
  },

  pin(i) {
    this.pinned = i;
    this.renderInfo();
  },

  toggleNotes() {
    Game.notesMode = !Game.notesMode;
    this.renderPad();
  },

  render() {
    this.infoKey = '';
    this.renderInfo();
    this.renderPad();
    this.renderTrials();
    this.renderProgress();
    this.renderPractice();
    $('#bossBanner').hidden = Game.isMap();
    $('#bossTitle').textContent = Game.isBoss() ? t('trials.name', { rule: ruleName(Game.mode) }) : Game.isPractice() ? this.practiceName(Game.practice.rules) : '';
    $('#againBtn').hidden = !Game.isPractice();
  },

  renderCollapse() {
    $('.side').classList.toggle('collapsed', !!settings.panelCollapsed);
    $('#collapseBtn').textContent = t(settings.panelCollapsed ? 'panel.expand' : 'panel.collapse');
  },

  practiceName(rules) {
    return t('practice.name', { rules: (rules.length ? rules : ['classic']).map(ruleName).join(' + ') });
  },

  renderPractice() {
    const card = $('#practiceCard');
    card.hidden = !Game.isMap();
    if (card.hidden) return;
    const learned = RULE_ORDER.filter(r => Game.rules.has(r));
    for (const r of [...this.picked]) if (!learned.includes(r)) this.picked.delete(r);
    const list = $('#practiceRules');
    list.replaceChildren(...learned.map(r => {
      const chip = el('button', { type: 'button', className: `chip ${this.picked.has(r) ? 'on' : ''}`, title: ruleName(r) });
      chip.setAttribute('aria-pressed', this.picked.has(r));
      const icon = el('span', { className: 'chip-icon' });
      icon.innerHTML = RULE_ICONS[r];
      chip.append(icon, el('span', { textContent: ruleName(r) }));
      chip.onclick = () => {
        if (this.picked.has(r)) this.picked.delete(r);
        else if (this.picked.size >= 3) return toast(t('practice.max'));
        else this.picked.add(r);
        store.set('practiceRules', [...this.picked]);
        this.renderPractice();
      };
      return chip;
    }));
    $('#practiceBtn').disabled = this.generating;
    $('#practiceBtn').textContent = t(this.generating ? 'practice.generating' : 'practice.generate');
    const resume = $('#practiceResume');
    resume.hidden = !Game.practice || Game.practiceDone;
    resume.textContent = Game.practice ? `${t('practice.continue')}: ${this.practiceName(Game.practice.rules)}` : '';
    resume.onclick = () => Game.setMode('practice');
  },

  generate(rules) {
    if (this.generating) return;
    this.generating = true;
    this.renderPractice();
    $('#againBtn').disabled = true;
    PracticeGen.request(rules).then(puzzle => {
      this.generating = false;
      $('#againBtn').disabled = false;
      if (!puzzle) {
        toast(t('practice.failed'));
        this.renderPractice();
        return;
      }
      Game.startPractice(puzzle);
    });
  },

  ruleRow(rule, known = true) {
    const row = el('div', { className: 'rule' });
    const icon = el('span', { className: 'rule-icon' });
    icon.innerHTML = RULE_ICONS[known ? rule : 'unknown'];
    const text = el('div', {}, el('div', { className: 'rule-name', textContent: known ? ruleName(rule) : t('region.unknownRule') }));
    if (known) text.append(el('div', { className: 'rule-desc', textContent: ruleDesc(rule) }));
    row.append(icon, text);
    return row;
  },

  trialButton(rule) {
    const btn = el('button', { type: 'button', className: 'primary trial-btn', textContent: t('trials.name', { rule: ruleName(rule) }) });
    btn.onclick = () => Game.enterBoss(rule);
    return btn;
  },

  regionBlock(g) {
    const st = Game.status;
    const state = st.done[g.gi] ? 'done' : st.visible[g.gi] ? 'open' : st.frontier[g.gi] ? 'frontier' : 'hidden';
    const box = el('div', { className: 'region' });
    box.append(el('div', { className: 'region-head' },
      el('span', { className: 'region-name', textContent: t('region.name', { n: g.id + 1 }) }),
      el('span', { className: `tag tag-${state}`, textContent: t(`region.${state}`) })));
    if (state === 'hidden') {
      box.append(el('p', { className: 'muted', textContent: t('region.hiddenDesc') }));
      return box;
    }
    if (state === 'frontier') {
      box.append(this.ruleRow('unknown', false));
      box.append(el('p', { className: 'muted', textContent: t('region.frontierDesc') }));
      for (const r of g.rules) if (!Game.rules.has(r)) box.append(this.trialButton(r));
      return box;
    }
    for (const r of g.rules.length ? g.rules : ['classic']) box.append(this.ruleRow(r));
    return box;
  },

  renderInfo() {
    const target = View.hover >= 0 ? View.hover : this.pinned;
    const key = [Game.mode, target, Game.done.size, Game.rules.size, Game.won.size, Game.practiceDone, Game.practice && Game.practice.seed, lang].join('|');
    if (key === this.infoKey) return;
    this.infoKey = key;
    const info = $('#info');
    info.replaceChildren();
    if (Game.isPractice()) {
      $('#infoTitle').textContent = this.practiceName(Game.practice.rules);
      info.append(this.ruleRow('classic'), ...Game.practice.rules.map(r => this.ruleRow(r)));
      if (Game.practiceDone) {
        info.append(el('p', { className: 'ok', textContent: t('practice.done') }));
        const again = el('button', { type: 'button', className: 'primary', textContent: t('practice.again') });
        again.onclick = () => this.generate(Game.practice.rules);
        info.append(again);
      }
      return;
    }
    if (Game.isBoss()) {
      $('#infoTitle').textContent = t('trials.name', { rule: ruleName(Game.mode) });
      info.append(el('p', { className: 'muted', textContent: t('boss.intro') }), this.ruleRow('classic'), this.ruleRow(Game.mode));
      if (Game.won.has(Game.mode)) {
        info.append(el('p', { className: 'ok', textContent: t('boss.solved') }));
        const back = el('button', { type: 'button', className: 'primary', textContent: t('boss.leave') });
        back.onclick = () => Game.leaveBoss();
        info.append(back);
      }
      return;
    }
    $('#infoTitle').textContent = t('info.title');
    const regions = Game.regionsOf(target);
    if (!regions.length) {
      info.append(el('p', { className: 'muted', textContent: t('info.empty') }));
      return;
    }
    const known = regions.filter(g => Game.status.visible[g.gi] || Game.status.frontier[g.gi]);
    if (known.length > 1) info.append(el('p', { className: 'muted', textContent: t('region.overlap', { count: known.length }) }));
    for (const g of regions.length > 1 && known.length ? known : regions) info.append(this.regionBlock(g));
  },

  renderPad() {
    const btn = $('#notesBtn');
    btn.classList.toggle('on', Game.notesMode);
    btn.setAttribute('aria-pressed', Game.notesMode);
  },

  renderTrials() {
    const card = $('#trialCard');
    card.hidden = !Game.isMap();
    if (card.hidden) return;
    const list = $('#trials');
    list.replaceChildren();
    const trials = Game.trials();
    if (!trials.length) list.append(el('p', { className: 'muted', textContent: t('trials.none') }));
    for (const r of trials) {
      const row = el('div', { className: 'trial' });
      const icon = el('span', { className: 'rule-icon' });
      icon.innerHTML = RULE_ICONS.unknown;
      const btn = el('button', { type: 'button', className: 'primary', textContent: t('trials.start') });
      btn.onclick = () => Game.enterBoss(r);
      row.append(icon, el('span', { className: 'trial-name', textContent: ruleName(r) }), btn);
      list.append(row);
    }
  },

  renderProgress() {
    const card = $('#progressCard');
    card.hidden = !Game.isMap();
    if (card.hidden) return;
    const s = Game.stats();
    const rows = [
      ['progress.regions', s.regions, s.regionsTotal],
      ['progress.rules', s.rules, s.rulesTotal],
      ['progress.cells', s.filled, s.total],
    ];
    $('#progress').replaceChildren(...rows.map(([key, a, b]) => {
      const bar = el('div', { className: 'bar-track' }, el('div', { className: 'bar-fill' }));
      bar.firstChild.style.width = `${(100 * a) / b}%`;
      return el('div', { className: 'stat' },
        el('div', { className: 'stat-head' }, el('span', { textContent: t(key) }), el('span', { className: 'num', textContent: `${a} / ${b}` })),
        bar);
    }));
  },
};
