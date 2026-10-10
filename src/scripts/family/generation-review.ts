import { ADAM, PATRICK, FRED_RICHARD, type SharedPerson } from '../../data/shared-family';
import { familyMapAncestryById, mapEdgeAssessment } from '../../data/family-map';

// Count positions, not unique names: the same ancestor can occupy several slots.
// Stop expanding an unknown slot; it represents an unresolved entire branch.
export function generationReview(root=ADAM, start=0, maximum=6, people:Record<string,SharedPerson>=familyMapAncestryById) {
  const rows: {child:string;parent:string|null;generation:number;path:string[];status:'supported'|'probable'|'provisional'|'unknown';citation:string|null;note:string}[]=[];
  function visit(id:string,g:number,path:string[]) {
    if(g>=maximum || !people[id]) return;
    const parents=people[id].parents;
    for(const parent of parents) {
      const assessment=mapEdgeAssessment(parent,id,'parent');
      const exists=!!people[parent], cyclic=path.includes(parent);
      rows.push({child:id,parent:exists?parent:null,generation:g+1,path:[...path,parent],status:exists?(assessment.confidence||'provisional'):'unknown',citation:assessment.evidenceUrl||null,note:cyclic?'Cyclic imported assertion; traversal stopped.':assessment.review||'Imported family assertion; relationship record not independently inspected.'});
      if(exists&&!cyclic)visit(parent,g+1,[...path,parent]);
    }
    for(let slot=parents.length;slot<2;slot++) rows.push({child:id,parent:null,generation:g+1,path:[...path,`gap-${id}-${slot+1}`],status:'unknown',citation:null,note:'Parent not identified. Earlier positions on this branch cannot yet be researched by identity.'});
  }
  visit(root,start,[root]);return rows;
}
export const sixGenerationBranches=[
  {name:'Biological ancestry',root:ADAM,start:0,rows:generationReview()},
  {name:'Fred’s upbringing family',root:FRED_RICHARD,start:2,rows:generationReview(FRED_RICHARD,2)},
];
// Fred belongs in the upbringing branch; this never adds him as Patrick’s biological parent.
export const upbringingBridge={from:FRED_RICHARD,to:PATRICK,kind:'raised' as const};
