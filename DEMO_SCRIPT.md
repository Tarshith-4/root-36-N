# BioPrint 3–5 Minute Demo Script

## 0:00–0:30 — Problem
"A password proves that you know a secret. BioPrint adds a behavioral gate that asks whether the person using the login behaves like the enrolled user. Everything in this demo is processed locally."

## 0:30–1:20 — Enrollment
1. Open the local login page.
2. Start enrollment.
3. Complete five natural passes.
4. Point out that raw characters are not stored; the system builds a six-feature behavioral fingerprint.

## 1:20–2:00 — Genuine login
1. Enter the demo credentials naturally.
2. Submit.
3. Show `ACCESS GRANTED`.
4. Point to the Mahalanobis distance, confidence score, signal breakdown, and local latency.
5. Mention that accepted genuine attempts can update the baseline gradually.

## 2:00–2:45 — Impostor
1. Have a teammate use the same credentials.
2. Ask them to deliberately change typing rhythm and pointer behavior.
3. Submit.
4. Show `ACCESS DENIED` and the largest behavioral deviation.

## 2:45–3:20 — Bot
1. Run the bot simulator or a scripted interaction.
2. Show `BOT DETECTED`.
3. Explain that bot checks include trusted-event state, timing variance/entropy, timing-sequence novelty, and pointer trajectory signals.

## 3:20–4:00 — Extension + reliability
1. Briefly show `chrome://extensions` with the unpacked BioPrint extension loaded.
2. Open the local page and point out that `manifest.json` injects `content.js` into the marked login form.
3. Show the Reliability Lab and explain FAR/FRR.
4. If real trial data has already been collected, show the measured FAR/FRR values. Never present simulated values as human-test results.

## Closing line
"BioPrint is not claiming to replace every security control. It demonstrates a fast, explainable behavioral risk signal that can distinguish a genuine interaction from a mismatched or automated login attempt."
