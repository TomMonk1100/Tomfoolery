// Build-time only: a compact panel payload, never the raw imported record archive.
import { sharedRecords } from './shared-family-records';
import { people as researchPeople, sourceById, relationships } from './family';
import { ancestryFindings } from './ancestry-research';
import { familyMapAncestryById } from './family-map';
import { importedSourceInventory } from './recent-family-review';
export const familyPanelData=Object.fromEntries(Object.values(familyMapAncestryById).map(person=>{
  const record=Object.values(sharedRecords).find(r=>r.kind==='person'&&r.id===person.id);
  const research=researchPeople.find(p=>p.id===person.id);
  const findings=ancestryFindings.filter(f=>f.people.includes(person.id));
  const imported=importedSourceInventory(person.id).collections;
  const citations=[...new Set([...(research?.facts.flatMap(f=>f.sources)||[]),...relationships.filter(r=>r.from===person.id||r.to===person.id).flatMap(r=>r.sources)])].map(id=>sourceById[id]).filter(Boolean);
  const facts=(record?.sections.find(s=>s.title==='Overview')?.fields||[]).filter(f=>!['Gender'].includes(f.label)).map(f=>({label:f.label,value:f.value}));
  const events=record?.sections.find(s=>s.title==='Events')?.cards||[];
  return [person.id,{facts:[...facts,...(research?.facts.map(f=>({label:f.label,value:f.value+' · '+f.confidence+(f.note?' · '+f.note:'')}))||[])],notes:research?.notes||[],findings:findings.map(f=>({id:f.id,title:f.title,finding:f.finding,limit:f.limit,next:f.next,confidence:f.confidence,url:f.url,citation:f.citation,sourceKind:f.sourceKind})),sources:[...citations.map(s=>({title:s.title,url:s.url||'',citation:s.citation,kind:s.kind,inspected:s.inspected})),...imported.map(s=>({title:s.name,url:s.url,citation:'Imported collection reference. Matching original document has not necessarily been inspected.',kind:'family collection reference',inspected:false}))],events:events.map(e=>({name:e.name,url:e.url}))}];
}));
