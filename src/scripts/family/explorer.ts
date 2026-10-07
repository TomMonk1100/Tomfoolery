import { ADAM, PATRICK } from '../../data/shared-family';
import { upbringing } from '../../data/close-family-evidence';
import { familyMapById, familyMapAncestryById, mapEdgeAssessment, type MapPerson } from '../../data/family-map';
import { sharedGraph, type SharedGraphOptions } from './shared-graph';
import { missingParents } from './ancestry';
export type EvidenceView = 'family' | 'supported';
export const browsePeople: Record<string, MapPerson> = Object.fromEntries(Object.values(familyMapAncestryById).map(p=>[p.id, {...p, kind:p.id.startsWith('p0')?'research':'family',sourceKind:'compiled genealogy'}]));
// Rebuild reciprocal child entries from parent assertions; never infer parentage from a partner.
for (const p of Object.values(browsePeople)) p.children = Object.values(browsePeople).filter(child=>child.parents.includes(p.id)).map(child=>child.id);
export function explorerPeople(mode: EvidenceView, gaps = false): Record<string, MapPerson> {
  const base = mode === 'family' ? browsePeople : Object.fromEntries(Object.entries(familyMapById).filter(([,p])=>p.kind!=='unknown'));
  const result: Record<string, MapPerson> = Object.fromEntries(Object.values(base).map(p=>[p.id,{...p,parents:p.parents.filter(id=>base[id]),children:p.children.filter(id=>base[id]),partners:p.partners.filter(id=>base[id])}]));
  if (gaps) for (const p of Object.values(result)) for (const gap of missingParents(p)) {
    result[gap.id] = {id:gap.id,uuid:gap.id,name:'?',dates:'Parent not established',aliases:[`Unfilled parent position for ${p.name}`],gender:'',parents:[],partners:[],children:[p.id],child:p.id,kind:'unknown',sourceKind:'inference'};
    p.parents.push(gap.id);
  }
  return result;
}
export function connectionAssessment(from:string,to:string,kind:'parent'|'partner') {
  if (from.startsWith('gap-')) return {confidence:'provisional' as const,sourceKind:'inference' as const,review:'Unfilled immediate parent position.'};
  const assessment=mapEdgeAssessment(from,to,kind);
  return assessment.confidence ? assessment : {confidence:'provisional' as const,sourceKind:'compiled genealogy' as const,review:'Recorded in the family account; independent relationship evidence has not been reviewed.',evidenceUrl:`/family/person/${to}/`};
}
export const preferredName=(id:string, people:Record<string,MapPerson>=browsePeople)=>id===ADAM?'Tom Muncie':id===PATRICK?'Patrick Muncie':people[id]?.name.replace(/\s*\*+\s*$/,'').trim()||'?';
export const lifeYears=(dates:string)=>dates.replace(/(\d{4})-\d{2}-\d{2}/g,'$1');
export function personBadge(id:string) {
  const p=browsePeople[id]; if(!p)return 'Research gap';
  if(id===upbringing.raisedBy)return 'Raised Patrick · testimony';
  const assessments=[...p.parents.map(parent=>connectionAssessment(parent,id,'parent')), ...p.children.map(child=>connectionAssessment(id,child,'parent'))];
  if(assessments.some(a=>a.confidence==='supported' && a.sourceKind!=='compiled genealogy')) return 'Supported connection';
  if(assessments.some(a=>a.confidence==='probable')) return 'Probable connection';
  return 'Family account · unverified';
}
export function explorerGraph(focus:string,options:SharedGraphOptions,people:Record<string,MapPerson>) {
  // Layout the upbringing link alongside parents, but keep it separate from biological ancestry data.
  const layout={...people};
  if(layout[upbringing.child]&&layout[upbringing.raisedBy]) { layout[upbringing.raisedBy]={...layout[upbringing.raisedBy],children:[...new Set([...layout[upbringing.raisedBy].children,upbringing.child])]}; layout[upbringing.child]={...layout[upbringing.child],parents:[...new Set([...layout[upbringing.child].parents,upbringing.raisedBy])]}; }
  const graph=sharedGraph(focus,options,layout,connectionAssessment);
  return {...graph,edges:graph.edges.map(edge=>({...edge,role:edge.from===upbringing.raisedBy&&edge.to===upbringing.child?'raised':edge.from===upbringing.biologicalFather&&edge.to===upbringing.child?'biological':edge.kind==='partner'?'partner':'recorded',...(edge.from===upbringing.raisedBy&&edge.to===upbringing.child?{confidence:'supported' as const,sourceKind:'user supplied' as const,review:upbringing.note}: {})}))};
}
export interface FamilyPathStep { id:string; role:string }
export function pathFromTom(target:string,people:Record<string,MapPerson>):FamilyPathStep[] {
  if(!people[ADAM]||!people[target])return [];
  const queue:FamilyPathStep[][]=[[{id:ADAM,role:'You'}]],seen=new Set([ADAM]);
  for(let i=0;i<queue.length;i++) {
    const path=queue[i],p=people[path.at(-1)!.id];if(p.id===target)return path;
    const neighbors=[...p.parents.map(id=>({id,role:id===upbringing.biologicalFather&&p.id===upbringing.child?'Biological father':'Recorded parent'})),...p.children.map(id=>({id,role:'Recorded child'})),...p.partners.map(id=>({id,role:'Partner'})),...(p.id===upbringing.child?[{id:upbringing.raisedBy,role:'Raised Patrick'}]:[]),...(p.id===upbringing.raisedBy?[{id:upbringing.child,role:'Raised by this family'}]:[])];
    for(const next of neighbors)if(people[next.id]&&!seen.has(next.id)&&people[next.id].kind!=='unknown'){seen.add(next.id);queue.push([...path,next]);}
  }
  return [];
}
