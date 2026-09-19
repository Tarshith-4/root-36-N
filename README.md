# BioPrint: Behavior-Based Login Security

BioPrint is a browser-local behavioral authentication gate for the BioPrint hackathon. It learns a user's interaction fingerprint from typing and pointer behavior, then evaluates each login using a regularized **6-dimensional Mahalanobis distance**. A separate anti-automation layer looks for synthetic events, unnaturally constant timing, low timing entropy, repeated timing transitions, and overly linear pointer motion.

## What changed in v2

- **Mahalanobis matching** over six behavioral features instead of independent Z-scores.
- **Regularized covariance** so the small enrollment set remains numerically stable.
- **Jitter-resistant bot checks** using timing variance, timing entropy, timing-sequence novelty, pointer curvature, pointer velocity variance, and `isTrusted`.
- **Adaptive baseline**: accepted genuine attempts update the mean/covariance incrementally.
- **Pointer/touch support** through Pointer Events.
- **Reliability lab** in the demo UI for recording real genuine/impostor trials and calculating FAR/FRR.
- **Real Chrome Manifest V3 content script**. Forms marked `data-bioprint-login` are protected by the extension on local HTTP/HTTPS pages.

## Run the website demo

```powershell
cd BioPrint-Hackathon-Project
python -m http.server 8080
```

Open `http://localhost:8080`.

1. Create a profile using **five natural typing passes**.
2. Authenticate normally.
3. Have another person deliberately type differently and submit.
4. Use **Run bot script simulator** for the automated-attempt demonstration.
5. Use the Reliability Lab to record repeated genuine/impostor attempts.

The website stores its profile locally under `localStorage` key `bioprint_profile`.

## Run the Chrome extension

1. Start the local server above.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` directory.
6. Open the BioPrint extension popup and enroll the profile.
7. Visit `http://localhost:8080`.

The login form is explicitly marked `data-bioprint-login`. The extension's `content.js` is injected by `manifest.json` and performs the behavioral gate before the page receives the submit event. This is a real Manifest V3 content-script flow, not merely a popup mock-up.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/collector/tracker.js` | Collects dwell time, flight time, timing variance/entropy, pointer curvature/velocity, focus transitions, click hold, and trusted-event state. |
| `src/engine/classifier.js` | Builds the 6D covariance model, regularizes/inverts it, calculates Mahalanobis distance, maps it to confidence, and performs adaptive updates. |
| `src/ui/enrollment.js` | Captures five calibration passes and builds the behavioral profile. |
| `src/ui/dashboard.js` | Shows confidence, signal deviations, Mahalanobis distance, latency, and the decision explanation. |
| `extension/content.js` | Injected by Chrome into protected login forms and enforces the behavioral gate before submission. |
| `extension/manifest.json` | Manifest V3 extension definition and content-script registration. |

## Behavioral model

The fingerprint vector is:

`[meanDwellTime, meanFlightTime, mouseCurvature, mouseMaxVelocity, focusBlurDelay, clickHoldDuration]`

For a live vector `x`, enrolled mean `μ`, and regularized covariance `Σ`, BioPrint computes:

`D_M(x) = sqrt((x-μ)^T Σ^-1 (x-μ))`

The score is a bounded monotonic transform of the distance. A score of **70 or above** is the demo acceptance threshold. Covariance diagonal loading is used to keep the inverse stable with a small calibration set.

## Anti-bot layer

The behavioral matcher is not the only gate. The system separately checks:

- browser `event.isTrusted` state;
- near-zero flight-time variance;
- unusually low timing entropy;
- low novelty in adjacent timing transitions;
- near-perfectly linear pointer paths;
- suspiciously uniform pointer velocity.

These are defense-in-depth indicators, not a proof that an attacker is automated.

## Adaptive profile

Only an accepted, non-bot login updates the profile. The update is an online mean/covariance update; blocked and rejected attempts never train the profile.

## FAR / FRR evaluation

The UI includes a small Reliability Lab. Record each **real** attempt with the correct label after the trial:

- FAR = false accepts / impostor attempts
- FRR = false rejects / genuine attempts

Do not use the enrollment passes themselves as evaluation data. For the hackathon claim, collect at least 10 genuine trials and 10 impostor trials across multiple sessions/users if possible. The repository deliberately does **not** invent FAR/FRR values.

## Self-test

Run:

```powershell
npm test
```

The self-test checks Mahalanobis matching, an obvious impostor, and the anti-bot layer. These are automated sanity checks and are **not** substitutes for human FAR/FRR measurements.

## Privacy and limitations

Raw event streams are aggregated in the browser and are not sent to a server. The demo is not a standalone replacement for passwords, MFA, rate limiting, or secure server-side sessions. Behavioral signals can drift, vary across devices, and be imitated by a determined attacker. Production use would require consent, deletion controls, accessibility accommodations, representative cross-device testing, stronger anti-automation controls, secure profile storage, and continuous security evaluation.
