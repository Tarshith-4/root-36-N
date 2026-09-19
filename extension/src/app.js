import { BehaviorTracker } from './collector/tracker.js'; import { calculateConfidenceScore } from './engine/classifier.js'; import { EnrollmentFlow } from './ui/enrollment.js'; import { Dashboard } from './ui/dashboard.js';
const $=s=>document.querySelector(s),profileKey='bioprint_profile';const dashboard=new Dashboard();const show=id=>['welcome','enrollment','login'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));
function profile(){try{return JSON.parse(localStorage.getItem(profileKey))}catch{return null}} function setPill(){const p=profile();$('#profilePill').textContent=p?'Profile enrolled · Local only':'Profile not enrolled'}
const flow=new EnrollmentFlow({input:$('#enrollInput'),next:$('#enrollNext'),step:$('#stepLabel'),progress:$('#progressBar'),onComplete:p=>{localStorage.setItem(profileKey,JSON.stringify(p));setPill();enterLogin();dashboard.reset();}});
$('#startEnrollment').onclick=()=>{show('enrollment');flow.begin()}; $('#resetProfile').onclick=()=>{localStorage.removeItem(profileKey);setPill();show('welcome')};
function liveTracker(){return new BehaviorTracker({inputs:[$('#email'),$('#password')],motionTarget:document,submitTarget:$('#loginButton')}).start()} let tracker;
function enterLogin(){show('login');tracker?.stop();tracker=liveTracker()} if(profile())enterLogin(); else show('welcome');setPill();
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const result=calculateConfidenceScore(tracker.getFeatureVector(),profile());tracker.stop();dashboard.render(result);setTimeout(()=>{tracker=liveTracker()},100)});
$('#botSimulator').onclick=()=>{tracker?.stop();dashboard.render({score:0,authenticated:false,bot:true,reason:'Synthetic event pattern injected by the demo simulator.',signals:[]});tracker=liveTracker()};
