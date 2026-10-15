function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  $('meta[name="theme-color"]').setAttribute('content', settings.theme === 'light' ? '#ffffff' : '#1b1e23');
  $('#themeBtn').innerHTML = settings.theme === 'light' ? ICONS.moon : ICONS.sun;
  Render.loadColors();
  View.request();
}

function bindDialogs() {
  $('#helpBtn').onclick = () => $('#helpDlg').showModal();
  $('#achvBtn').onclick = () => Achv.open();
  $('#settingsBtn').onclick = () => {
    $('#autoCheck').checked = settings.autoCheck;
    $('#settingsDlg').showModal();
  };
  $('#themeBtn').onclick = () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    saveSettings();
    applyTheme();
  };
  for (const btn of $$('[data-close]')) btn.onclick = () => btn.closest('dialog').close();
  for (const dlg of $$('dialog')) {
    dlg.addEventListener('click', e => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  }
  const langSel = $('#langSel');
  langSel.replaceChildren(...LANGS.map(l => el('option', { value: l.id, textContent: l.name })));
  langSel.value = lang;
  langSel.onchange = () => {
    setLang(langSel.value);
    Panel.render();
  };
  $('#autoCheck').onchange = e => {
    settings.autoCheck = e.target.checked;
    saveSettings();
    View.request();
  };
  $('#resetBtn').onclick = () => confirmAction(t('settings.resetConfirm'), () => {
    $('#settingsDlg').close();
    Game.reset();
    View.focusCurrent();
  });
  $('#confirmOk').onclick = () => {
    $('#confirmDlg').close();
    const fn = confirmAction.pending;
    confirmAction.pending = null;
    if (fn) fn();
  };
  $('#exportBtn').onclick = () => Backup.exportFile();
  $('#importFile').onchange = e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) Backup.importFile(file);
  };
  $('#winBack').onclick = () => {
    $('#winDlg').close();
    Game.leaveBoss();
  };
}

function confirmAction(text, fn) {
  $('#confirmText').textContent = text;
  confirmAction.pending = fn;
  $('#confirmDlg').showModal();
}

function showWin() {
  const rule = Game.mode;
  const icon = $('#winIcon');
  icon.innerHTML = RULE_ICONS[rule];
  $('#winRule').textContent = ruleName(rule);
  $('#winDesc').textContent = ruleDesc(rule);
  $('#winDlg').showModal();
}

Game.init();
applyIcons();
applyI18n();
Render.loadColors();
View.init();
Panel.init();
bindDialogs();
bindShare();
Backup.bindDrop();
applyTheme();
Panel.render();
Achv.check();

Game.onChange((kind, data) => {
  if (kind === 'flash') {
    Render.flash(data.done, 'done');
    Render.flash(data.revealed, 'new');
    return;
  }
  if (kind === 'mode') {
    Panel.pinned = Game.sel;
    View.hover = -1;
    View.restoreCamera();
    Panel.render();
  } else if (kind === 'select') {
    Panel.renderInfo();
  } else if (kind === 'values') {
    Panel.renderProgress();
  } else {
    Panel.render();
  }
  if (kind === 'won') showWin();
  View.request();
});

addEventListener('storage', e => {
  if (e.key && e.key.startsWith('sg.')) location.reload();
});

if (!store.get('seenHelp', false)) {
  store.set('seenHelp', true);
  $('#helpDlg').showModal();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
