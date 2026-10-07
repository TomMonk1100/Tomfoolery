import { describe, expect, it } from 'vitest';
import { ancestryAudit, ancestryPaths, missingParents } from '../ancestry';
import { sharedById, ADAM, MARK, PATRICK, type SharedPerson } from '../../../data/shared-family';
import { biblicalPeople, ancientGap } from '../../../data/biblical-family';
import { familyMapAncestryById } from '../../../data/family-map';
import { ancestryFindings } from '../../../data/ancestry-research';
import { relationshipReviews } from '../../../data/ancestry-relationships';
import { sharedGraph } from '../shared-graph';
describe('ancestry trails and explicit gaps', () => {
  it('derives the longest trail from actual parent assertions, starting at Tom', () => {
    const audit = ancestryAudit();
    expect(audit.ancestors).toHaveLength(173); expect(audit.paths).toHaveLength(82);
    expect(audit.longest).toHaveLength(26); expect(audit.longest.slice(0,3)).toEqual([ADAM,PATRICK,MARK]);
    expect(sharedById[audit.longest.at(-1)!].name).toBe('Henry Degotham ***');
    for (const path of audit.paths) for (let i=1;i<path.length;i++) expect(sharedById[path[i-1]].parents).toContain(path[i]);
    expect(new Set(audit.gaps.map(g=>g.id)).size).toBe(audit.gaps.length);
  });
  it('gives only immediate missing positions with stable identity, and no invented people', () => {
    const person = sharedById[ancestryAudit().longest.at(-1)!];
    expect(missingParents(person)).toHaveLength(2);
    expect(missingParents({...person,name:'Different spelling'})).toEqual(missingParents(person));
    expect(missingParents({...person,parents:[MARK]})).toHaveLength(1);
    expect(missingParents({...person,parents:[MARK,PATRICK]})).toEqual([]);
    for (const gap of ancestryAudit().gaps) { expect(sharedById[gap.id]).toBeUndefined(); expect(gap).toMatchObject({confidence:'provisional',sourceKind:'inference'}); }
  });
  it('terminates a cyclic or incomplete supplied pedigree without manufacturing an edge', () => {
    const p = (id:string,parents:string[]):SharedPerson => ({id,parents,name:id,uuid:id,dates:'',aliases:[],partners:[],children:[],gender:''});
    expect(ancestryPaths('a',{a:p('a',['b','absent']),b:p('b',['a'])})).toEqual([['a','b']]);
    expect(ancestryPaths('absent',{})).toEqual([]);
  });
  it('keeps biblical narrative entirely disconnected from the imported family', () => {
    expect(biblicalPeople).toHaveLength(21);
    const ids = new Set(biblicalPeople.map(p=>p.id));
    for (const p of biblicalPeople) { expect(sharedById[p.id]).toBeUndefined(); expect(p.sourceKind).toBe('biblical narrative'); for (const parent of p.parents) expect(ids.has(parent)).toBe(true); }
    expect(biblicalPeople.find(p=>p.name==='Seth')!.parents).toEqual(['bible-adam','bible-eve']);
    expect(ancientGap).toMatchObject({generations:null,connected:false});
    expect(Object.keys(familyMapAncestryById).some(id=>id.startsWith('candidate-'))).toBe(false);
  });
  it('marks disputed parent links without replacing imported assertions or partners', () => {
    const graph = sharedGraph(ADAM,{ancestors:2,children:true,siblings:false,whole:true});
    const importedReviews = relationshipReviews.filter(review => sharedById[review.child]?.parents.includes(review.parent));
    expect(graph.edges.filter(e=>e.confidence==='provisional')).toHaveLength(importedReviews.length);
    for (const review of importedReviews) {
      expect(sharedById[review.child].parents).toContain(review.parent);
      expect(ancestryFindings.some(f=>f.id===review.finding)).toBe(true);
      expect(graph.edges.find(e=>e.from===review.parent&&e.to===review.child)).toMatchObject({kind:'parent',confidence:'provisional',importedConfidence:'supported',sourceKind:'compiled genealogy',review:review.finding});
    }
    expect(graph.edges.filter(e=>e.kind==='partner').every(e=>e.confidence==='supported'&&!e.review)).toBe(true);
    expect(ancestryFindings.find(f=>f.id==='needles-kent-administration-1748')).toMatchObject({sourceKind:'original record',confidence:'probable'});
  });
});
