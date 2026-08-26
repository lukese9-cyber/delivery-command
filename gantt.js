(function(){
  const style=document.createElement('style');
  style.textContent=`
  .gantt-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.gantt-toolbar select{border:1px solid var(--line);border-radius:8px;padding:8px;background:#fff}.gantt-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff}.gantt-grid{min-width:980px}.gantt-head,.gantt-row{display:grid;grid-template-columns:260px 120px 110px 1fr;border-bottom:1px solid #e6ecef}.gantt-head{position:sticky;top:0;z-index:3;background:#edf2f5;font-size:11px;font-weight:800;color:#36516a}.gantt-head>div,.gantt-row>div{padding:8px;border-right:1px solid #e6ecef}.gantt-row:last-child{border-bottom:0}.gantt-task{font-weight:700;color:var(--navy);cursor:pointer}.gantt-owner{font-size:11px;color:var(--muted)}.gantt-timeline{position:relative;height:46px;background:repeating-linear-gradient(to right,#f8fafb 0,#f8fafb calc(10% - 1px),#e7ecef calc(10% - 1px),#e7ecef 10%)}.gantt-baseline{position:absolute;top:9px;width:2px;height:28px;background:#6f7f8c}.gantt-forecast{position:absolute;top:14px;height:18px;border-radius:5px;min-width:10px;opacity:.92}.gantt-forecast.G{background:var(--green)}.gantt-forecast.A{background:var(--amber)}.gantt-forecast.R{background:var(--red)}.gantt-forecast.X{background:var(--grey)}.gantt-critical{outline:2px solid rgba(183,59,59,.22);outline-offset:1px}.gantt-axis{display:grid;grid-template-columns:repeat(10,1fr);font-size:10px;color:var(--muted);min-width:490px}.gantt-axis span{padding:5px 3px;border-right:1px solid #dfe6ea;white-space:nowrap}.gantt-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin-top:10px}.gantt-key{display:inline-flex;align-items:center;gap:5px}.gantt-swatch{width:18px;height:8px;border-radius:3px;background:var(--green)}.gantt-marker{width:2px;height:15px;background:#6f7f8c;display:inline-block}.gantt-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.gantt-summary .status-cell{min-height:64px}.gantt-no-data{padding:22px;color:var(--muted);text-align:center}@media(max-width:680px){.gantt-summary{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  function parseDate(v){if(!v)return null;const d=new Date(v+'T00:00:00Z');return Number.isNaN(d.getTime())?null:d}
  function iso(d){return d.toISOString().slice(0,10)}
  function addDays(d,n){const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x}
  function diffDays(a,b){return Math.round((b-a)/86400000)}
  function pct(date,start,end){const span=Math.max(1,end-start);return Math.max(0,Math.min(100,((date-start)/span)*100))}
  function labelDate(d){return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'})}
  function getMilestones(){return (typeof data!=='undefined'?data:[]).filter(r=>r.type==='Milestone'&&parseDate(r.due||r.baseline)).sort((a,b)=>(a.due||a.baseline).localeCompare(b.due||b.baseline))}
  function rowRange(ms){const dates=ms.flatMap(r=>[parseDate(r.baseline),parseDate(r.due)]).filter(Boolean);if(!dates.length)return null;let min=new Date(Math.min(...dates)),max=new Date(Math.max(...dates));min=addDays(min,-7);max=addDays(max,7);if(diffDays(min,max)<35)max=addDays(min,35);return {min,max}}
  function renderGantt(){
    const host=document.getElementById('ganttCanvas'); if(!host)return;
    let ms=getMilestones();
    const ws=document.getElementById('ganttWorkstream'); const criticalOnly=document.getElementById('ganttCriticalOnly');
    if(ws&&ws.value!=='ALL')ms=ms.filter(r=>r.workstream===ws.value);
    if(criticalOnly&&criticalOnly.checked)ms=ms.filter(r=>r.critical);
    const range=rowRange(ms);
    const summary=document.getElementById('ganttSummary');
    if(summary){
      const slipped=ms.filter(r=>parseDate(r.baseline)&&parseDate(r.due)&&parseDate(r.due)>parseDate(r.baseline)).length;
      const critical=ms.filter(r=>r.critical).length;
      const red=ms.filter(r=>(typeof effectiveRag==='function'?effectiveRag(r):r.rag)==='RED').length;
      const next=ms.find(r=>parseDate(r.due)>=new Date(Date.UTC(2026,7,26)))||ms[0];
      summary.innerHTML=`<div class="status-cell"><b>Milestones</b>${ms.length}</div><div class="status-cell"><b>Slipped</b>${slipped}</div><div class="status-cell"><b>Critical Path</b>${critical}</div><div class="status-cell"><b>Next Gate</b>${next?`${esc(next.id)} · ${labelDate(parseDate(next.due||next.baseline))}`:'—'}</div>`;
    }
    if(!range||!ms.length){host.innerHTML='<div class="gantt-no-data">No milestone records match the current filters.</div>';return}
    const axis=[];for(let i=0;i<10;i++){axis.push(addDays(range.min,Math.round(diffDays(range.min,range.max)*i/9)))}
    const rows=ms.map(r=>{
      const base=parseDate(r.baseline)||parseDate(r.due),forecast=parseDate(r.due)||base;
      const p1=pct(base,range.min,range.max),p2=pct(forecast,range.min,range.max);
      const left=Math.min(p1,p2),width=Math.max(1.2,Math.abs(p2-p1));
      const rag=(typeof effectiveRag==='function'?effectiveRag(r):r.rag)||'GREY';
      const rc=(typeof ragClass==='function'?ragClass(rag):'X');
      const variance=base&&forecast?diffDays(base,forecast):0;
      return `<div class="gantt-row"><div><div class="gantt-task" data-open="${esc(r.id)}">${esc(r.id)} · ${esc(r.title)}</div><div class="gantt-owner">${esc(r.workstream)} · ${esc(r.owner||'Unowned')}</div></div><div><span class="rag ${rc}">${esc(rag)}</span>${r.critical?'<div class="muted">Critical path</div>':''}</div><div>${variance>0?'+'+variance:variance}d<div class="muted">${base?labelDate(base):'—'} → ${forecast?labelDate(forecast):'—'}</div></div><div class="gantt-timeline"><span class="gantt-baseline" style="left:${p1}%" title="Baseline ${base?labelDate(base):''}"></span><span class="gantt-forecast ${rc} ${r.critical?'gantt-critical':''}" style="left:${left}%;width:${width}%" title="Forecast variance ${variance} days"></span></div></div>`
    }).join('');
    host.innerHTML=`<div class="gantt-grid"><div class="gantt-head"><div>Milestone / Owner</div><div>Status</div><div>Variance</div><div><div class="gantt-axis">${axis.map(d=>`<span>${labelDate(d)}</span>`).join('')}</div></div></div>${rows}</div>`;
    document.getElementById('ganttWindow').textContent=`Window: ${labelDate(range.min)} – ${labelDate(range.max)}`;
  }
  function populateFilters(){const ws=document.getElementById('ganttWorkstream');if(!ws)return;const current=ws.value||'ALL';const vals=[...new Set(getMilestones().map(r=>r.workstream).filter(Boolean))].sort();ws.innerHTML='<option value="ALL">All workstreams</option>'+vals.map(v=>`<option>${esc(v)}</option>`).join('');if(vals.includes(current)||current==='ALL')ws.value=current}
  function init(){
    populateFilters();renderGantt();
    ['ganttWorkstream','ganttCriticalOnly'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('change',renderGantt)});
    const oldRenderAll=typeof renderAll==='function'?renderAll:null;
    if(oldRenderAll){window.renderAll=function(){oldRenderAll();populateFilters();renderGantt()}}
    document.addEventListener('click',e=>{const link=e.target.closest('[data-open]');if(link&&document.getElementById('gantt').classList.contains('on')){if(typeof openDrawer==='function')openDrawer(link.dataset.open)}});
  }
  init();
})();