import { describe, it, expect } from 'vitest';
import { familyMapPeople, familyMapById, familyMapAncestryById, confirmedAncestryById, mapEdgeAssessment, isConfirmedConnection, searchFamilyMap, mapProfileUrl } from '../../../data/family-map';
import { sharedPeople, sharedById, ADAM, PATRICK, MARK, FRED_RICHARD } from '../../../data/shared-family';
import { ancestryAudit } from '../ancestry';
import { sharedGraph, SHARED_CARD } from '../shared-graph';

describe('evidence-backed family tree', () => {
  it('excludes biblical, legendary and speculative candidate identities from every display scope', () => {
    expect(familyMapPeople.some(p=> /^(bible-|legend-|candidate-)/.test(p.id))).toBe(false);
    expect(searchFamilyMap('Abraham')).toEqual([]);
    const graph = sharedGraph(ADAM, {ancestors:100, children:true, siblings:true, whole:true}, familyMapById, mapEdgeAssessment);
    expect(graph.nodes).toHaveLength(familyMapPeople.length);
    for (const edge of graph.edges) {
      if (edge.from.startsWith('gap-')) expect(edge.sourceKind).toBe('inference');
      else expect(isConfirmedConnection(edge.from, edge.to, edge.kind)).toBe(true);
    }
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + SHARED_CARD.width).toBeLessThanOrEqual(graph.width);
      expect(node.y + SHARED_CARD.height).toBeLessThanOrEqual(graph.height);
    }
  });
  it('keeps the imported assertions available for research without silently promoting them', () => {
    for (const p of sharedPeople) expect(familyMapAncestryById[p.id].parents).toEqual(expect.arrayContaining(p.parents));
    expect(sharedById[PATRICK].parents).toContain(MARK);
    expect(familyMapById[PATRICK].parents).toContain(MARK);
    expect(familyMapById[PATRICK].parents).not.toContain(FRED_RICHARD);
    expect(familyMapById[ADAM].parents).toContain(PATRICK);
    expect(mapProfileUrl(ADAM)).toBe(`/family/person/${ADAM}/`);
  });
  it('stops at unresolved parentage and excludes supported labels backed only by compiled genealogies', () => {
    expect(isConfirmedConnection('p001', 'p005', 'parent')).toBe(false);
    expect(isConfirmedConnection('p001', 'p007', 'parent')).toBe(false);
    expect(isConfirmedConnection('p022', 'p001', 'parent')).toBe(true);
    expect(familyMapById.p001.parents).toContain('p022');
    const audit = ancestryAudit(ADAM, confirmedAncestryById);
    expect(audit.ids).toContain(MARK);
    expect(audit.ids).not.toContain('candidate-egbert');
    expect(confirmedAncestryById[MARK].parents).toEqual([]);
  });
  it('creates stable immediate gaps without inventing earlier generations', () => {
    expect(new Set(familyMapPeople.map(p=>p.id)).size).toBe(familyMapPeople.length);
    for (const p of familyMapPeople.filter(p=>p.kind==='unknown')) {
      expect(p.parents).toEqual([]);
      expect(p.children).toEqual([p.child]);
      expect(familyMapById[p.child!].parents).toContain(p.id);
      expect(mapProfileUrl(p.id)).toBe(`/family/#map-${p.id}`);
    }
    expect(searchFamilyMap('Tom Muncie').some(p=>p.id===ADAM)).toBe(true);
  });
});
