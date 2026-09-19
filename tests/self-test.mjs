import assert from 'node:assert/strict';
import { buildProfile, calculateConfidenceScore, detectBot } from '../src/engine/classifier.js';

const base = (i=0) => ({
  meanDwellTime: 85+i, meanFlightTime: 120+i*2, mouseCurvature: 1.12+i*0.01,
  mouseMaxVelocity: 1.8+i*0.03, focusBlurDelay: 420+i*4, clickHoldDuration: 95+i,
  flightStdDev: 18, flightCount: 12, mousePointCount: 30, mouseVelocityStd: 0.2,
  timingEntropy: 0.85, sequenceNovelty: 0.55, isTrustedEvent: true, flightTimes:[90,110,125,130,145,120]
});
const samples = Array.from({length:5},(_,i)=>base(i));
const profile = buildProfile(samples);
assert.equal(profile.sampleCount, 5);
assert.equal(profile.features.length, 6);
assert.ok(Array.isArray(profile.inverseCovariance));
const genuine = calculateConfidenceScore(base(2), profile);
assert.ok(genuine.authenticated, `expected genuine match, got ${genuine.score}`);
const impostor = calculateConfidenceScore({...base(2), meanDwellTime: 260, meanFlightTime: 480, mouseCurvature: 1.9, mouseMaxVelocity: 6, focusBlurDelay: 1600, clickHoldDuration: 400}, profile);
assert.equal(impostor.authenticated, false);
const bot = detectBot({...base(), flightCount:10, flightStdDev:0.2, meanFlightTime:120, timingEntropy:0.2, sequenceNovelty:0.1, mousePointCount:20, mouseCurvature:1.0005, isTrustedEvent:true});
assert.equal(bot.isBot, true);
console.log('BioPrint self-test passed:', {genuineScore:genuine.score, impostorScore:impostor.score, bot:bot.isBot});
