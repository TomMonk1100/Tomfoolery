import { describe, expect, it } from 'vitest';
import { sharedPeople, sharedFamilies, sharedById, sharedCounts, ADAM, KEVIN, PATRICK, MARK, GLORIA, FRED_RICHARD, searchSharedPeople } from '../../../data/shared-family';
import { sharedRecords } from '../../../data/shared-family-records';
import { sharedGraph, sharedFit, SHARED_CARD } from '../shared-graph';
describe('complete shared family import',()=>{
  it('preserves the full published inventory and permanent identities',()=>{
    expect(sharedPeople).toHaveLength(611);expect(sharedFamilies).toHaveLength(186);
    expect(Object.values(sharedRecords).filter(r=>r.kind==='event')).toHaveLength(1866);
    expect(sharedCounts).toMatchObject({personEventReferences:2026,familyEvents:160,sources:238,media:74,places:686});
    expect(new Set(sharedPeople.map(p=>p.id)).size).toBe(611);
    expect(new Set(sharedPeople.map(p=>p.uuid)).size).toBe(611);
    expect(sharedById.p001.name).toBe('Palmiero Mangini');expect(sharedById.p002.name).toBe('Emiecia Ricchiuto');
    expect(sharedById.p007.name).toBe('Fred Victor Muncie');
  });
  it('keeps the Stockwell line and the later Muncie family separate',()=>{
    expect(sharedById[ADAM].parents).toContain(PATRICK);expect(sharedById[KEVIN].parents).toContain(PATRICK);
    expect(sharedById[PATRICK].parents).toEqual([MARK,GLORIA]);expect(sharedById[PATRICK].parents).not.toContain(FRED_RICHARD);
    expect(sharedById[GLORIA].partners).toContain(FRED_RICHARD);
    const graph=sharedGraph(ADAM);expect(graph.nodes.map(n=>n.id)).toContain(FRED_RICHARD);
    expect(graph.edges).toContainEqual(expect.objectContaining({from:MARK,to:PATRICK,kind:'parent'}));
    expect(graph.edges.some(e=>e.from===FRED_RICHARD&&e.to===PATRICK&&e.kind==='parent')).toBe(false);
  });
  it('does not merge similarly named records or manufacture missing Italian parents',()=>{
    const duplicateNames=sharedPeople.filter(p=>p.name==='Lee Roy Sterling');expect(duplicateNames).toHaveLength(2);expect(duplicateNames[0].id).not.toBe(duplicateNames[1].id);
    expect(sharedById.p001.parents).toEqual([]);expect(sharedById.p002.parents).toEqual([]);
    expect(searchSharedPeople('Tom Muncie').map(p=>p.id)).toContain(ADAM);expect(searchSharedPeople('Paul Muncie').map(p=>p.id)).toContain('p001');
  });
  it('has no dangling person or record references',()=>{
    for(const p of sharedPeople)for(const id of [...p.parents,...p.partners,...p.children])expect(sharedById[id],`${p.name} → ${id}`).toBeDefined();
    for(const f of sharedFamilies)for(const id of [...f.parents,...f.children])expect(sharedById[id]).toBeDefined();
    for(const r of Object.values(sharedRecords))for(const s of r.sections)for(const l of [...s.cards,...s.fields.flatMap(f=>f.links)]){
      if(!l.url.startsWith('/family/'))continue;const parts=l.url.split('/').filter(Boolean);
      const key=parts[1]==='person'?`person:${parts[2]}`:`${parts[2]}:${parts[3]}`;
      expect(sharedRecords[key],`${r.title} → ${key}`).toBeDefined();
    }
  });
  it('retains conflicting event dates instead of choosing one silently',()=>{
    const p=sharedRecords[`person:${PATRICK}`];const dates=p.sections.find(s=>s.title==='Events')!.cards.filter(c=>c.name==='Marriage').flatMap(c=>c.fields.filter(f=>f.label==='Date').map(f=>f.value));
    expect(dates).toContain('1982-04-10');expect(dates).toContain('1983-04-10');
    const palmiero=sharedRecords['person:p001'];expect(palmiero.sections.find(s=>s.title==='Overview')!.fields.some(f=>f.value==='Franklin, Warren County, Ohio, USA')).toBe(true);
  });
});
describe('scalable family graph',()=>{
  it('includes all 611 records in whole-tree mode with bounded, nonoverlapping cards',()=>{
    const graph=sharedGraph(ADAM,{ancestors:2,children:true,siblings:false,whole:true});expect(graph.nodes).toHaveLength(611);
    for(const n of graph.nodes){expect(n.x).toBeGreaterThanOrEqual(0);expect(n.x+SHARED_CARD.width).toBeLessThanOrEqual(graph.width);expect(n.y+SHARED_CARD.height).toBeLessThanOrEqual(graph.height);}
    for(const a of graph.nodes)for(const b of graph.nodes)if(a.id!==b.id&&a.generation===b.generation)expect(Math.abs(a.x-b.x)).toBeGreaterThanOrEqual(SHARED_CARD.width);
    const view=sharedFit({width:390,height:440},graph);expect(graph.width*view.scale).toBeLessThanOrEqual(390);expect(graph.height*view.scale).toBeLessThanOrEqual(440);
    for(const edge of graph.edges.filter(e=>e.kind==='parent'))expect(graph.nodes.find(n=>n.id===edge.from)!.generation).toBeLessThan(graph.nodes.find(n=>n.id===edge.to)!.generation);
  });
  it('expands recorded ancestors without dropping focus or duplicating people',()=>{
    for(const p of sharedPeople){const graph=sharedGraph(p.id,{ancestors:30,children:true,siblings:true,whole:false});expect(graph.nodes.some(n=>n.id===p.id)).toBe(true);expect(new Set(graph.nodes.map(n=>n.id)).size).toBe(graph.nodes.length);}
  });
});
