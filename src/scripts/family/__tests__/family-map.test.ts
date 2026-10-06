import { describe, expect, it } from 'vitest';
import { familyMapPeople, familyMapById, familyMapKnownCount, searchFamilyMap, mapProfileUrl, mapEdgeAssessment } from '../../../data/family-map';
import { sharedPeople, sharedById, ADAM, MARK, PATRICK, FRED_RICHARD } from '../../../data/shared-family';
import { people as researchPeople, relationships } from '../../../data/family';
import { biblicalPeople } from '../../../data/biblical-family';
import { sharedGraph, SHARED_CARD } from '../shared-graph';

describe('all known people and explicit unknown positions on one map', () => {
  it('preserves every family person and adds all biblical people as distinct identities', () => {
    expect(familyMapKnownCount).toBe(650);
    expect(new Set(familyMapPeople.map(p => p.id)).size).toBe(familyMapPeople.length);
    for (const p of sharedPeople) {
      expect(familyMapById[p.id]).toMatchObject({ name:p.name, kind:'family' });
      expect(familyMapById[p.id].parents).toEqual(expect.arrayContaining(p.parents));
      expect(familyMapById[p.id].children).toEqual(expect.arrayContaining(p.children));
      expect(familyMapById[p.id].partners).toEqual(expect.arrayContaining(p.partners));
      expect(familyMapById[p.id].parents.filter(id=>!id.startsWith('gap-'))).toEqual(expect.arrayContaining(p.parents));
    }
    for (const p of biblicalPeople) expect(familyMapById[p.id]).toMatchObject({ name:p.name, kind:'biblical', sourceKind:'biblical narrative' });
    expect(sharedById[PATRICK].parents).toEqual([MARK, expect.any(String)]);
    expect(familyMapById[PATRICK].parents).not.toContain(FRED_RICHARD);
  });
  it('includes all existing Italian research without upgrading its assertions', () => {
    for(const p of researchPeople) expect(familyMapById[p.id].name).toBeDefined();
    expect(sharedById.p001.parents).toEqual([]);
    expect(familyMapById.p001.parents).toEqual(['p022','p023']);
    expect(mapProfileUrl('p022')).toBe('/family/#person-p022');
    const graph=sharedGraph(ADAM,{ancestors:30,children:true,siblings:true,whole:true},familyMapById,mapEdgeAssessment);
    for(const r of relationships.filter(r=>r.kind==='parent')) {
      expect(graph.edges.find(e=>e.from===r.from && e.to===r.to)).toMatchObject({confidence:r.confidence,review:r.note});
    }
    expect(graph.edges.find(e=>e.from==='p022' && e.to==='p001')).toMatchObject({sourceKind:'original record'});
  });
  it('adds only immediate ? positions, without invented parents for Adam and Eve or for placeholders', () => {
    for (const p of familyMapPeople.filter(p=>p.kind==='unknown')) {
      expect(p.name).toBe('?'); expect(p.parents).toEqual([]);
      expect(p.children).toEqual([p.child]);
      expect(familyMapById[p.child!].parents).toContain(p.id);
      expect(p.sourceKind).toBe('inference');
    }
    expect(familyMapById['bible-adam'].parents).toEqual([]);
    expect(familyMapById['bible-eve'].parents).toEqual([]);
    expect(familyMapById['bible-seth'].parents).toEqual(['bible-adam','bible-eve']);
  });
  it('keeps the biblical branch disconnected even in whole-tree mode', () => {
    const graph=sharedGraph(ADAM,{ancestors:30,children:true,siblings:true,whole:true},familyMapById,mapEdgeAssessment);
    expect(graph.nodes).toHaveLength(familyMapPeople.length);
    for (const edge of graph.edges) {
      const branch = (id:string):string => familyMapById[id].kind==='unknown' ? branch(familyMapById[id].child!) : familyMapById[id].kind === 'biblical' ? 'biblical' : 'modern';
      expect(branch(edge.from)).toBe(branch(edge.to));
      if (familyMapById[edge.from].kind==='unknown') expect(edge).toMatchObject({confidence:'provisional',sourceKind:'inference'});
      if (familyMapById[edge.to].kind==='biblical' && familyMapById[edge.from].kind!=='unknown') expect(edge.sourceKind).toBe('biblical narrative');
    }
    for (const n of graph.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x+SHARED_CARD.width).toBeLessThanOrEqual(graph.width);
      expect(n.y+SHARED_CARD.height).toBeLessThanOrEqual(graph.height);
    }
  });
  it('finds biblical identities, Tom, and ? positions without pointing to nonexistent profiles', () => {
    expect(searchFamilyMap('Eve').some(p=>p.id==='bible-eve')).toBe(true);
    expect(searchFamilyMap('Abraham').some(p=>p.id==='bible-abram')).toBe(true);
    expect(searchFamilyMap('Tom Muncie').some(p=>p.id===ADAM)).toBe(true);
    expect(searchFamilyMap('?').some(p=>p.kind==='unknown')).toBe(true);
    expect(searchFamilyMap('?').some(p=>p.id==='p003')).toBe(true);
    expect(mapProfileUrl('bible-eve')).toBe('/family/#bible-eve');
    expect(mapProfileUrl('gap-bible-abram-parent-1')).toBe('/family/#map-gap-bible-abram-parent-1');
    expect(mapProfileUrl(ADAM)).toBe(`/family/person/${ADAM}/`);
  });
});
