import { sharedPeople, sharedById, type SharedPerson } from '../../data/shared-family';
export const SHARED_CARD = { width: 224, height: 112 };
export interface SharedNode { id:string; x:number; y:number; generation:number }
export interface SharedEdge { from:string; to:string; kind:'parent'|'partner'; confidence:'supported'; sourceKind:'compiled genealogy'; sourcePerson:string; path:string }
export interface SharedGraph { nodes:SharedNode[]; edges:SharedEdge[]; width:number; height:number; generations:{label:string;y:number}[] }
export interface SharedGraphOptions { ancestors:number; children:boolean; siblings:boolean; whole:boolean }
export const SHARED_DEFAULT:SharedGraphOptions = {ancestors:2,children:true,siblings:false,whole:false};
export function sharedGraph(focus:string, options:SharedGraphOptions=SHARED_DEFAULT):SharedGraph {
  const generations = new Map<string,number>();
  if(options.whole){
    // Partners share a visual generation. This aligns remarriages while parent
    // edges still come only from the separately recorded parent assertions.
    const cohorts = new Map(sharedPeople.map(p=>[p.id,p.id]));
    const root=(id:string):string=>{const parent=cohorts.get(id)!;if(parent===id)return id;const result=root(parent);cohorts.set(id,result);return result;};
    for(const p of sharedPeople)for(const partner of p.partners)cohorts.set(root(partner),root(p.id));
    const groups=new Map<string,string[]>();
    for(const p of sharedPeople){const r=root(p.id);groups.set(r,[...(groups.get(r)||[]),p.id]);}
    const ranks=new Map<string,number>(),pending=new Set(groups.keys());
    for(let pass=0;pending.size&&pass<groups.size;pass++){
      let progressed=false;
      for(const id of pending){const parents=[...new Set(groups.get(id)!.flatMap(p=>sharedById[p].parents.map(root)))];if(parents.every(parent=>ranks.has(parent))){ranks.set(id,Math.max(-1,...parents.map(parent=>ranks.get(parent)!))+1);pending.delete(id);progressed=true;}}
      if(!progressed)break;
    }
    for(const p of sharedPeople)generations.set(p.id,ranks.get(root(p.id))??0);
  }else{
    generations.set(focus,0);
    let frontier=[focus];
    for(let depth=1;depth<=options.ancestors&&frontier.length;depth++){
      const next:string[]=[];
      for(const id of frontier)for(const parent of sharedById[id].parents)if(!generations.has(parent)){generations.set(parent,-depth);next.push(parent);}
      frontier=next;
    }
    if(options.children)for(const child of sharedById[focus].children)if(!generations.has(child))generations.set(child,1);
    if(options.siblings)for(const parent of sharedById[focus].parents)for(const sibling of sharedById[parent].children)if(!generations.has(sibling))generations.set(sibling,0);
    // Include recorded partners, including Gloria's later Muncie family, without
    // attaching those partners as parents of children from another family.
    for(const [id,g] of [...generations])for(const partner of sharedById[id].partners)if(!generations.has(partner))generations.set(partner,g);
  }
  const groups=new Map<number,string[]>();
  for(const [id,g]of generations)groups.set(g,[...(groups.get(g)||[]),id]);
  const rows=[...groups].sort((a,b)=>a[0]-b[0]);
  const gap=32, stride=SHARED_CARD.width+gap;
  const width=Math.max(...rows.map(([,ids])=>ids.length))*stride+48;
  const nodes:SharedNode[]=[];
  const nodeMap=new Map<string,SharedNode>();
  for(const [generation,ids] of rows){
    // Stable ordering by already positioned parents keeps related households near
    // each other. Person UUIDs break ties, so names never redefine identity.
    const parentCenter=(id:string)=>{const parents=sharedById[id].parents.map(p=>nodeMap.get(p)).filter((p):p is SharedNode=>!!p);return parents.length?parents.reduce((s,p)=>s+p.x,0)/parents.length:width/2;};
    ids.sort((a,b)=>parentCenter(a)-parentCenter(b)||sharedById[a].name.localeCompare(sharedById[b].name)||a.localeCompare(b));
    const ordered:string[]=[];
    for(const id of ids)if(!ordered.includes(id)){ordered.push(id);for(const partner of sharedById[id].partners)if(ids.includes(partner)&&!ordered.includes(partner))ordered.push(partner);}
    ordered.forEach((id,i)=>{const node={id,generation,x:(width-ordered.length*stride)/2+i*stride,y:52+(generation-rows[0][0])*180};nodes.push(node);nodeMap.set(id,node);});
  }
  const edges:SharedEdge[]=[];
  for(const node of nodes){
    const p:SharedPerson=sharedById[node.id];
    p.parents.forEach((id,i)=>{const parent=nodeMap.get(id);if(!parent)return;const sx=parent.x+SHARED_CARD.width/2,sy=parent.y+SHARED_CARD.height,tx=node.x+SHARED_CARD.width/2+(i-(p.parents.length-1)/2)*12,ty=node.y;const lane=sy+22+(i%3)*7;edges.push({from:id,to:p.id,kind:'parent',confidence:'supported',sourceKind:'compiled genealogy',sourcePerson:p.id,path:`M ${sx} ${sy} V ${lane} H ${tx} V ${ty}`});});
    for(const id of p.partners){const partner=nodeMap.get(id);if(!partner||node.id>id)continue;const left=node.x<partner.x?node:partner,right=left===node?partner:node;const y=left.y+SHARED_CARD.height/2;edges.push({from:node.id,to:id,kind:'partner',confidence:'supported',sourceKind:'compiled genealogy',sourcePerson:p.id,path:left.generation===right.generation?`M ${left.x+SHARED_CARD.width} ${y} H ${right.x}`:`M ${left.x+SHARED_CARD.width} ${y} H ${right.x+SHARED_CARD.width/2} V ${right.y}`});}
  }
  return {nodes,edges,width,height:Math.max(...nodes.map(n=>n.y))+SHARED_CARD.height+40,generations:rows.map(([g])=>({label:options.whole?`Family depth ${g+1}`:g===0?'Selected person & family':g===1?'Children':g===-1?'Parents':g===-2?'Grandparents & partners':`${-g} generations earlier`,y:28+(g-rows[0][0])*180}))};
}
export const sharedScale=(scale:number)=>Math.max(.001,Math.min(2,scale));
export function sharedFit(size:{width:number;height:number},graph:{width:number;height:number}){const scale=sharedScale(Math.min(1,(size.width-32)/graph.width,(size.height-32)/graph.height));return{scale,x:(size.width-graph.width*scale)/2,y:(size.height-graph.height*scale)/2};}
