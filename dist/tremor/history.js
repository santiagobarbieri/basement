// Snapshots own settings; completed gesture samples are immutable and shared.
export class History {
  constructor(limit = 100) { this.limit = limit; this.past = []; this.future = []; }
  commit(before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    this.past.push({ before, after });
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
    return true;
  }
  undo() { const entry = this.past.pop(); if (!entry) return null; this.future.push(entry); return entry.before; }
  redo() { const entry = this.future.pop(); if (!entry) return null; this.past.push(entry); return entry.after; }
}
