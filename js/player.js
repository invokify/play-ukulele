// Lecture synchronisée : planification audio en avance + mise à jour visuelle à l'image près.

export class Player {
  constructor(audio, callbacks) {
    this.audio = audio;
    this.cb = callbacks; // { onColumn(i), onState(playing), onEnd() }
    this.columns = [];
    this.tuning = {};
    this.bpm = 90;
    this.cpb = 4; // colonnes (tirets) par temps
    this.speed = 1;
    this.metronome = false;
    this.loop = false;
    this.region = [0, 0];
    this.playing = false;
    this.position = -1;
    this.queue = [];
  }

  load(parsed) {
    this.pause();
    this.columns = parsed.columns;
    this.region = [0, this.columns.length];
    this.position = -1;
  }

  /** Durée d'une colonne (en secondes). */
  get sps() {
    return 60 / (this.bpm * this.speed * this.cpb);
  }

  hasPlayable(from, to) {
    for (let i = from; i < to; i++) if (!this.columns[i].bar) return true;
    return false;
  }

  play(fromCol) {
    if (this.playing) return;
    const [r0, r1] = this.region;
    if (!this.hasPlayable(r0, r1)) return;
    const ctx = this.audio.ensure();
    let start = fromCol ?? this.position;
    if (start == null || start < r0 || start >= r1) start = r0;
    this.nextCol = start;
    this.nextTime = ctx.currentTime + 0.08;
    this.endTime = null;
    this.queue = [];
    this.playing = true;
    this.timer = setInterval(() => this._schedule(), 25);
    this._schedule();
    this._frame();
    this.cb.onState?.(true);
  }

  _schedule() {
    const horizon = this.audio.ctx.currentTime + 0.15;
    let guard = 0;
    while (this.endTime === null && this.nextTime < horizon && guard++ < 2000) {
      if (this.nextCol >= this.region[1]) {
        if (this.loop) this.nextCol = this.region[0];
        else {
          this.endTime = this.nextTime;
          break;
        }
      }
      const i = this.nextCol++;
      const col = this.columns[i];
      if (col.bar) continue;
      if (col.notes.length) {
        this.audio.playColumn(
          col.notes.map((n) => ({ string: n.string, midi: this.tuning[n.string] + n.fret })),
          this.nextTime
        );
      }
      if (this.metronome && col.step % this.cpb === 0) {
        this.audio.click(this.nextTime, col.step % (this.cpb * 4) === 0);
      }
      this.queue.push({ col: i, time: this.nextTime });
      this.nextTime += this.sps;
    }
  }

  _frame() {
    if (!this.playing) return;
    const now = this.audio.ctx.currentTime;
    while (this.queue.length && this.queue[0].time <= now) {
      this.position = this.queue.shift().col;
      this.cb.onColumn?.(this.position);
    }
    if (this.endTime !== null && !this.queue.length && now >= this.endTime) {
      this._halt();
      this.position = this.region[0];
      this.cb.onEnd?.();
      return;
    }
    this.raf = requestAnimationFrame(() => this._frame());
  }

  _halt() {
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.queue = [];
    const was = this.playing;
    this.playing = false;
    if (was) this.cb.onState?.(false);
  }

  pause() {
    if (!this.playing) return;
    this._halt();
    this.audio.stopAll();
  }

  stop() {
    this.pause();
    this.audio.stopAll();
    this.position = this.region[0];
  }
}
