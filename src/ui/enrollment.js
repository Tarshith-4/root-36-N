import { BehaviorTracker } from '../collector/tracker.js';
import { buildProfile } from '../engine/classifier.js';

const PASSES = 5;

export class EnrollmentFlow {
  constructor({ input, next, step, progress, onComplete }) {
    this.input = input; this.next = next; this.step = step; this.progress = progress; this.onComplete = onComplete;
    this.samples = []; this.tracker = null; this.pass = 0;
    next.addEventListener('click', () => this.capture());
    input.addEventListener('input', () => next.disabled = input.value.trim().length < 12);
  }
  begin() { this.pass = 0; this.samples = []; this.beginPass(); }
  beginPass() {
    this.pass++; this.input.value = ''; this.next.disabled = true; this.next.textContent = 'Confirm pass →';
    this.step.textContent = `Pass ${this.pass} of ${PASSES}`;
    this.progress.style.width = `${this.pass / PASSES * 100}%`;
    this.tracker?.stop();
    this.tracker = new BehaviorTracker({ inputs: [this.input], motionTarget: document, submitTarget: this.next }).start();
    // No auto-focus: the user must physically click into the field, just
    // like they do moving into the password field at login. Auto-focusing
    // via JS here previously meant enrollment mouse signals were captured
    // from an idle/reading mouse while login mouse signals were captured
    // from an active click-to-focus motion — an apples-to-oranges mismatch
    // baked into the profile.
  }
  capture() {
    const data = this.tracker.getFeatureVector(); this.tracker.stop();
    if (data.flightCount < 5) {
      this.next.disabled = true; this.next.textContent = 'Type a little more';
      setTimeout(() => { this.next.textContent = 'Confirm pass →'; this.next.disabled = false; }, 900);
      return;
    }
    this.samples.push(data);
    if (this.pass < PASSES) this.beginPass(); else this.onComplete(buildProfile(this.samples));
  }
}
