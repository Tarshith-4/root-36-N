import { pretty } from '../engine/classifier.js';
export class Dashboard {
  constructor(){this.gauge=document.querySelector('#gauge');this.score=document.querySelector('#score');this.badge=document.querySelector('#statusBadge');this.decision=document.querySelector('#decisionText');this.metrics=document.querySelector('#metricList');this.log=document.querySelector('#explainLog')}
  reset(){this.gauge.style.setProperty('--score',0);this.score.textContent='--';this.badge.className='status neutral';this.badge.textContent='AWAITING SIGNALS'}
  render(result){
    this.gauge.style.setProperty('--score',result.score);this.score.textContent=`${result.score}%`;
    const type=result.bot?'bot':result.authenticated?'granted':'denied';const words=result.bot?'BOT DETECTED':result.authenticated?'ACCESS GRANTED':'ACCESS DENIED';
    this.badge.className=`status ${type}`;this.badge.textContent=words;
    this.decision.innerHTML=`<b>${result.bot?'Automated behavior blocked':result.authenticated?'Genuine behavioral match':'Behavioral mismatch'}</b><p>${result.reason}</p>`;
    this.metrics.innerHTML=result.signals.length?result.signals.map(s=>`<div class="metric"><span>${pretty(s.key)}</span><span>Live ${fmt(s.live)}</span><span>Base ${fmt(s.baseline)}</span><em class="tag ${s.status==='normal'?'ok':s.status==='watch'?'warn':'bad'}">${s.status.toUpperCase()}</em></div>`).join(''):'<p class="empty">No signal comparison was needed.</p>';
    const top=[...result.signals].sort((a,b)=>b.z-a.z)[0];
    const detail=result.bot?'Auth gate stopped the attempt before profile matching.':result.authenticated?'All high-value signals remained within the enrolled behavioral fingerprint.':`Largest feature deviation: ${top?pretty(top.key):'unknown'}.`;
    this.log.innerHTML=`<li>${escapeHtml(result.reason)}</li><li>${escapeHtml(detail)}</li><li>Mahalanobis distance: ${Number.isFinite(result.distance)?result.distance:'blocked'} · Decision latency: ${result.latencyMs??'--'} ms.</li><li>Accepted logins are eligible for a small adaptive baseline update.</li>`;
  }
}
const fmt=n=>Number.isFinite(n)?`${n.toFixed(1)} ms`:'--';
const escapeHtml=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
