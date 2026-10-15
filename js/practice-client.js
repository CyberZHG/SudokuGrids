const PracticeGen = {
  worker: null,
  pending: new Map(),
  seq: 0,

  start() {
    if (this.worker !== null) return this.worker;
    try {
      this.worker = new Worker('js/practice-worker.js');
      this.worker.onmessage = e => {
        const done = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        if (done) done(e.data.puzzle);
      };
      this.worker.onerror = () => {
        this.worker = false;
        for (const [id, done] of this.pending) done(this.local(done.rules, done.seed));
        this.pending.clear();
      };
    } catch {
      this.worker = false;
    }
    return this.worker;
  },

  local(rules, seed) {
    for (let i = 0; i < 4; i++) {
      const puzzle = Practice.generate(rules, (seed + i * 7919) >>> 0);
      if (puzzle) return puzzle;
    }
    return null;
  },

  request(rules) {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    return new Promise(resolve => {
      const worker = this.start();
      if (!worker) {
        setTimeout(() => resolve(this.local(rules, seed)), 30);
        return;
      }
      const id = ++this.seq;
      const done = puzzle => resolve(puzzle);
      done.rules = rules;
      done.seed = seed;
      this.pending.set(id, done);
      worker.postMessage({ id, rules, seed });
    });
  },
};
