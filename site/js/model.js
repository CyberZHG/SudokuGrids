const RULE_IDS = ['diagonal', 'antiKing', 'antiKnight', 'windoku', 'disjoint', 'antiConsecutive', 'consecutive', 'double', 'xv', 'greater', 'quadruple', 'parity', 'thermo', 'arrow', 'killer', 'palindrome', 'whisper', 'renban', 'between', 'entropic', 'modular', 'zipper', 'regionSum'];

const RULE_ORDER = ['consecutive', 'killer', 'thermo', 'diagonal', 'parity', 'xv', 'arrow', 'double', 'greater', 'antiKing', 'whisper', 'windoku', 'renban', 'between', 'quadruple', 'antiKnight', 'palindrome', 'disjoint', 'entropic', 'zipper', 'antiConsecutive', 'modular', 'regionSum'];

const CLUE_RULE = {
  white: 'consecutive',
  black: 'double',
  x: 'xv',
  v: 'xv',
  gt: 'greater',
  even: 'parity',
  odd: 'parity',
  thermo: 'thermo',
  arrow: 'arrow',
  killer: 'killer',
  palindrome: 'palindrome',
  whisper: 'whisper',
  renban: 'renban',
  between: 'between',
  quad: 'quadruple',
  entropic: 'entropic',
  modular: 'modular',
  zipper: 'zipper',
  regionSum: 'regionSum',
};

const LINE_TYPES = ['thermo', 'arrow', 'palindrome', 'whisper', 'renban', 'between', 'entropic', 'modular', 'zipper', 'regionSum'];

const Model = {
  regionCells(g) {
    const out = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) out.push([g.r + r, g.c + c]);
    return out;
  },

  contains(g, r, c) {
    return r >= g.r && r < g.r + 9 && c >= g.c && c < g.c + 9;
  },

  units(g) {
    const at = (r, c) => [g.r + r, g.c + c];
    const units = [];
    for (let i = 0; i < 9; i++) {
      const row = [], col = [], box = [];
      for (let j = 0; j < 9; j++) {
        row.push(at(i, j));
        col.push(at(j, i));
        box.push(at(Math.floor(i / 3) * 3 + Math.floor(j / 3), (i % 3) * 3 + (j % 3)));
      }
      units.push(row, col, box);
    }
    if (g.rules.includes('diagonal')) {
      const a = [], b = [];
      for (let i = 0; i < 9; i++) {
        a.push(at(i, i));
        b.push(at(i, 8 - i));
      }
      units.push(a, b);
    }
    if (g.rules.includes('windoku')) {
      for (const [br, bc] of Model.WINDOKU) {
        const box = [];
        for (let j = 0; j < 9; j++) box.push(at(br + Math.floor(j / 3), bc + (j % 3)));
        units.push(box);
      }
    }
    if (g.rules.includes('disjoint')) {
      for (let k = 0; k < 9; k++) {
        const group = [];
        for (let b = 0; b < 9; b++) group.push(at(Math.floor(b / 3) * 3 + Math.floor(k / 3), (b % 3) * 3 + (k % 3)));
        units.push(group);
      }
    }
    return units;
  },

  nonConsecutive(g) {
    if (!g.rules.includes('antiConsecutive')) return [];
    const out = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (r < 8) out.push([[g.r + r, g.c + c], [g.r + r + 1, g.c + c]]);
        if (c < 8) out.push([[g.r + r, g.c + c], [g.r + r, g.c + c + 1]]);
      }
    }
    return out;
  },

  WINDOKU: [[1, 1], [1, 5], [5, 1], [5, 5]],

  pairs(g) {
    const offs = [];
    if (g.rules.includes('antiKing')) offs.push([1, 1], [1, -1]);
    if (g.rules.includes('antiKnight')) offs.push([1, 2], [1, -2], [2, 1], [2, -1]);
    const out = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        for (const [dr, dc] of offs) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 < 9 && c2 >= 0 && c2 < 9) out.push([[g.r + r, g.c + c], [g.r + r2, g.c + c2]]);
        }
      }
    }
    return out;
  },

  check(k, v) {
    const n = v.length, a = v[0], b = v[1];
    switch (k.type) {
      case 'white': return !a || !b || Math.abs(a - b) === 1;
      case 'black': return !a || !b || a === 2 * b || b === 2 * a;
      case 'x': return !a || !b || a + b === 10;
      case 'v': return !a || !b || a + b === 5;
      case 'gt': return !a || !b || a > b;
      case 'even': return !a || a % 2 === 0;
      case 'odd': return !a || a % 2 === 1;
      case 'thermo':
        for (let i = 0; i < n; i++) {
          if (!v[i]) continue;
          if (v[i] < i + 1 || v[i] > 9 - (n - 1 - i)) return false;
          for (let j = i + 1; j < n; j++) if (v[j] && v[j] - v[i] < j - i) return false;
        }
        return true;
      case 'whisper':
        for (let i = 0; i + 1 < n; i++) if (v[i] && v[i + 1] && Math.abs(v[i] - v[i + 1]) < 5) return false;
        return true;
      case 'palindrome':
        for (let i = 0; i < n - 1 - i; i++) if (v[i] && v[n - 1 - i] && v[i] !== v[n - 1 - i]) return false;
        return true;
      case 'killer': {
        let s = 0, rem = 0, seen = 0;
        for (const x of v) {
          if (!x) {
            rem++;
            continue;
          }
          if (seen & (1 << x)) return false;
          seen |= 1 << x;
          s += x;
        }
        return rem ? s + rem <= k.sum && s + 9 * rem >= k.sum : s === k.sum;
      }
      case 'arrow': {
        let s = 0, rem = 0;
        for (let i = 1; i < n; i++) v[i] ? (s += v[i]) : rem++;
        if (s + rem > (a || 9)) return false;
        if (a && !rem) return s === a;
        return !a || s + 9 * rem >= a;
      }
      case 'between': {
        const e1 = v[0], e2 = v[n - 1];
        if (e1 && e2) {
          if (Math.abs(e1 - e2) < 2) return false;
          const lo = Math.min(e1, e2), hi = Math.max(e1, e2);
          for (let i = 1; i < n - 1; i++) if (v[i] && (v[i] <= lo || v[i] >= hi)) return false;
          return true;
        }
        const e = e1 || e2;
        let below = false, above = false;
        for (let i = 1; i < n - 1; i++) {
          if (!v[i]) continue;
          if (e && v[i] === e) return false;
          if (v[i] === 1 || v[i] === 9) return false;
          if (e) v[i] < e ? (below = true) : (above = true);
        }
        return !(below && above);
      }
      case 'entropic':
      case 'modular': {
        const cls = k.type === 'entropic' ? x => Math.floor((x - 1) / 3) : x => x % 3;
        for (let i = 0; i < n; i++) {
          if (!v[i]) continue;
          for (let j = i + 1; j < Math.min(n, i + 3); j++) if (v[j] && cls(v[i]) === cls(v[j])) return false;
        }
        return true;
      }
      case 'zipper': {
        if (n % 2) {
          const mid = v[(n - 1) / 2];
          for (let i = 0; i < (n - 1) / 2; i++) {
            const x = v[i], y = v[n - 1 - i];
            if (mid && x && y && x + y !== mid) return false;
            if (mid && ((x && x >= mid) || (y && y >= mid))) return false;
            if (!mid && x && y && x + y > 9) return false;
          }
          return true;
        }
        let total = 0;
        for (let i = 0; i < n / 2; i++) {
          const x = v[i], y = v[n - 1 - i];
          if (!x || !y) continue;
          if (total && x + y !== total) return false;
          total = x + y;
        }
        return true;
      }
      case 'regionSum': {
        const segs = [];
        k.cells.forEach(([r, c], i) => {
          const box = Math.floor(r / 3) * 1000 + Math.floor(c / 3);
          const last = segs[segs.length - 1];
          if (last && last.box === box) last.idx.push(i);
          else segs.push({ box, idx: [i] });
        });
        let target = 0;
        for (const sg of segs) {
          if (sg.idx.some(i => !v[i])) continue;
          const sum = sg.idx.reduce((a, i) => a + v[i], 0);
          if (target && sum !== target) return false;
          target = sum;
        }
        if (target) {
          for (const sg of segs) {
            let sum = 0, rem = 0;
            for (const i of sg.idx) v[i] ? (sum += v[i]) : rem++;
            if (rem && (sum + rem > target || sum + 9 * rem < target)) return false;
          }
        }
        return true;
      }
      case 'quad': {
        const need = k.digits.slice();
        let free = 0;
        for (const x of v) {
          if (!x) {
            free++;
            continue;
          }
          const at = need.indexOf(x);
          if (at >= 0) need.splice(at, 1);
        }
        return need.length <= free;
      }
      case 'renban': {
        let lo = 10, hi = 0, seen = 0;
        for (const x of v) {
          if (!x) continue;
          if (seen & (1 << x)) return false;
          seen |= 1 << x;
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
        return hi - lo <= n - 1;
      }
    }
    return false;
  },

  key(r, c) {
    return r * 1000 + c;
  },
};
