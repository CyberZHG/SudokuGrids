const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const ch of children) if (ch != null) node.append(ch);
  return node;
};

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('sg.' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('sg.' + k, JSON.stringify(v));
    } catch {}
  },
  clear() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sg.')) localStorage.removeItem(k);
    } catch {}
  },
};

const settings = Object.assign({ theme: document.documentElement.dataset.theme || 'dark', autoCheck: false, lang: '' }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);

function toast(msg) {
  const node = el('div', { className: 'toast', textContent: msg });
  $('#toasts').append(node);
  setTimeout(() => node.classList.add('out'), 3200);
  setTimeout(() => node.remove(), 3600);
}

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const typing = () => {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
};

const dialogOpen = () => !!document.querySelector('dialog[open]');
