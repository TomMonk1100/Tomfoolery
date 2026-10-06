import { sharedById, searchSharedPeople, ADAM, personUrl } from '../data/shared-family';
import { sharedGraph, SHARED_DEFAULT, SHARED_CARD, sharedFit, sharedScale, type SharedGraphOptions } from './family/shared-graph';
import { directionalNode, type Viewport } from './family/graph';
function init(){
  const found=document.querySelector<HTMLElement>('[data-shared-tree]');if(!found||found.dataset.initialized)return;const root=found;root.dataset.initialized='true';
  const controller=new AbortController(),{signal}=controller;
  const get=<T extends Element=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const stage=get('[data-shared-stage]'),world=get('[data-shared-world]'),lines=get<SVGSVGElement>('[data-shared-lines]'),labels=get('[data-shared-labels]');
  const search=get<HTMLInputElement>('#shared-search'),popup=get('[data-shared-popup]'),results=get('#shared-results'),status=get('[data-shared-status]');
  const depth=get<HTMLSelectElement>('[data-shared-depth]'),children=get<HTMLInputElement>('[data-shared-children]'),siblings=get<HTMLInputElement>('[data-shared-siblings]');
  const dialog=get<HTMLDialogElement>('[data-shared-dialog]'),nodes=new Map(Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-shared-person]')).map(n=>[n.dataset.sharedPerson!,n]));
  let focus=new URLSearchParams(location.search).get('focus')||ADAM;if(!sharedById[focus])focus=ADAM;
  let options:SharedGraphOptions={...SHARED_DEFAULT},graph=sharedGraph(focus,options),view:Viewport={x:0,y:0,scale:1},selected=focus, fitted=true,suppress=0;
  const size=()=>({width:stage.clientWidth,height:stage.clientHeight});
  const paint=()=>{world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;get<HTMLOutputElement>('[data-shared-zoom]').value=`${Math.round(view.scale*1000)/10}%`;};
  const fit=()=>{view=sharedFit(size(),graph);fitted=true;paint();};
  const zoom=(scale:number,point={x:stage.clientWidth/2,y:stage.clientHeight/2})=>{const next=sharedScale(scale);view={scale:next,x:point.x-(point.x-view.x)/view.scale*next,y:point.y-(point.y-view.y)/view.scale*next};fitted=false;paint();};
  function center(id:string){const n=graph.nodes.find(n=>n.id===id);if(!n)return;view={scale:Math.max(.65,view.scale),x:0,y:0};view.x=size().width/2-(n.x+SHARED_CARD.width/2)*view.scale;view.y=size().height/2-(n.y+SHARED_CARD.height/2)*view.scale;fitted=false;paint();}
  function draw(){
    graph=sharedGraph(focus,options);world.style.width=`${graph.width}px`;world.style.height=`${graph.height}px`;lines.setAttribute('width',String(graph.width));lines.setAttribute('height',String(graph.height));
    lines.replaceChildren(...graph.edges.map(e=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',e.path);p.dataset.kind=e.kind;return p;}));
    labels.replaceChildren(...graph.generations.map(g=>{const l=document.createElement('span');l.textContent=g.label;l.style.top=`${g.y-14}px`;return l;}));
    const byId=new Map(graph.nodes.map(n=>[n.id,n]));for(const [id,element]of nodes){const n=byId.get(id);element.hidden=!n;if(n){element.style.left=`${n.x}px`;element.style.top=`${n.y}px`;}if(id===focus)element.setAttribute('aria-current','true');else element.removeAttribute('aria-current');}
    get('[data-shared-title]').textContent=options.whole?'The complete family':focus===ADAM?'Tom’s family':`${sharedById[focus].name} · family`;
    get('[data-shared-count]').textContent=`${graph.nodes.length} in view / 611`;get<HTMLButtonElement>('[data-shared-whole]').setAttribute('aria-pressed',String(options.whole));fit();if(size().width<600&&!options.whole){center(focus);view.y+=70;paint();}
  }
  function refocus(id:string){if(!sharedById[id])return;focus=id;options.whole=false;dialog.close();popup.hidden=true;search.value='';const url=new URL(location.href);url.searchParams.set('focus',id);history.replaceState(null,'',url);draw();}
  function openPerson(id:string){
    const p=sharedById[id];if(!p)return;selected=id;
    get('[data-shared-person-name]').textContent=p.id===ADAM?`${p.name} (Tom)`:p.name;get('[data-shared-dates]').textContent=p.dates;
    get('[data-shared-aliases]').textContent=p.aliases.length?`Also recorded as: ${p.aliases.join(' · ')}`:'';
    get<HTMLAnchorElement>('[data-shared-profile]').href=personUrl(id);
    const relatives=get('[data-shared-relatives]');relatives.replaceChildren();
    for(const [label,ids]of [['Parents',p.parents],['Partners',p.partners],['Children',p.children]]as const){if(!ids.length)continue;const title=document.createElement('h4'),list=document.createElement('ul');title.textContent=label;list.className='family-profile-relations';for(const relative of ids){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.dataset.sharedOpen=relative;b.textContent=sharedById[relative].name;li.append(b);list.append(li);}relatives.append(title,list);}
    if(id===ADAM){const note=document.createElement('p');note.className='shared-provenance';note.textContent='Tom is Adam’s preferred name, supplied directly by Adam. His grandfather’s recorded line is Adam → Patrick → Mark Allen Stockwell.';relatives.prepend(note);}
    popup.hidden=true;if(!dialog.open)dialog.showModal();get('[data-shared-person-name]').focus({preventScroll:true});
  }
  root.addEventListener('click',e=>{if(!(e.target instanceof Element))return;if(e.target.closest('a[href="#italian-research"]')){const section=document.getElementById('italian-research') as HTMLDetailsElement;section.open=true;}const t=e.target.closest<HTMLElement>('[data-shared-person],[data-shared-open],[data-shared-focus]');if(t&&e instanceof MouseEvent&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(Date.now()<suppress)return;const id=t.dataset.sharedPerson||t.dataset.sharedOpen||t.dataset.sharedFocus!;if(t.dataset.sharedFocus)refocus(id);else openPerson(id);}}, {signal});
  get('[data-shared-close]').addEventListener('click',()=>dialog.close(),{signal});get('[data-shared-explore]').addEventListener('click',()=>refocus(selected),{signal});
  get('[data-shared-in]').addEventListener('click',()=>zoom(view.scale*1.25),{signal});get('[data-shared-out]').addEventListener('click',()=>zoom(view.scale/1.25),{signal});get('[data-shared-fit]').addEventListener('click',fit,{signal});
  get('[data-shared-whole]').addEventListener('click',()=>{options.whole=!options.whole;draw();},{signal});get('[data-shared-reset]').addEventListener('click',()=>{options={...SHARED_DEFAULT};depth.value='2';children.checked=true;siblings.checked=false;refocus(ADAM);},{signal});
  for(const input of [depth,children,siblings])input.addEventListener('change',()=>{options={ancestors:Number(depth.value),children:children.checked,siblings:siblings.checked,whole:false};draw();},{signal});
  function showResults(){const q=search.value.trim();results.replaceChildren();popup.hidden=!q;if(!q)return;const matches=searchSharedPeople(q);status.textContent=`${matches.length} people found${matches.length>60?' · showing first 60; narrow the name':''}`;for(const p of matches.slice(0,60)){const li=document.createElement('li'),a=document.createElement('a');a.href=personUrl(p.id);a.dataset.sharedOpen=p.id;a.textContent=`${p.name} · ${p.dates}`;li.append(a);results.append(li);}}
  search.addEventListener('input',showResults,{signal});search.addEventListener('focus',showResults,{signal});search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector<HTMLElement>('a')?.focus();}if(e.key==='Enter'){e.preventDefault();const result=results.querySelector<HTMLElement>('a');if(result)openPerson(result.dataset.sharedOpen!);}if(e.key==='Escape')popup.hidden=true;},{signal});
  root.addEventListener('keydown',e=>{if(!(e.target instanceof Element))return;const node=e.target.closest<HTMLElement>('[data-shared-person]');if(node&&e.key.startsWith('Arrow')){const direction=e.key.slice(5).toLowerCase()as'left'|'right'|'up'|'down';const next=directionalNode(graph.nodes,node.dataset.sharedPerson!,direction);if(next){e.preventDefault();center(next.id);nodes.get(next.id)?.focus({preventScroll:true});}}},{signal});
  stage.addEventListener('keydown',e=>{if(e.target!==stage)return;if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.key==='Home')fit();else if(e.key==='+'||e.key==='=')zoom(view.scale*1.25);else if(e.key==='-')zoom(view.scale/1.25);else if(e.key.startsWith('Arrow')){view.x+=e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0;view.y+=e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0;fitted=false;paint();}},{signal});
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
  const endPointer=(e:PointerEvent)=>{pointers.delete(e.pointerId);pinch=undefined;stage.classList.remove('is-panning');const remaining=[...pointers.values()][0];panStart=remaining?{...remaining,view:{...view}}:undefined;if(dragged)suppress=Date.now()+300;};
  window.addEventListener('pointerup',endPointer,{signal});window.addEventListener('pointercancel',endPointer,{signal});
  stage.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey){const r=stage.getBoundingClientRect();zoom(view.scale*Math.exp(-e.deltaY*.003),{x:e.clientX-r.left,y:e.clientY-r.top});}else{view.x-=e.deltaX;view.y-=e.deltaY;fitted=false;paint();}},{signal,passive:false});
  const explorer=get('.family-explorer'),marker=document.createComment('shared family position');explorer.before(marker);const full=document.createElement('dialog');full.className='family-fullscreen-host';full.setAttribute('aria-label','Full screen family tree');root.append(full);let expanded=false;
  function fullscreen(on:boolean){expanded=on;if(on){full.append(explorer,dialog);full.showModal();explorer.classList.add('family-expanded');document.body.classList.add('family-map-open');}else{marker.after(explorer);root.append(dialog);explorer.classList.remove('family-expanded');full.close();document.body.classList.remove('family-map-open');}get('[data-shared-fullscreen]').textContent=on?'Exit full screen':'Full screen';requestAnimationFrame(()=>{fit();if(size().width<600&&!options.whole){center(focus);view.y+=70;paint();}});}
  get('[data-shared-fullscreen]').addEventListener('click',()=>fullscreen(!expanded),{signal});full.addEventListener('cancel',e=>{e.preventDefault();fullscreen(false);},{signal});
  const observer=new ResizeObserver(()=>{if(fitted)fit();});observer.observe(stage);draw();
  document.addEventListener('astro:before-swap',()=>{controller.abort();observer.disconnect();dialog.close();full.close();document.body.classList.remove('family-map-open');},{once:true});
}
init();document.addEventListener('astro:page-load',init);
