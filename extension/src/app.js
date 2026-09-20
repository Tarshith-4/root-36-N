import { BehaviorTracker } from './collector/tracker.js';
import { calculateConfidenceScore, updateAdaptiveProfile, detectBot } from './engine/classifier.js';
import { EnrollmentFlow } from './ui/enrollment.js';
import { Dashboard } from './ui/dashboard.js';

const $=s=>document.querySelector(s); const profileKey='bioprint_profile'; const trialKey='bioprint_trials'; const dashboard=new Dashboard();
const show=id=>['welcome','enrollment','login'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));
const storage=chrome.storage.local;
async function profile(){return new Promise(r=>storage.get(profileKey,x=>r(x[profileKey]||null)))}
async function setProfile(p){return new Promise(r=>storage.set({[profileKey]:p},r))}
async function trials(){return new Promise(r=>storage.get(trialKey,x=>r(x[trialKey]||{genuine:0,impostor:0,falseAccepts:0,falseRejects:0})))}
async function saveTrials(t){await new Promise(r=>storage.set({[trialKey]:t},r));renderTrials()}
async function setPill(){const p=await profile();const el=$('#profilePill');if(el)el.textContent=p?`Extension profile · ${p.sampleCount} samples`:'Profile not enrolled'}
async function renderTrials(){if(!$('#genuineCount'))return;const t=await trials();$('#genuineCount').textContent=t.genuine;$('#impostorCount').textContent=t.impostor;$('#falseAcceptCount').textContent=t.falseAccepts;$('#falseRejectCount').textContent=t.falseRejects;$('#farValue').textContent=t.impostor?`${(t.falseAccepts/t.impostor*100).toFixed(1)}%`:'--';$('#frrValue').textContent=t.genuine?`${(t.falseRejects/t.genuine*100).toFixed(1)}%`:'--'}
const flow=new EnrollmentFlow({input:$('#enrollInput'),next:$('#enrollNext'),step:$('#stepLabel'),progress:$('#progressBar'),onComplete:async p=>{await setProfile(p);await setPill();enterLogin();dashboard.reset()}});
$('#startEnrollment').onclick=()=>{show('enrollment');flow.begin()};
$('#resetProfile').onclick=async()=>{await new Promise(r=>storage.remove([profileKey,trialKey],r));await setPill();await renderTrials();show('welcome')};
function liveTracker(){return new BehaviorTracker({inputs:[$('#email'),$('#password')],motionTarget:document,submitTarget:$('#loginButton')}).start()}
let tracker; let lastResult = null;
async function enterLogin(){show('login');tracker?.stop();tracker=liveTracker();await renderTrials()}
(async()=>{if(await profile()) await enterLogin(); else show('welcome');await setPill();await renderTrials()})();
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const p=await profile();const live=tracker.getFeatureVector();const result=calculateConfidenceScore(live,p);tracker.stop();lastResult=result;dashboard.render(result);if(result.authenticated&&!result.bot)await setProfile(updateAdaptiveProfile(p,live));setTimeout(()=>{tracker=liveTracker();setPill()},100)});
$('#botSimulator').onclick=()=>{
  tracker?.stop();
  const syntheticFeatures = {
    meanDwellTime: 95, meanFlightTime: 110, mouseCurvature: 1.0001, mouseMaxVelocity: 2.0,
    focusBlurDelay: 0, clickHoldDuration: 95,
    isTrustedEvent: false, flightStdDev: 0.15, flightCount: 12,
    timingEntropy: 0.08, sequenceNovelty: 0.04,
    mousePointCount: 12, mouseVelocityStd: 0.01
  };
  const result = detectBot(syntheticFeatures);
  dashboard.render({
    score: 0, authenticated: false, bot: result.isBot,
    reason: result.isBot ? result.reason : 'Synthetic pattern did not trigger the bot detector.',
    signals: [], distance: Infinity, latencyMs: 0
  });
  tracker = liveTracker();
};
// The Reliability Lab UI (record genuine/impostor trials) lives only on the
// main demo page, not in this extension popup, so those buttons don't exist
// here. Guard the wiring instead of assuming the elements are present.
if ($('#recordGenuine')) $('#recordGenuine').onclick=async()=>{const p=await profile();if(!p)return;const r=calculateConfidenceScore(tracker.getFeatureVector(),p);const t=await trials();t.genuine++;if(!r.authenticated)t.falseRejects++;await saveTrials(t)};
if ($('#recordImpostor')) $('#recordImpostor').onclick=async()=>{const p=await profile();if(!p)return;const r=calculateConfidenceScore(tracker.getFeatureVector(),p);const t=await trials();t.impostor++;if(r.authenticated&&!r.bot)t.falseAccepts++;await saveTrials(t)};
if ($('#clearTrials')) $('#clearTrials').onclick=()=>saveTrials({genuine:0,impostor:0,falseAccepts:0,falseRejects:0});
