# BioPrint: Behavior-Based Login Security

BioPrint is a privacy-first hackathon demo that adds a behavioral biometric gate to a familiar login flow. It profiles typing rhythm and mouse interaction entirely in the browser, then evaluates the next login locally with a lightweight anomaly model.

## Run it

Open `index.html` with a simple local web server (recommended):

```powershell
cd bioprint-auth
python -m http.server 8080
```

Then visit `http://localhost:8080`. Create a profile with three natural typing passes. On the login screen, type naturally and submit. Use **Run bot script simulator** for the scripted-attack demo. The profile is stored only in the browser's `localStorage` under `bioprint_profile`; **Reset profile** deletes it.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/collector/tracker.js` | Captures dwell time, flight time variation, motion velocity/curvature, focus transitions, click hold, and browser event trust. |
| `src/ui/enrollment.js` | Captures three calibration passes and saves mean and standard-deviation baselines. |
| `src/engine/classifier.js` | Applies a weighted Z-score anomaly calculation and a 70% confidence gate. |
| `src/ui/dashboard.js` | Presents confidence, per-signal comparisons, and human-readable reasons. |

## Demo notes

The implementation is a demonstrator, not a replacement for passwords, MFA, rate limits, or server-side session controls. Browser `isTrusted` is one defense signal, not a security boundary. For a production deployment, encrypt profile material, use stronger anti-automation controls, and validate fairness and false-reject rates with consented, representative testing.

## Chrome extension

The `extension/` folder is an unpacked Manifest V3 build. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder. The popup provides the same local demo.
