import { describe, expect, it } from 'vitest';
import { familyMapPeople, familyMapById, familyMapKnownCount, familyMapAncestorDepth, searchFamilyMap, mapProfileUrl, mapEdgeAssessment } from '../../../data/family-map';
import { sharedPeople, sharedById, ADAM, MARK, PATRICK, FRED_RICHARD } from '../../../data/shared-family';
import { people as researchPeople, relationships } from '../../../data/family';
import { candidatePeople, ANDREA_GOTHAM, HENRY_GOTHAM, NEWMAN_PRATHER, JOSIAH_PRATHER, JOHN_SMITH_PRATHER, ELIZABETH_NUTHALL, MARY_HYDE, ROBERT_HYDE, JOHN_CROSS_MANOR, EDWARD_I, EGBERT, ALFRED, ETHELWULF, ELIZABETH_RHUDDLAN, candidateRelationships } from '../../../data/ancestry-candidates';
import { ancestryAudit } from '../ancestry';
import { familyMapAncestryById } from '../../../data/family-map';
import { legendaryPeople, legendaryChain, legendaryRelationships } from '../../../data/legendary-family';
import { biblicalPeople } from '../../../data/biblical-family';
import { sharedGraph, SHARED_CARD } from '../shared-graph';

describe('all known people and explicit unknown positions on one map', () => {
  it('preserves every family person and adds all biblical people as distinct identities', () => {
    expect(familyMapKnownCount).toBe(752);
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
  it('extends the research trail with explicitly provisional, sourced claims', () => {
    expect(candidatePeople).toHaveLength(67);
    expect(sharedById[HENRY_GOTHAM].parents).toEqual([]);
    expect(familyMapAncestryById[HENRY_GOTHAM].parents).toEqual([ANDREA_GOTHAM]);
    expect(ancestryAudit(ADAM,familyMapAncestryById).ids).toContain(ANDREA_GOTHAM);
    expect(mapEdgeAssessment(ANDREA_GOTHAM,HENRY_GOTHAM,'parent')).toMatchObject({confidence:'provisional',sourceKind:'compiled genealogy',evidenceUrl:'/family/#gotham-andrea-parent-candidate'});
    expect(mapProfileUrl(ANDREA_GOTHAM)).toBe(`/family/#${ANDREA_GOTHAM}`);
  });
  it('adds the Prather hypotheses without changing imported parentage or asserting a mother for Newman', () => {
    expect(sharedById[NEWMAN_PRATHER].parents).toEqual([]);
    expect(familyMapAncestryById[NEWMAN_PRATHER].parents).toEqual([JOSIAH_PRATHER]);
    expect(familyMapAncestryById[JOSIAH_PRATHER].parents).toEqual([JOHN_SMITH_PRATHER, ELIZABETH_NUTHALL]);
    expect(ancestryAudit(ADAM,familyMapAncestryById).ids).toEqual(expect.arrayContaining([JOSIAH_PRATHER,JOHN_SMITH_PRATHER,ELIZABETH_NUTHALL]));
    for (const [from,to] of [[JOSIAH_PRATHER,NEWMAN_PRATHER],[JOHN_SMITH_PRATHER,JOSIAH_PRATHER],[ELIZABETH_NUTHALL,JOSIAH_PRATHER]]) {
      expect(mapEdgeAssessment(from,to,'parent')).toMatchObject({confidence:'provisional',sourceKind:'compiled genealogy',evidenceUrl:'/family/#prather-josiah-parent-candidate'});
      expect(familyMapById[from].children).toContain(to);
    }
  });
  it('preserves source reviews on every earlier candidate edge and carries uncertainty through the English bridge', () => {
    for (const r of candidateRelationships) {
      expect(familyMapAncestryById[r.to].parents).toContain(r.from);
      expect(familyMapById[r.from].children).toContain(r.to);
      expect(mapEdgeAssessment(r.from,r.to,'parent')).toMatchObject({confidence:'provisional',sourceKind:'compiled genealogy',evidenceUrl:`/family/#${r.finding}`});
    }
    expect(mapEdgeAssessment(MARY_HYDE,JOHN_CROSS_MANOR,'parent').review).toContain('Disputed identity bridge');
    expect(familyMapAncestryById[MARY_HYDE].parents).toContain(ROBERT_HYDE);
    expect(ancestryAudit(ADAM,familyMapAncestryById).ids).toContain(ROBERT_HYDE);
  });
  it('traces the royal candidate route back to Tom while retaining its disputed bridges', () => {
    const audit=ancestryAudit(ADAM,familyMapAncestryById);
    const fullPath=audit.paths.find(p=>p.at(-1)===EGBERT)!;
    const path=fullPath.slice(0,fullPath.indexOf(EDWARD_I)+1);
    expect(path).toBeDefined();
    expect(path[0]).toBe(ADAM);
    expect(path).toEqual(expect.arrayContaining([NEWMAN_PRATHER, JOSIAH_PRATHER, JOHN_CROSS_MANOR, MARY_HYDE, ELIZABETH_RHUDDLAN]));
    expect(path).toHaveLength(29);
    for (let i=1;i<path.length;i++) expect(familyMapAncestryById[path[i-1]].parents).toContain(path[i]);
    expect(mapEdgeAssessment(MARY_HYDE,JOHN_CROSS_MANOR,'parent').confidence).toBe('provisional');
    expect(audit.ids).not.toContain('bible-adam');
  });
  it('keeps legend outside historical counts while providing a continuous sourced route to both Adam and Eve', () => {
    const historical=ancestryAudit(ADAM,familyMapAncestryById);
    const path=historical.paths.find(p=>p.at(-1)===EGBERT)!;
    expect(path).toHaveLength(44);
    expect(path).toEqual(expect.arrayContaining([ALFRED, ETHELWULF]));
    expect(familyMapAncestryById[EGBERT].parents).toEqual([]);
    for(const p of legendaryPeople) {
      expect(familyMapAncestryById[p.id]).toBeUndefined();
      expect(searchFamilyMap(p.name).some(hit=>hit.id===p.id)).toBe(true);
    }
    const bible=['bible-noah','bible-lamech','bible-methuselah','bible-enoch','bible-jared','bible-mahalaleel','bible-cainan','bible-enos','bible-seth'];
    const route=[...path,...legendaryChain.slice(1,-1),...bible];
    expect(new Set(route).size).toBe(route.length);
    for(let i=1;i<route.length;i++) expect(familyMapById[route[i-1]].parents).toContain(route[i]);
    expect(familyMapById[route.at(-1)!].parents).toEqual(['bible-adam','bible-eve']);
    for(const r of legendaryRelationships) expect(mapEdgeAssessment(r.from,r.to,'parent')).toMatchObject({confidence:'provisional',sourceKind:'legendary tradition',evidenceUrl:'/family/#chronicle-legendary-route'});
    expect(mapEdgeAssessment('mft-ac18e21f-8562-4540-a292-0014f7848951','mft-6e6822b7-100a-4225-8772-6f0893b9a5ad','parent')).toMatchObject({confidence:'provisional',evidenceUrl:'/family/#boyd-parent-date-conflict'});
    expect(mapEdgeAssessment('bible-noah','legend-sceaf','parent').review).toContain('Genesis does not give Noah a son named Sceaf');
    expect(historical.ids).not.toContain('bible-adam');
    expect(ancestryAudit().longest).toHaveLength(26);
  });
  it('includes the entire proposed route beyond 30 generations in All ancestors scope', () => {
    const graph=sharedGraph(ADAM,{ancestors:familyMapAncestorDepth,children:false,siblings:false,whole:false},familyMapById,mapEdgeAssessment);
    for(const id of [EGBERT,...legendaryChain,'bible-adam','bible-eve']) expect(graph.nodes.some(n=>n.id===id)).toBe(true);
    for(const r of legendaryRelationships) expect(graph.edges.find(e=>e.from===r.from && e.to===r.to)).toMatchObject({sourceKind:'legendary tradition',confidence:'provisional'});
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
  it('joins the whole map only through the explicitly labelled chronicle bridge', () => {
    const graph=sharedGraph(ADAM,{ancestors:30,children:true,siblings:true,whole:true},familyMapById,mapEdgeAssessment);
    expect(graph.nodes).toHaveLength(familyMapPeople.length);
    for (const edge of graph.edges) {
      const branch = (id:string):string => familyMapById[id].kind==='unknown' ? branch(familyMapById[id].child!) : familyMapById[id].kind === 'biblical' ? 'biblical' : 'modern';
      if(branch(edge.from)!==branch(edge.to)) expect(legendaryRelationships.some(r=>r.from===edge.from && r.to===edge.to)).toBe(true);
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
