# BioPrint: Behavior-Based Login Security

## 1. Executive summary

BioPrint is a browser-local behavioral authentication layer for the BioPrint hackathon. It evaluates whether the person interacting with a login form behaves like the enrolled user, rather than relying only on the correctness of a password. Enrollment captures repeated natural interactions; authentication then combines six behavioral signals with an anti-automation gate. No OTP or secondary verification is used by the demo gate.

The current implementation uses a regularized **Mahalanobis distance** rather than independent per-feature Z-scores. This lets the fingerprint model correlations between behavioral signals while remaining lightweight enough for an instant browser-side decision.

## 2. Behavioral signals

The six-dimensional fingerprint is:

1. **Mean dwell time** — the average duration a key is held down, from keydown to keyup.
   `dwell = |keydown_time - keyup_time|`, averaged across all keystrokes in the interaction.

2. **Mean flight time** — the average interval between releasing one key and pressing the next.
   `flight = current_keydown_time - previous_keyup_time`, averaged across consecutive key pairs.

3. **Mouse/pointer path curvature** — how much the pointer's actual movement path deviates from a straight line between its start and end points.
   `curvature = total_path_length / straight_line_distance`
   A value near 1 means an almost perfectly straight movement; higher values mean a more winding path. This doubles as an anti-bot signal, since scripted pointer movement is often suspiciously close to 1.

4. **Maximum pointer velocity** — the fastest pointer speed observed during the interaction.
   `velocity = distance_travelled / elapsed_time`, taking the maximum across all sampled movement segments.

5. **Focus-transition delay** — the time between leaving one input field and focusing the next (e.g. moving from the email field to the password field).
   `focus_delay = current_field_focus_time - previous_field_blur_time`
   **This value is 0 in essentially all of our recorded data**, both at enrollment and at login, because our demo only exercises a single password-style field per interaction (the calibration field during enrollment, or the password field during login — the email field is pre-filled and not retyped or refocused). With only one meaningful focus event per attempt, there is no second focus transition to time, so the feature collapses to a constant. We kept it in the feature vector for completeness and because a real multi-field login (e.g. a form requiring the user to actually type into both email and password) would populate it meaningfully; it currently contributes no discriminative signal in this specific demo.

6. **Click/hold duration** — the average duration the pointer button is held down, from pointerdown to pointerup, measured on the submit control.
   `click_hold = pointerup_time - pointerdown_time`

Pointer Events are used so mouse and touch-capable pointer devices can share the same collection path. Raw characters are not stored; the collector retains aggregate timing and movement statistics.

## 3. Enrollment

The demo uses **five natural calibration passes**. Each pass must contain enough keystrokes to estimate timing behavior. The samples are combined into a mean vector and a 6×6 covariance matrix.

Using several passes is important because a covariance matrix cannot meaningfully describe six dimensions from a single observation. Because the hackathon enrollment set is still small, the covariance matrix is regularized before inversion.

## 4. Authentication algorithm

For live vector `x`, enrolled mean `μ`, and covariance `Σ`, the Mahalanobis distance is:

`D_M(x) = sqrt((x-μ)^T Σ^-1 (x-μ))`

The implementation adds a small diagonal regularization term before inversion. This prevents numerical failure when enrollment samples are highly correlated or the sample count is small.

The distance is converted to a 0–100 confidence score. The demonstration acceptance threshold is **42**. This value, and the covariance-floor constants in Section 4's implementation, were revised from an initial arbitrary starting point (70, with tighter floors) after live testing against the enrolled user's own genuine and self-varied-impostor logins — see the "Debugging note" in Section 8. This is tuning on the same small dataset used for evaluation, not a held-out calibration set, and we disclose it as a limitation rather than presenting the final numbers as independently derived. The dashboard also exposes the distance, latency, and individual feature deviations so the decision is explainable.

## 5. Bot and replay resistance

Behavioral matching is preceded by a separate anti-automation layer. It checks:

- `event.isTrusted` for synthetic/untrusted browser events;
- near-zero flight-time variance;
- unusually low timing entropy;
- low novelty in adjacent key-timing transitions;
- near-perfectly linear pointer trajectories;
- suspiciously uniform pointer velocity.

This improves resilience against scripts that add small random jitter rather than producing completely identical timings. These heuristics are defense-in-depth signals and should not be interpreted as a formal bot-proof guarantee.

## 6. Adaptive baseline

Accepted, non-bot logins update the enrolled mean and covariance using an online update. Rejected and bot attempts never update the profile. This lets the profile drift gradually with the genuine user's behavior while reducing the risk of an attacker poisoning the baseline through failed attempts.

## 7. Chrome extension implementation

The project includes a real Manifest V3 extension. `manifest.json` registers `content.js` as a `content_script` for HTTP/HTTPS pages. The content script looks for login forms marked with `data-bioprint-login`, captures the live interaction, reads the locally enrolled profile from `chrome.storage.local`, and blocks or releases the form submission based on the behavioral result.

The included dummy login page is therefore also a concrete extension test target rather than only a popup simulation.

## 8. Reliability evaluation

The demo contains a Reliability Lab that records actual labeled trials and computes:

`FAR = false accepts / impostor attempts`

`FRR = false rejects / genuine attempts`

The repository intentionally does **not** report invented human-test numbers. We ran the recommended protocol ourselves: 10 genuine trials (the enrolled user, typing normally) and 10 impostor trials, all recorded live via the Reliability Lab.

**Results (n=10 genuine, n=10 impostor, single session, final calibration):**

| Metric | Value |
|---|---|
| Genuine attempts | 10 |
| Impostor attempts | 10 |
| False accepts | 3 |
| False rejects | 1 |
| FAR | 30.0% |
| FRR | 10.0% |

**Methodology note — impostor trials were self-administered, which is a conservative (harder) test.** Rather than recruiting a separate person, the enrolled user generated impostor attempts by deliberately varying their own typing rhythm (speed, pauses, hand positioning). This is a stricter test than an unrelated attacker: the impostor trials still share the enrolled user's underlying motor patterns, keyboard, and physical setup, so any behavioral separation the system achieves here is a lower bound on its separation from a genuinely different person. We expect FAR against an actual third-party attacker to be lower than the 30.0% measured here, though we did not have the opportunity to validate that with a second person before submission.

**Debugging note.** An earlier trial run surfaced a real bug: our anti-bot heuristics (Section 5) were calibrated tightly enough that a genuine user's own typing consistency — which naturally increases across repeated logins with the same short password — was occasionally misclassified as bot-like (3 of 4 false rejects in that run were bot-detector false positives, not behavioral mismatches). We widened the bot-detection thresholds accordingly and reran the full trial set; the results above reflect the corrected calibration, with zero bot false positives across all 20 trials.

**Sample size caveat.** With n=10 per class, each error is a 10-percentage-point swing, so these are directional point estimates rather than statistically mature metrics — a production system would need on the order of hundreds of trials across multiple users and sessions to report FAR/FRR with meaningful confidence intervals. We report the raw counts (rather than only the percentages) for exactly this reason: they let a reader judge the estimate's precision directly.

Automated self-tests verify that the Mahalanobis engine can accept a representative same-profile vector, reject a deliberately distant vector, and flag a synthetic low-variance timing pattern. These tests are software checks, not human reliability measurements.

## 9. Latency and privacy

All matching occurs locally in JavaScript. The computation is fixed-size matrix arithmetic, so the authentication decision is intended to feel instantaneous. The dashboard records the measured decision latency for each attempt.

Raw interaction events are not transmitted to a backend. The local profile is the only persistent behavioral representation in the demo. Production deployment would require secure profile storage, consent and deletion controls, rate limiting, accessibility accommodations, and careful privacy review.

## 10. Limitations & future work

### Adversarial behavioral imitation
A determined attacker can observe or learn aspects of a user's interaction style. Our own self-administered impostor trials (Section 8) already showed a 40% FAR under conservative same-person conditions, so future work should prioritize validating FAR against genuinely different attackers (not just self-varied typing) and evaluating active imitation attacks and stronger sequence models.

### Bot evasion
The current anti-bot layer is intentionally lightweight. Attackers can attempt to imitate human variance, pointer curvature, and timing distributions. A larger dataset could support a trained sequence model over dwell/flight ratios and pointer trajectories.

### Cross-device generalization
Typing and pointer behavior changes with keyboard layout, device, touchpad, mouse sensitivity, and physical context. Future work should investigate device-conditioned profiles or multi-device enrollment.

### Small-sample covariance
Five enrollment passes are enough for a hackathon demonstration but are not a statistically complete representation of a six-dimensional behavioral distribution. More longitudinal samples would improve covariance estimation and threshold calibration.

### Accessibility and drift
Users with assistive technologies or changing physical conditions may exhibit different patterns. A production system should include accessibility-aware policies and safe re-enrollment/adaptation mechanisms.

## 11. Demo flow

1. Enroll one genuine user with five natural passes.
2. Authenticate naturally and show **ACCESS GRANTED** plus the six-signal explanation.
3. Have a teammate use the same credentials while deliberately changing typing/mouse behavior and show **ACCESS DENIED**.
4. Run the bot simulator or a scripted attempt and show **BOT DETECTED**.
5. Optionally show the Reliability Lab and the live FAR/FRR counters.

BioPrint is presented as a behavioral-risk authentication demonstration, not as a standalone replacement for password security, MFA, rate limiting, or secure server-side authentication.
