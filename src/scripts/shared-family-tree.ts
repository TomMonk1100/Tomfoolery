import { upbringing, upbringingPeople } from '../data/close-family-evidence';
import type { familyPanelData } from '../data/family-person-panel';
import { browsePeople, explorerPeople, explorerGraph, connectionAssessment, preferredName, lifeYears, personBadge, pathFromTom, type EvidenceView } from './family/explorer';
import { ADAM } from '../data/shared-family';
import { mapProfileUrl as personUrl, type MapPerson } from '../data/family-map';
import { sharedGraph, SHARED_DEFAULT, SHARED_CARD, sharedFit, sharedScale, type SharedGraphOptions } from './family/shared-graph';
import { relationshipReview } from '../data/ancestry-relationships';
import { zoomSharedViewport, constrainSharedViewport, sharedCardVisible, sharedWheelPixels } from './family/shared-viewport';
import { directionalNode, type Viewport } from './family/graph';
function init(){
  const found=document.querySelector<HTMLElement>('[data-shared-tree]');if(!found||found.dataset.initialized)return;const root=found;root.dataset.initialized='true';
  const controller=new AbortController(),{signal}=controller;
  const get=<T extends Element=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const stage=get('[data-shared-stage]'),world=get('[data-shared-world]'),lines=get<SVGSVGElement>('[data-shared-lines]'),labels=get('[data-shared-labels]');
  const search=get<HTMLInputElement>('#shared-search'),popup=get('[data-shared-popup]'),results=get('#shared-results'),status=get('[data-shared-status]');
  const depth=get<HTMLSelectElement>('[data-shared-depth]'),children=get<HTMLInputElement>('[data-shared-children]'),siblings=get<HTMLInputElement>('[data-shared-siblings]');
  const dialog=get<HTMLDialogElement>('[data-shared-dialog]'),nodes=new Map(Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-shared-person]')).map(n=>[n.dataset.sharedPerson!,n]));
  let mode:EvidenceView=new URLSearchParams(location.search).get('evidence')==='supported'?'supported':'family';
  const gapInput=get<HTMLInputElement>('[data-show-gaps]');gapInput.checked=new URLSearchParams(location.search).get('gaps')==='1';
  let sharedById=explorerPeople(mode,gapInput.checked);
  const panels:typeof familyPanelData={};
  const familyMapAncestorDepth=Object.keys(browsePeople).length;
  const mapPersonLabel=(id:string)=>sharedById[id]?.kind==='unknown'?`? · ${sharedById[id].aliases[0]}`:preferredName(id,browsePeople);
  const mapEdgeAssessment=connectionAssessment;
  const searchSharedPeople=(query:string)=>{const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const words=norm(query).trim().split(/\s+/);return Object.values(browsePeople).filter(p=>words.every(w=>norm(`${preferredName(p.id)} ${p.aliases.join(' ')} ${p.dates}`).includes(w)));};
  let compact=window.matchMedia('(max-width:600px)').matches;
  function setCompact(on:boolean){compact=on;root.dataset.layout=on?'list':'map';get('[data-compact-toggle]').textContent=on?'Map view':'List view';get('[data-compact-toggle]').setAttribute('aria-pressed',String(on));requestAnimationFrame(()=>{if(!on)fit();});}
  let focus=new URLSearchParams(location.search).get('focus')||ADAM;if(!sharedById[focus])focus=ADAM;
  let options:SharedGraphOptions={...SHARED_DEFAULT,whole:new URLSearchParams(location.search).get('view')==='all'},graph=explorerGraph(focus,options,sharedById),view:Viewport={x:0,y:0,scale:1},selected=focus, fitted=true,suppress=0;
  if(options.whole)depth.value='all';
  const size=()=>({width:stage.clientWidth,height:stage.clientHeight});
  let frame=0;
  const edgeLayer=document.createElementNS('http://www.w3.org/2000/svg','g');
  const paintNow=()=>{
    frame=0;const bounds=size();if(!bounds.width||!bounds.height)return;view=constrainSharedViewport(view,bounds,graph);
    // Keep the drawing surface at viewport size. Large logical tree coordinates
    // must never become a giant composited HTML/SVG surface.
    world.style.width=`${bounds.width}px`;world.style.height=`${bounds.height}px`;world.style.transform='none';
    lines.setAttribute('width',String(bounds.width));lines.setAttribute('height',String(bounds.height));
    edgeLayer.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.scale})`);
    const shown=new Map(graph.nodes.map(n=>[n.id,n]));
    for(const [id,element] of nodes){const n=shown.get(id);const visible=!!n&&sharedCardVisible(n,view,bounds);element.hidden=!visible;
      if(visible&&n){element.style.left='0';element.style.top='0';element.style.transformOrigin='0 0';element.style.transform=`translate(${view.x+n.x*view.scale}px,${view.y+n.y*view.scale}px) scale(${view.scale})`;}}
    for(const label of Array.from(labels.children) as HTMLElement[]){const y=view.y+Number(label.dataset.y)*view.scale;label.hidden=view.scale<.2||y<0||y>bounds.height;label.style.top=`${y}px`;}
    get<HTMLOutputElement>('[data-shared-zoom]').value=`${Math.round(view.scale*1000)/10}%`;
  };
  const paint=()=>{if(!frame)frame=requestAnimationFrame(paintNow);};
  const fit=()=>{view=sharedFit(size(),graph);fitted=true;paint();};
  const zoom=(scale:number,point={x:stage.clientWidth/2,y:stage.clientHeight/2})=>{view=zoomSharedViewport(view,scale,point);fitted=false;paint();};
  function center(id:string){const n=graph.nodes.find(n=>n.id===id);if(!n)return;view={scale:Math.max(.65,view.scale),x:0,y:0};view.x=size().width/2-(n.x+SHARED_CARD.width/2)*view.scale;view.y=size().height/2-(n.y+SHARED_CARD.height/2)*view.scale;fitted=false;paint();}
  function draw(){
    sharedById=explorerPeople(mode,gapInput.checked);if(!sharedById[focus])focus=ADAM;
    const url=new URL(location.href);if(options.whole)url.searchParams.set('view','all');else url.searchParams.delete('view');
    if(mode==='supported')url.searchParams.set('evidence','supported');else url.searchParams.delete('evidence');
    if(gapInput.checked)url.searchParams.set('gaps','1');else url.searchParams.delete('gaps');url.searchParams.set('focus',focus);history.replaceState(null,'',url);
    root.querySelectorAll<HTMLInputElement>('[data-evidence-mode]').forEach(input=>input.checked=input.value===mode);
    graph=explorerGraph(focus,options,sharedById);
    lines.replaceChildren(edgeLayer);edgeLayer.replaceChildren(...graph.edges.map(e=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',e.path);p.dataset.kind=e.kind;p.dataset.confidence=e.confidence;p.dataset.source=e.sourceKind;p.dataset.role=e.role;return p;}));
    labels.replaceChildren(...graph.generations.map(g=>{const l=document.createElement('span');l.textContent=g.label;l.dataset.y=String(g.y-14);return l;}));
    const byId=new Map(graph.nodes.map(n=>[n.id,n]));for(const [id,element]of nodes){const n=byId.get(id);element.hidden=!n;if(n){element.style.left=`${n.x}px`;element.style.top=`${n.y}px`;}if(id===focus)element.setAttribute('aria-current','true');else element.removeAttribute('aria-current');const badge=element.querySelector('[data-card-badge]');if(badge)badge.textContent=sharedById[id]?.kind==='unknown'?'Research gap':personBadge(id);}
    get('[data-shared-title]').textContent=options.whole?(mode==='supported'?'Supported family connections':'The family account'):focus===ADAM?'Tom’s family':preferredName(focus);
    get('[data-shared-count]').textContent=`${graph.nodes.filter(n=>sharedById[n.id].kind!=='unknown').length} people in view${gapInput.checked?` · ${graph.nodes.filter(n=>sharedById[n.id].kind==='unknown').length} gaps`:''}`;
    get('[data-view-description]').textContent=mode==='family'?'Known relatives and recorded connections. “Family account” means the relationship still needs independent proof.':'Supported connections only. Probable, disputed and unreviewed links stop this view; family testimony is labeled separately.';
    get<HTMLButtonElement>('[data-shared-whole]').setAttribute('aria-pressed',String(options.whole));
    const breadcrumb=get('[data-family-breadcrumb]');breadcrumb.replaceChildren();const path=pathFromTom(focus,sharedById);
    if(!path.length){breadcrumb.textContent=mode==='supported'?'No supported route from Tom to this family cluster.':'No recorded route from Tom to this family cluster.';}
    else for(const [i,step] of path.entries()){if(i){const label=document.createElement('span');label.textContent=` → ${step.role} → `;breadcrumb.append(label);}const button=document.createElement('button');button.type='button';button.dataset.sharedFocus=step.id;button.textContent=preferredName(step.id);if(step.id===focus)button.setAttribute('aria-current','page');breadcrumb.append(button);}
    const list=get('[data-family-compact]');list.replaceChildren();
    for(const row of graph.generations){const members=graph.nodes.filter(n=>n.y===row.y+24);if(!members.length)continue;const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=row.label==='Children'&&members.some(n=>graph.edges.some(e=>e.role==='raised'&&e.to===n.id))?'Children & upbringing family':row.label;section.append(heading);const ul=document.createElement('ul');
      for(const node of members){const person=sharedById[node.id],li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('strong'),dates=document.createElement('span'),badge=document.createElement('small');button.type='button';button.dataset.sharedOpen=node.id;name.textContent=mapPersonLabel(node.id);dates.textContent=lifeYears(person.dates)||'Dates not recorded';badge.textContent=person.kind==='unknown'?'Research gap':personBadge(node.id);button.append(name,dates,badge);for(const edge of graph.edges.filter(e=>e.to===node.id&&(e.role==='raised'||e.role==='biological'))){const role=document.createElement('small');role.textContent=`${edge.role==='raised'?'Raised by':'Biological father'}: ${preferredName(edge.from)}`;button.append(role);}if(node.id===focus)button.setAttribute('aria-current','true');li.append(button);ul.append(li);}section.append(ul);list.append(section);}
    fit();if(size().width<600&&!options.whole&&!compact){center(focus);view.y+=70;paint();}
  }
  function refocus(id:string){if(!sharedById[id]&&browsePeople[id]){mode='family';sharedById=explorerPeople(mode,gapInput.checked);}if(!sharedById[id])return;focus=id;options.whole=false;if(depth.value==='all'){depth.value='2';options.ancestors=2;}dialog.close();popup.hidden=true;search.value='';const url=new URL(location.href);url.searchParams.set('focus',id);history.replaceState(null,'',url);draw();}
  function selectPanel(name:string){root.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==name);root.querySelectorAll<HTMLButtonElement>('[data-panel-tab]').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.panelTab===name));button.tabIndex=button.dataset.panelTab===name?0:-1;});}
  async function openPerson(id:string){
    const p=sharedById[id]||browsePeople[id];if(!p)return;selected=id;
    if(p.kind!=='unknown'&&!panels[id]){try{const response=await fetch(`/family/details/${encodeURIComponent(id)}.json`,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Details unavailable');panels[id]=await response.json();}catch{if(selected!==id)return;}}
    if(selected!==id||!root.isConnected)return;const data=panels[id];
    get('[data-shared-person-name]').textContent=p.kind==='unknown'?'Unfilled parent position':preferredName(id);
    get('[data-shared-dates]').textContent=lifeYears(p.dates)||'Dates not recorded';get('[data-shared-kind]').textContent=p.kind==='unknown'?'Research gap':personBadge(id);
    get('[data-shared-provenance]').textContent='Evidence labels apply to specific connections. Recorded dates, aliases and other claims may still need corroboration.';
    const names=[...new Set([...(p.name!==preferredName(id)?[p.name]:[]),...p.aliases])];get('[data-shared-aliases]').textContent=names.length?`Also recorded as: ${names.join(' · ')}`:'No alternate names recorded.';
    get<HTMLAnchorElement>('[data-shared-profile]').href=p.kind==='unknown'?`#map-${id}`:personUrl(id);
    const biography=get('[data-person-biography]');biography.replaceChildren();
    for(const fact of data?.facts||[]){const line=document.createElement('p');line.textContent=`${fact.label}: ${fact.value}`;biography.append(line);}
    for(const note of data?.notes||[]){const line=document.createElement('p');line.textContent=note;biography.append(line);}
    if(upbringingPeople.includes(id)){const note=document.createElement('p');note.textContent=upbringing.note;biography.append(note);}
    if(!biography.childElementCount){const note=document.createElement('p');note.textContent=p.kind!=='unknown'&&!data?'Detailed biography could not be loaded. Open the full profile or select this person again to retry.':p.kind==='unknown'?'This is one immediate unfilled parent position. It is not an identified relative.':'No additional biography has been recorded. Open the full profile for the original account.';biography.append(note);}
    const sources=get('[data-person-sources]');sources.replaceChildren();
    for(const finding of data?.findings||[]){const item=document.createElement('article'),title=document.createElement('h4'),body=document.createElement('p'),limit=document.createElement('p'),link=document.createElement('a');title.textContent=`${finding.title} · ${finding.confidence}`;body.textContent=finding.finding;limit.textContent=finding.limit;link.href=finding.url;link.textContent=`${finding.sourceKind} · ${finding.citation} ↗`;item.append(title,body,limit,link);sources.append(item);}
    for(const source of data?.sources||[]){const item=document.createElement('article'),title=document.createElement('h4'),body=document.createElement('p');title.textContent=`${source.title} · ${source.kind}`;body.textContent=source.citation;item.append(title,body);if(source.url){const link=document.createElement('a');link.href=source.url;link.textContent='Open source ↗';item.append(link);}sources.append(item);}
    if(!sources.childElementCount){const note=document.createElement('p');note.textContent=!data&&p.kind!=='unknown'?'Detailed citations could not be loaded. Open the full profile or select this person again to retry.':upbringingPeople.includes(id)?upbringing.citation:'No independently reviewed source is attached here. The full profile may contain imported collection references.';sources.append(note);}
    const relatives=get('[data-shared-relatives]');relatives.replaceChildren();const full=browsePeople[id]||p;
    const groups:[string,string[],'parent'|'partner'|'raised'][]=[['Parents · roles and evidence below',full.parents,'parent'],['Partners',full.partners,'partner'],['Children',full.children,'parent']];
    if(id===upbringing.child)groups.push(['Raised by',[upbringing.raisedBy],'raised']);if(id===upbringing.raisedBy)groups.push(['Raised in this family',[upbringing.child],'raised']);
    for(const [label,ids,kind]of groups){const valid=ids.filter(relative=>browsePeople[relative]||sharedById[relative]);if(!valid.length)continue;const title=document.createElement('h4'),list=document.createElement('ul');title.textContent=label;list.className='family-profile-relations';
      for(const relative of valid){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.sharedOpen=relative;button.textContent=preferredName(relative);li.append(button);const from=label==='Children'?id:relative,to=label==='Children'?relative:id;const raised=kind==='raised';const biological=from===upbringing.biologicalFather&&to===upbringing.child;const assessment=raised?{confidence:'supported',sourceKind:'user supplied',review:upbringing.note,evidenceUrl:'/family/#patrick-biological-and-raised-family'}:connectionAssessment(from,to,kind==='partner'?'partner':'parent');
        const badge=document.createElement('small');badge.textContent=`${raised?'Upbringing':biological?'Biological father':'Recorded connection'} · ${assessment.confidence} · ${assessment.sourceKind}`;li.dataset.confidence=assessment.confidence;li.append(badge);const note=document.createElement('p');note.textContent=assessment.review||'See the cited record for the scope of this connection.';li.append(note);
        const relevant=(panels[id]?.findings||[]).filter(f=>assessment.evidenceUrl?.endsWith(`#${f.id}`));for(const finding of relevant){const source=document.createElement('a');source.href=finding.url;source.textContent=`${finding.sourceKind} · source citation ↗`;li.append(source);}
        const evidence=document.createElement('a');evidence.href=assessment.evidenceUrl||personUrl(id);evidence.textContent='Connection evidence & limits ↗';evidence.dataset.connectionEvidence='true';li.append(evidence);list.append(li);}relatives.append(title,list);}
    if(mode==='supported'){const note=document.createElement('p');note.textContent='Connections below include the recorded family account for comparison. Only supported connections are drawn in Supported ancestry.';relatives.prepend(note);}
    selectPanel('biography');popup.hidden=true;if(!dialog.open)dialog.showModal();get('[data-shared-person-name]').focus({preventScroll:true});
  }
  root.addEventListener('click',e=>{if(!(e.target instanceof Element))return;if(e.target.closest('a[href="#italian-research"]')){const section=document.getElementById('italian-research') as HTMLDetailsElement;section.open=true;}const t=e.target.closest<HTMLElement>('[data-shared-person],[data-shared-open],[data-shared-focus]');if(t&&e instanceof MouseEvent&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(Date.now()<suppress)return;const id=t.dataset.sharedPerson||t.dataset.sharedOpen||t.dataset.sharedFocus!;if(t.dataset.sharedFocus){refocus(id);}else openPerson(id);}}, {signal});
  get('[data-shared-profile]').addEventListener('click',()=>dialog.close(),{signal});
  dialog.addEventListener('click',e=>{if(e.target instanceof Element){const link=e.target.closest<HTMLAnchorElement>('a[href]');if(link&&(link.dataset.connectionEvidence||new URL(link.href,location.href).hash))dialog.close();}},{signal});
  root.querySelectorAll<HTMLButtonElement>('[data-panel-tab]').forEach((button,index)=>{button.addEventListener('click',()=>selectPanel(button.dataset.panelTab!),{signal});button.addEventListener('keydown',e=>{const tabs=Array.from(root.querySelectorAll<HTMLButtonElement>('[data-panel-tab]'));let next=index;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();selectPanel(tabs[next].dataset.panelTab!);tabs[next].focus();},{signal});});
  get('[data-back-to-me]').addEventListener('click',()=>{options={...SHARED_DEFAULT};depth.value='2';children.checked=true;siblings.checked=false;refocus(ADAM);},{signal});
  get('[data-compact-toggle]').addEventListener('click',()=>setCompact(!compact),{signal});
  gapInput.addEventListener('change',draw,{signal});
  root.querySelectorAll<HTMLInputElement>('[data-evidence-mode]').forEach(input=>input.addEventListener('change',()=>{mode=input.value as EvidenceView;options.whole=false;depth.value=String(options.ancestors===familyMapAncestorDepth?'ancestors':options.ancestors);draw();},{signal}));
  get('[data-shared-close]').addEventListener('click',()=>dialog.close(),{signal});get('[data-shared-explore]').addEventListener('click',()=>refocus(selected),{signal});
  get('[data-shared-center]').addEventListener('click',()=>center(focus),{signal});
  get('[data-shared-in]').addEventListener('click',()=>{if(view.scale<.2)center(focus);else zoom(view.scale*1.25);},{signal});get('[data-shared-out]').addEventListener('click',()=>zoom(view.scale/1.25),{signal});get('[data-shared-fit]').addEventListener('click',fit,{signal});
  get('[data-shared-whole]').addEventListener('click',()=>{options.whole=!options.whole;depth.value=options.whole?'all':options.ancestors===familyMapAncestorDepth?'ancestors':String(options.ancestors);draw();},{signal});get('[data-shared-reset]').addEventListener('click',()=>{options={...SHARED_DEFAULT};depth.value='2';children.checked=true;siblings.checked=false;gapInput.checked=false;refocus(ADAM);},{signal});
  for(const input of [depth,children,siblings])input.addEventListener('change',()=>{options={ancestors:depth.value==='all'||depth.value==='ancestors'?familyMapAncestorDepth:Number(depth.value),children:children.checked,siblings:siblings.checked,whole:depth.value==='all'};draw();},{signal});
  function showResults(){const q=search.value.trim();results.replaceChildren();popup.hidden=!q;if(!q)return;const matches=searchSharedPeople(q);status.textContent=`${matches.length} matches${matches.length>60?' · showing first 60; narrow the name':''}`;for(const p of matches.slice(0,60)){const li=document.createElement('li'),a=document.createElement('a');a.href=personUrl(p.id);a.dataset.sharedOpen=p.id;a.textContent=`${mapPersonLabel(p.id)} · ${p.dates}`;li.append(a);results.append(li);}}
  search.addEventListener('input',showResults,{signal});search.addEventListener('focus',showResults,{signal});search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector<HTMLElement>('a')?.focus();}if(e.key==='Enter'){e.preventDefault();const result=results.querySelector<HTMLElement>('a');if(result)openPerson(result.dataset.sharedOpen!);}if(e.key==='Escape')popup.hidden=true;},{signal});
  root.addEventListener('keydown',e=>{if(!(e.target instanceof Element))return;const node=e.target.closest<HTMLElement>('[data-shared-person]');if(node&&e.key.startsWith('Arrow')){const direction=e.key.slice(5).toLowerCase()as'left'|'right'|'up'|'down';const next=directionalNode(graph.nodes,node.dataset.sharedPerson!,direction);if(next){e.preventDefault();center(next.id);requestAnimationFrame(()=>nodes.get(next.id)?.focus({preventScroll:true}));}}},{signal});
  stage.addEventListener('keydown',e=>{if(e.target!==stage)return;if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.key==='Home')fit();else if(e.key==='+'||e.key==='='){if(view.scale<.2)center(focus);else zoom(view.scale*1.25);}else if(e.key==='-')zoom(view.scale/1.25);else if(e.key.startsWith('Arrow')){view.x+=e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0;view.y+=e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0;fitted=false;paint();}},{signal});
  const pointers=new Map<number,{x:number;y:number}>();let dragged=false;
  let panStart:{x:number;y:number;view:Viewport}|undefined;
  let pinch:{distance:number;anchorX:number;anchorY:number;scale:number}|undefined;
  stage.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    const p={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,p);panStart={...p,view:{...view}};dragged=false;
    if(pointers.size===2){const[a,b]=[...pointers.values()],r=stage.getBoundingClientRect();pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),anchorX:((a.x+b.x)/2-r.left-view.x)/view.scale,anchorY:((a.y+b.y)/2-r.top-view.y)/view.scale,scale:view.scale};}
  },{signal});
  stage.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()],r=stage.getBoundingClientRect(),scale=sharedScale(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance);view={scale,x:(a.x+b.x)/2-r.left-pinch.anchorX*scale,y:(a.y+b.y)/2-r.top-pinch.anchorY*scale};}
    else if(panStart&&Math.hypot(e.clientX-panStart.x,e.clientY-panStart.y)>4){view={...panStart.view,x:panStart.view.x+e.clientX-panStart.x,y:panStart.view.y+e.clientY-panStart.y};}
    else return;
    fitted=false;dragged=true;suppress=Date.now()+300;stage.setPointerCapture(e.pointerId);stage.classList.add('is-panning');paint();
  },{signal});
  const endPointer=(e:PointerEvent)=>{if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);pointers.delete(e.pointerId);pinch=undefined;stage.classList.remove('is-panning');const remaining=[...pointers.values()][0];panStart=remaining?{...remaining,view:{...view}}:undefined;if(dragged)suppress=Date.now()+300;};
  window.addEventListener('pointerup',endPointer,{signal});window.addEventListener('pointercancel',endPointer,{signal});
  stage.addEventListener('wheel',e=>{e.preventDefault();const delta=sharedWheelPixels(e,stage.clientHeight);if(e.ctrlKey||e.metaKey){const r=stage.getBoundingClientRect();zoom(view.scale*Math.exp(-delta.y*.003),{x:e.clientX-r.left,y:e.clientY-r.top});}else{view.x-=delta.x;view.y-=delta.y;fitted=false;paint();}},{signal,passive:false});
  const explorer=get('.family-explorer'),marker=document.createComment('shared family position');explorer.before(marker);const full=document.createElement('dialog');full.className='family-fullscreen-host';full.setAttribute('aria-label','Full screen family tree');root.append(full);let expanded=false;
  function fullscreen(on:boolean){expanded=on;if(on){full.append(explorer,dialog);full.showModal();explorer.classList.add('family-expanded');document.body.classList.add('family-map-open');}else{marker.after(explorer);root.append(dialog);explorer.classList.remove('family-expanded');full.close();document.body.classList.remove('family-map-open');}get('[data-shared-fullscreen]').textContent=on?'Exit full screen':'Full screen';requestAnimationFrame(()=>{fit();if(size().width<600&&!options.whole){center(focus);view.y+=70;paint();}});}
  get('[data-shared-fullscreen]').addEventListener('click',()=>fullscreen(!expanded),{signal});full.addEventListener('cancel',e=>{e.preventDefault();fullscreen(false);},{signal});
  const observer=new ResizeObserver(()=>{if(fitted)fit();else paint();});observer.observe(stage);setCompact(compact);draw();
  const revealMapGap=()=>{const target=document.getElementById(location.hash.slice(1));if(!target)return;for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;target.scrollIntoView({block:'center'});};
  window.addEventListener('hashchange',revealMapGap,{signal});revealMapGap();
  document.addEventListener('astro:before-swap',()=>{controller.abort();if(frame)cancelAnimationFrame(frame);observer.disconnect();dialog.close();full.close();document.body.classList.remove('family-map-open');},{once:true});
}
init();document.addEventListener('astro:page-load',init);
