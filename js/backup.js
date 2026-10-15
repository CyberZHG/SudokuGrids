const Backup = {
  bindDrop() {
    const overlay = $('#dropOverlay');
    let depth = 0;
    const hasFile = e => [...(e.dataTransfer?.types || [])].includes('Files');
    addEventListener('dragenter', e => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth++;
      overlay.hidden = false;
    });
    addEventListener('dragover', e => {
      if (!hasFile(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    addEventListener('dragleave', e => {
      if (!hasFile(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) overlay.hidden = true;
    });
    addEventListener('drop', e => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      overlay.hidden = true;
      const file = e.dataTransfer.files[0];
      if (!file) return;
      for (const dlg of $$('dialog[open]')) dlg.close();
      this.importFile(file);
    });
  },

  exportFile() {
    const data = {};
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sg.') && k !== 'sg.settings') data[k.slice(3)] = JSON.parse(localStorage.getItem(k));
    } catch {}
    const blob = new Blob([JSON.stringify({ app: APP_NAME, version: 1, exported: new Date().toISOString(), data })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    el('a', { href: url, download: `${APP_NAME}-backup-${dayKey()}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async importFile(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return toast(t('backup.invalid'));
    }
    if (!parsed || parsed.app !== APP_NAME || typeof parsed.data !== 'object') return toast(t('backup.invalid'));
    if (parsed.data.data !== store.get('data', null)) return toast(t('backup.mismatch'));
    confirmAction(t('backup.confirm'), () => {
      store.clear();
      store.set('settings', settings);
      for (const [k, v] of Object.entries(parsed.data)) store.set(k, v);
      location.reload();
    });
  },
};
