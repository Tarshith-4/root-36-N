import { BehaviorTracker } from './collector/tracker.js';
import { calculateConfidenceScore, updateAdaptiveProfile } from './engine/classifier.js';
import { EnrollmentFlow } from './ui/enrollment.js';
import { Dashboard } from './ui/dashboard.js';

const $ = s => document.querySelector(s);
const profileKey = 'bioprint_profile';
const trialKey = 'bioprint_trials';
const logKey = 'bioprint_trial_log';
const dashboard = new Dashboard();
const show = id => ['welcome','enrollment','login'].forEach(x => $('#'+x).classList.toggle('hidden', x !== id));
function profile(){try{return JSON.parse(localStorage.getItem(profileKey))}catch{return null}}
function setProfile(p){localStorage.setItem(profileKey,JSON.stringify(p))}
function setPill(){const p=profile();$('#profilePill').textContent=p?`Profile enrolled · ${p.sampleCount} samples · Local only`:'Profile not enrolled'}
function trials(){try{return JSON.parse(localStorage.getItem(trialKey))||{genuine:0,impostor:0,falseAccepts:0,falseRejects:0}}catch{return {genuine:0,impostor:0,falseAccepts:0,falseRejects:0}}}
function saveTrials(t){localStorage.setItem(trialKey,JSON.stringify(t));renderTrials()}
function tlog(){try{return JSON.parse(localStorage.getItem(logKey))||[]}catch{return []}}
function appendLog(entry){const l=tlog();l.push(entry);localStorage.setItem(logKey,JSON.stringify(l))}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function downloadTrialCsv(){
  const rows=tlog();
  const header=['trial_id','label','operator','user_id','session','decision','score','mahalanobis_distance','bot','latency_ms','notes'];
  const lines=[header.join(',')].concat(rows.map((r,i)=>[i+1,r.label,r.operator,r.userId,r.session,r.decision,r.score,r.distance,r.bot,r.latencyMs,r.notes].map(csvEscape).join(',')));
  const csvText=lines.join('\n');
  // Primary method: programmatic download via Blob.
  try{
    const blob=new Blob([csvText],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='EVALUATION_RESULTS.csv';a.style.display='none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){console.warn('Blob download failed, falling back',e)}
  // Fallback shown regardless: also render the CSV on-page in a selectable
  // textarea, in case the browser's download permission silently blocks the
  // Blob method. This guarantees the data is retrievable via copy-paste.
  let panel=$('#csvFallback');
  if(!panel){
    panel=document.createElement('div');
    panel.id='csvFallback';
    panel.className='eval-panel';
    panel.innerHTML='<h3>Trial log (copy if download did not appear)</h3><textarea id="csvFallbackText" readonly style="width:100%;height:160px;font-family:monospace;font-size:12px;"></textarea>';
    $('.eval-panel')?.after(panel);
  }
  const ta=$('#csvFallbackText');
  ta.value=csvText;
  ta.style.display='block';
  ta.focus();
  ta.select();
}
function renderTrials(){const t=trials();$('#genuineCount').textContent=t.genuine;$('#impostorCount').textContent=t.impostor;$('#falseAcceptCount').textContent=t.falseAccepts;$('#falseRejectCount').textContent=t.falseRejects;$('#farValue').textContent=t.impostor?`${(t.falseAccepts/t.impostor*100).toFixed(1)}%`:'--';$('#frrValue').textContent=t.genuine?`${(t.falseRejects/t.genuine*100).toFixed(1)}%`:'--'}
const flow = new EnrollmentFlow({input:$('#enrollInput'),next:$('#enrollNext'),step:$('#stepLabel'),progress:$('#progressBar'),onComplete:p=>{setProfile(p);setPill();enterLogin();dashboard.reset();}});
$('#startEnrollment').onclick=()=>{show('enrollment');flow.begin()};
$('#resetProfile').onclick=()=>{localStorage.removeItem(profileKey);localStorage.removeItem(trialKey);localStorage.removeItem(logKey);setPill();renderTrials();show('welcome')};
function liveTracker(){return new BehaviorTracker({inputs:[$('#email'),$('#password')],motionTarget:document,submitTarget:$('#loginButton')}).start()}
let tracker; let lastResult = null;
function enterLogin(){show('login');tracker?.stop();tracker=liveTracker();renderTrials()}
if(profile()) enterLogin(); else show('welcome'); setPill(); renderTrials();
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const p=profile();const live=tracker.getFeatureVector();const result=calculateConfidenceScore(live,p);tracker.stop();lastResult=result;dashboard.render(result);if(result.authenticated&&!result.bot)setProfile(updateAdaptiveProfile(p,live));setTimeout(()=>{tracker=liveTracker();setPill()},100)});
$('#botSimulator').onclick=()=>{tracker?.stop();dashboard.render({score:0,authenticated:false,bot:true,reason:'Synthetic event pattern injected by the demo simulator.',signals:[],distance:Infinity,latencyMs:0});tracker=liveTracker()};
$('#recordGenuine').onclick=()=>{const p=profile();if(!p||!lastResult)return;const r=lastResult;const t=trials();t.genuine++;if(!r.authenticated)t.falseRejects++;saveTrials(t);appendLog({label:'genuine',operator:'enrolled_user',userId:'demo-user',session:'session-1',decision:r.authenticated?'GRANTED':'DENIED',score:r.score,distance:Number.isFinite(r.distance)?r.distance.toFixed(3):r.distance,bot:r.bot,latencyMs:r.latencyMs?.toFixed?.(2)??r.latencyMs,notes:''})};
$('#recordImpostor').onclick=()=>{const p=profile();if(!p||!lastResult)return;const r=lastResult;const t=trials();t.impostor++;if(r.authenticated&&!r.bot)t.falseAccepts++;saveTrials(t);appendLog({label:'impostor',operator:'enrolled_user_self_varied',userId:'demo-user',session:'session-1',decision:r.authenticated?'GRANTED':'DENIED',score:r.score,distance:Number.isFinite(r.distance)?r.distance.toFixed(3):r.distance,bot:r.bot,latencyMs:r.latencyMs?.toFixed?.(2)??r.latencyMs,notes:''})};
$('#clearTrials').onclick=()=>{saveTrials({genuine:0,impostor:0,falseAccepts:0,falseRejects:0});localStorage.removeItem(logKey)};
$('#exportCsv').onclick=()=>downloadTrialCsv();
