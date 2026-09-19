import { BehaviorTracker } from './collector/tracker.js';
import { calculateConfidenceScore, updateAdaptiveProfile } from './engine/classifier.js';
import { EnrollmentFlow } from './ui/enrollment.js';
import { Dashboard } from './ui/dashboard.js';

const $ = s => document.querySelector(s);
const profileKey = 'bioprint_profile';
const trialKey = 'bioprint_trials';
const dashboard = new Dashboard();
const show = id => ['welcome','enrollment','login'].forEach(x => $('#'+x).classList.toggle('hidden', x !== id));
function profile(){try{return JSON.parse(localStorage.getItem(profileKey))}catch{return null}}
function setProfile(p){localStorage.setItem(profileKey,JSON.stringify(p))}
function setPill(){const p=profile();$('#profilePill').textContent=p?`Profile enrolled · ${p.sampleCount} samples · Local only`:'Profile not enrolled'}
function trials(){try{return JSON.parse(localStorage.getItem(trialKey))||{genuine:0,impostor:0,falseAccepts:0,falseRejects:0}}catch{return {genuine:0,impostor:0,falseAccepts:0,falseRejects:0}}}
function saveTrials(t){localStorage.setItem(trialKey,JSON.stringify(t));renderTrials()}
function renderTrials(){const t=trials();$('#genuineCount').textContent=t.genuine;$('#impostorCount').textContent=t.impostor;$('#falseAcceptCount').textContent=t.falseAccepts;$('#falseRejectCount').textContent=t.falseRejects;$('#farValue').textContent=t.impostor?`${(t.falseAccepts/t.impostor*100).toFixed(1)}%`:'--';$('#frrValue').textContent=t.genuine?`${(t.falseRejects/t.genuine*100).toFixed(1)}%`:'--'}
const flow = new EnrollmentFlow({input:$('#enrollInput'),next:$('#enrollNext'),step:$('#stepLabel'),progress:$('#progressBar'),onComplete:p=>{setProfile(p);setPill();enterLogin();dashboard.reset();}});
$('#startEnrollment').onclick=()=>{show('enrollment');flow.begin()};
$('#resetProfile').onclick=()=>{localStorage.removeItem(profileKey);localStorage.removeItem(trialKey);setPill();renderTrials();show('welcome')};
function liveTracker(){return new BehaviorTracker({inputs:[$('#email'),$('#password')],motionTarget:document,submitTarget:$('#loginButton')}).start()}
let tracker;
function enterLogin(){show('login');tracker?.stop();tracker=liveTracker();renderTrials()}
if(profile()) enterLogin(); else show('welcome'); setPill(); renderTrials();
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const p=profile();const live=tracker.getFeatureVector();const result=calculateConfidenceScore(live,p);tracker.stop();dashboard.render(result);if(result.authenticated&&!result.bot)setProfile(updateAdaptiveProfile(p,live));setTimeout(()=>{tracker=liveTracker();setPill()},100)});
$('#botSimulator').onclick=()=>{tracker?.stop();dashboard.render({score:0,authenticated:false,bot:true,reason:'Synthetic event pattern injected by the demo simulator.',signals:[],distance:Infinity,latencyMs:0});tracker=liveTracker()};
$('#recordGenuine').onclick=()=>{const p=profile();if(!p)return;const r=calculateConfidenceScore(tracker.getFeatureVector(),p);const t=trials();t.genuine++;if(!r.authenticated)t.falseRejects++;saveTrials(t)};
$('#recordImpostor').onclick=()=>{const p=profile();if(!p)return;const r=calculateConfidenceScore(tracker.getFeatureVector(),p);const t=trials();t.impostor++;if(r.authenticated&&!r.bot)t.falseAccepts++;saveTrials(t)};
$('#clearTrials').onclick=()=>saveTrials({genuine:0,impostor:0,falseAccepts:0,falseRejects:0});
