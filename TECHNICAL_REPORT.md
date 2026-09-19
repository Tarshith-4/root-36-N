# BioPrint: Behavior-Based Login Security

## Executive summary

Passwords prove knowledge, but they are weak against phishing, credential stuffing, and an attacker who has learned the secret. BioPrint is a browser-local second signal that asks whether a login *behaves* like the person who enrolled it. The project demonstrates a fast behavioral gate that runs without a biometric API, cloud model, or server round trip.

## Behavioral signal taxonomy

The collector measures keyboard dwell time (keydown to keyup), flight time (one key release to the next keydown), and the standard deviation of flight timing. It also measures pointer path curvature, peak motion velocity, focus transitions, and submit-button hold duration. The app never records the actual characters of a calibration phrase; it retains only aggregate timing and movement statistics in `localStorage`.

## Algorithmic architecture

Enrollment contains three natural passes. For each signal, BioPrint stores a mean and standard deviation. At authentication, each live signal is normalized as a Z-score: `|live - mean| / (standard deviation + tolerance)`. A weighted composite anomaly is transformed into a 0-100 confidence score. Scores at or above 70 approve the demonstration login. The calculation is small fixed-size arithmetic and completes locally in well under the 10 ms target on typical hardware.

Mahalanobis distance is the natural production evolution when more calibration samples are available: it can model correlation among signals (for example, between a fast typist and rapid pointer movement). The present Z-score engine is deliberately sample-efficient and transparent for a three-pass hackathon demo.

## Anti-bot and anti-replay safeguards

BioPrint blocks an attempt before profile matching when browser events are untrusted, when at least three flight times have near-zero variance, or when an observed mouse path is perfectly linear. The dashboard clearly reports the trigger so a judge can distinguish a bot block from a behavioral mismatch. These heuristics are defense-in-depth indicators, not proof that an attacker is automated.

## Privacy, security, and limitations

All enrollment and matching occur on-device; raw interaction event streams are discarded after aggregation. This reduces transmission and central storage risk. A production system should pair this technique with password/MFA, rate limiting, secure profile storage, consent and deletion controls, accessibility accommodations, monitoring for false rejects, and careful bias testing. Behavioral authentication should be an adaptive risk signal, not the sole factor for high-risk access.

## Judge demo flow

1. Enroll with three natural passes of the phrase.
2. Authenticate naturally to show a green local decision and signal list.
3. Re-enroll or have a teammate type differently to show a red mismatch.
4. Select the bot simulator to show an orange pre-classification block.
