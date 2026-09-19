const FEATURES = [
  'meanDwellTime',
  'meanFlightTime',
  'mouseCurvature',
  'mouseMaxVelocity',
  'focusBlurDelay',
  'clickHoldDuration'
];

const EPS = 1e-6;
const REGULARIZATION = 0.05;
const ACCEPT_THRESHOLD = 70;

const finite = n => Number.isFinite(n) ? n : 0;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const variance = a => a.length > 1 ? a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1) : 0;

function covarianceMatrix(samples) {
  const n = samples.length;
  const mu = Object.fromEntries(FEATURES.map(k => [k, mean(samples.map(s => finite(s[k])))]));
  const cov = FEATURES.map(a => FEATURES.map(b => {
    if (n < 2) return 0;
    let sum = 0;
    for (const s of samples) sum += (finite(s[a]) - mu[a]) * (finite(s[b]) - mu[b]);
    return sum / (n - 1);
  }));
  return { mean: mu, covariance: cov };
}

function regularize(covariance, means) {
  return covariance.map((row, i) => row.map((v, j) => {
    if (i !== j) return v;
    const scale = Math.max(Math.abs(v), 1, (Math.abs(means[FEATURES[i]]) * 0.05) ** 2);
    return finite(v) + REGULARIZATION * scale + EPS;
  }));
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < EPS) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map(row => row.slice(n));
}

function quadraticForm(vector, matrix) {
  const mv = matrix.map(row => row.reduce((s, v, i) => s + v * vector[i], 0));
  return vector.reduce((s, v, i) => s + v * mv[i], 0);
}

function buildNgramSignature(flights) {
  if (!flights || flights.length < 3) return {};
  const q = flights.map(v => Math.max(0, Math.min(7, Math.floor(v / Math.max(mean(flights), 1) * 4))));
  const grams = {};
  for (let i = 0; i < q.length - 1; i++) {
    const key = `${q[i]}-${q[i + 1]}`;
    grams[key] = (grams[key] || 0) + 1;
  }
  const total = Math.max(1, q.length - 1);
  return Object.fromEntries(Object.entries(grams).map(([k, v]) => [k, v / total]));
}

export function detectBot(f) {
  const reasons = [];
  if (!f.isTrustedEvent) reasons.push('Browser reported an untrusted/synthetic interaction event.');

  if (f.flightCount >= 4 && f.flightStdDev < Math.max(1.5, f.meanFlightTime * 0.015)) {
    reasons.push('Keystroke timing is unnaturally constant.');
  }

  if (f.flightCount >= 6 && f.timingEntropy < 0.55) {
    reasons.push('Keystroke timing distribution has unusually low entropy.');
  }

  if (f.flightCount >= 6 && f.sequenceNovelty < 0.18) {
    reasons.push('Typing sequence is dominated by repeated timing transitions.');
  }

  if (f.mousePointCount >= 8 && f.mouseCurvature > 0 && f.mouseCurvature < 1.003) {
    reasons.push('Pointer trajectory is near-perfectly linear.');
  }

  if (f.mousePointCount >= 8 && f.mouseVelocityStd < 0.05 && f.mouseMaxVelocity > 0) {
    reasons.push('Pointer velocity is suspiciously uniform.');
  }

  return { isBot: reasons.length > 0, reason: reasons.join(' ') };
}

export function buildProfile(samples) {
  const { mean: mu, covariance } = covarianceMatrix(samples);
  const inverse = invertMatrix(regularize(covariance, mu));
  const flightSequences = samples.flatMap(s => s.flightTimes || []);
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    features: FEATURES,
    mean: mu,
    covariance,
    inverseCovariance: inverse,
    sampleCount: samples.length,
    timingNgrams: buildNgramSignature(flightSequences),
    enrollmentPasses: samples.length
  };
}

function signalStatus(z) {
  return z < 1.15 ? 'normal' : z < 2.3 ? 'watch' : 'mismatch';
}

export function calculateConfidenceScore(live, profile) {
  const bot = detectBot(live);
  if (bot.isBot) return { score: 0, authenticated: false, bot: true, reason: bot.reason, signals: [], distance: Infinity, latencyMs: 0 };

  const start = performance.now();
  const vector = FEATURES.map(k => finite(live[k]) - finite(profile.mean[k]));
  const cov = profile.inverseCovariance || invertMatrix(regularize(profile.covariance || covarianceMatrix([{ ...live }]).covariance, profile.mean));
  const safeInverse = cov || invertMatrix(regularize(FEATURES.map((_, i) => FEATURES.map((_, j) => i === j ? 1 : 0)), profile.mean));
  const rawDistance = Math.sqrt(Math.max(0, quadraticForm(vector, safeInverse)));
  const distance = Math.min(rawDistance, 20);
  const score = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.5 * (distance / 3.0) ** 2))));

  const signals = FEATURES.map((key, i) => {
    const base = finite(profile.mean[key]);
    const scale = Math.sqrt(Math.max(finite(profile.covariance?.[i]?.[i]), 0)) || Math.max(2, Math.abs(base) * 0.08);
    const z = Math.abs(finite(live[key]) - base) / Math.max(scale, 2);
    const pct = base ? Math.round(((finite(live[key]) - base) / Math.abs(base)) * 100) : 0;
    return { key, live: finite(live[key]), baseline: base, z, delta: pct, status: signalStatus(z) };
  });

  const mismatches = signals.filter(x => x.status === 'mismatch').sort((a, b) => b.z - a.z);
  const reason = score >= ACCEPT_THRESHOLD
    ? 'Your multi-signal behavioral fingerprint matches the enrolled profile.'
    : `${pretty(mismatches[0]?.key || 'behavior')} deviated from the enrolled fingerprint.`;

  return {
    score,
    authenticated: score >= ACCEPT_THRESHOLD,
    bot: false,
    reason,
    signals,
    distance: Number(distance.toFixed(3)),
    threshold: ACCEPT_THRESHOLD,
    latencyMs: Number((performance.now() - start).toFixed(3))
  };
}

export function updateAdaptiveProfile(profile, live) {
  const n = Math.max(1, profile.sampleCount || 1);
  const oldMean = { ...profile.mean };
  const newN = n + 1;
  const newMean = { ...profile.mean };
  for (const key of FEATURES) newMean[key] = oldMean[key] + (finite(live[key]) - oldMean[key]) / newN;

  const oldCov = profile.covariance || FEATURES.map(() => FEATURES.map(() => 0));
  const newCov = oldCov.map(row => [...row]);
  for (let i = 0; i < FEATURES.length; i++) {
    for (let j = 0; j < FEATURES.length; j++) {
      const di = finite(live[FEATURES[i]]) - oldMean[FEATURES[i]];
      const dj = finite(live[FEATURES[j]]) - oldMean[FEATURES[j]];
      newCov[i][j] = ((n - 1) * newCov[i][j] + (di * dj * n / newN)) / Math.max(1, newN - 1);
    }
  }

  const inverse = invertMatrix(regularize(newCov, newMean));
  return { ...profile, mean: newMean, covariance: newCov, inverseCovariance: inverse, sampleCount: newN, updatedAt: new Date().toISOString() };
}

export const pretty = s => s.replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase());
export { FEATURES, ACCEPT_THRESHOLD };
