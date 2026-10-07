import { describe, it, expect } from 'vitest';
import { explorerPeople, explorerGraph, browsePeople, connectionAssessment, pathFromTom } from '../explorer';
import { ADAM, PATRICK, MARK, FRED_RICHARD } from '../../../data/shared-family';
import { familyMapAncestryById } from '../../../data/family-map';
const options={ancestors:2,children:true,siblings:false,whole:false};
describe('family explorer evidence and upbringing',()=>{
  it('keeps known but unverified parents visible in the family account, excluding speculative additions',()=>{
    const family=explorerPeople('family');const supported=explorerPeople('supported');
    const mother=familyMapAncestryById[ADAM].parents.find(id=>id!==PATRICK)!;
    expect(family[ADAM].parents).toContain(mother);
    expect(supported[ADAM].parents).not.toContain(mother);
    expect(connectionAssessment(mother,ADAM,'parent')).toMatchObject({confidence:'provisional',sourceKind:'compiled genealogy'});
    expect(Object.keys(family).some(id=>/^(bible-|legend-|candidate-)/.test(id))).toBe(false);
  });
  it('hides gaps by default and regenerates the same positions without changing the source',()=>{
    const before=[...familyMapAncestryById[MARK].parents];
    expect(Object.keys(explorerPeople('family')).some(id=>id.startsWith('gap-'))).toBe(false);
    const first=explorerPeople('supported',true),second=explorerPeople('supported',true);
    expect(first[MARK].parents).toEqual(second[MARK].parents);
    expect(first[MARK].parents).toHaveLength(2);
    expect(familyMapAncestryById[MARK].parents).toEqual(before);
  });
  it('draws upbringing distinctly without adding a biological parent or changing ancestry data',()=>{
    const people=explorerPeople('supported');const graph=explorerGraph(ADAM,options,people);
    expect(graph.edges.find(e=>e.from===FRED_RICHARD&&e.to===PATRICK)).toMatchObject({role:'raised',sourceKind:'user supplied',confidence:'supported'});
    expect(graph.edges.find(e=>e.from===MARK&&e.to===PATRICK)?.role).toBe('biological');
    expect(people[PATRICK].parents).not.toContain(FRED_RICHARD);
    expect(browsePeople[PATRICK].parents).not.toContain(FRED_RICHARD);
    expect(explorerGraph(FRED_RICHARD,options,people).nodes.some(n=>n.id===PATRICK)).toBe(true);
  });
  it('shows upbringing and recorded paths while stopping at unsupported ancestry',()=>{
    expect(pathFromTom(FRED_RICHARD,explorerPeople('supported')).map(s=>s.role)).toContain('Raised Patrick');
    const mother=browsePeople[ADAM].parents.find(id=>id!==PATRICK)!;
    expect(pathFromTom(mother,explorerPeople('family')).at(-1)?.id).toBe(mother);
    expect(pathFromTom(mother,explorerPeople('supported'))).toEqual([]);
  });
  it('keeps the complete graph finite and every displayed endpoint in its person set',()=>{
    for(const mode of ['family','supported'] as const){const people=explorerPeople(mode,true);const graph=explorerGraph(ADAM,{...options,whole:true},people);for(const edge of graph.edges){expect(people[edge.from]).toBeDefined();expect(people[edge.to]).toBeDefined();}expect(Number.isFinite(graph.width)).toBe(true);}
  });
});
