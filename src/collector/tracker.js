export class BehaviorTracker {
  constructor({ inputs = [], motionTarget = document, submitTarget = null } = {}) {
    this.inputs = inputs;
    this.motionTarget = motionTarget;
    this.submitTarget = submitTarget;
    this.bound = {};
    this.reset();
  }

  reset() {
    this.down = new Map(); this.lastUp = null; this.dwells = []; this.flights = [];
    this.points = []; this.velocities = []; this.focusTimes = []; this.lastFocus = null;
    this.holds = []; this.pointerDown = null; this.trusted = true; this.startedAt = performance.now();
  }

  start() {
    this.reset();
    this.bound.keydown = e => this.onDown(e); this.bound.keyup = e => this.onUp(e);
    this.bound.move = e => this.onMove(e); this.bound.focus = e => this.onFocus(e);
    this.bound.blur = e => this.onBlur(e); this.bound.pointerdown = e => this.onPointerDown(e);
    this.bound.pointerup = e => this.onPointerUp(e);
    this.inputs.forEach(x => {
      x.addEventListener('keydown', this.bound.keydown);
      x.addEventListener('keyup', this.bound.keyup);
      x.addEventListener('focus', this.bound.focus);
      x.addEventListener('blur', this.bound.blur);
    });
    this.motionTarget.addEventListener('pointermove', this.bound.move, { passive: true });
    if (this.submitTarget) {
      this.submitTarget.addEventListener('pointerdown', this.bound.pointerdown);
      this.submitTarget.addEventListener('pointerup', this.bound.pointerup);
    }
    return this;
  }

  stop() {
    this.inputs.forEach(x => {
      x.removeEventListener('keydown', this.bound.keydown);
      x.removeEventListener('keyup', this.bound.keyup);
      x.removeEventListener('focus', this.bound.focus);
      x.removeEventListener('blur', this.bound.blur);
    });
    this.motionTarget.removeEventListener('pointermove', this.bound.move);
    if (this.submitTarget) {
      this.submitTarget.removeEventListener('pointerdown', this.bound.pointerdown);
      this.submitTarget.removeEventListener('pointerup', this.bound.pointerup);
    }
  }

  mark(e) { this.trusted = this.trusted && e.isTrusted === true; }

  onDown(e) {
    this.mark(e); const t = performance.now(); this.down.set(e.code, t);
    if (this.lastUp !== null) this.flights.push(t - this.lastUp);
  }

  onUp(e) {
    this.mark(e); const t = performance.now(), d = this.down.get(e.code);
    if (d !== undefined) this.dwells.push(t - d);
    this.lastUp = t;
  }

  onMove(e) {
    this.mark(e); const t = performance.now();
    const p = { x: e.clientX, y: e.clientY, t, type: e.pointerType || 'mouse' };
    const prev = this.points.at(-1);
    if (prev) {
      const d = Math.hypot(p.x - prev.x, p.y - prev.y), dt = t - prev.t;
      if (dt > 0 && d > 0) this.velocities.push(d / dt);
    }
    this.points.push(p);
  }

  onFocus(e) { this.mark(e); const t = performance.now(); if (this.lastFocus !== null) this.focusTimes.push(t - this.lastFocus); this.lastFocus = t; }
  onBlur(e) { this.mark(e); this.lastFocus = performance.now(); }
  onPointerDown(e) { this.mark(e); this.pointerDown = performance.now(); }
  onPointerUp(e) { this.mark(e); if (this.pointerDown !== null) this.holds.push(performance.now() - this.pointerDown); this.pointerDown = null; }

  getFeatureVector() {
    const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    const std = a => a.length < 2 ? 0 : Math.sqrt(avg(a.map(x => (x - avg(a)) ** 2)));
    const entropy = a => {
      if (a.length < 4) return 1;
      const bins = new Array(8).fill(0); const m = Math.max(avg(a), 1);
      a.forEach(v => bins[Math.min(7, Math.max(0, Math.floor(v / m * 4)))]++);
      return -bins.reduce((s, n) => { if (!n) return s; const p = n / a.length; return s + p * Math.log2(p); }, 0) / 3;
    };
    const sequenceNovelty = a => {
      if (a.length < 5) return 1;
      const q = a.map(v => Math.min(7, Math.max(0, Math.floor(v / Math.max(avg(a), 1) * 4))));
      const grams = []; for (let i = 0; i < q.length - 1; i++) grams.push(`${q[i]}-${q[i + 1]}`);
      return new Set(grams).size / Math.max(1, grams.length);
    };

    let arc = 0;
    for (let i = 1; i < this.points.length; i++) arc += Math.hypot(this.points[i].x - this.points[i - 1].x, this.points[i].y - this.points[i - 1].y);
    const a = this.points[0], b = this.points.at(-1), direct = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    return {
      meanDwellTime: avg(this.dwells), meanFlightTime: avg(this.flights), flightStdDev: std(this.flights),
      mouseCurvature: direct > 2 ? arc / direct : (this.points.length > 2 ? 1 : 0),
      mouseMaxVelocity: Math.max(0, ...this.velocities), mouseVelocityStd: std(this.velocities),
      focusBlurDelay: avg(this.focusTimes), clickHoldDuration: avg(this.holds),
      isTrustedEvent: this.trusted, flightCount: this.flights.length, mousePointCount: this.points.length,
      timingEntropy: entropy(this.flights), sequenceNovelty: sequenceNovelty(this.flights),
      flightTimes: [...this.flights]
    };
  }
}
