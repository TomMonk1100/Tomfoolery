import { describe, expect, it } from 'vitest';
import { familyBranch, people, relationships, sources, searchPeople, type Branch } from '../../../data/family';

describe('family identity and evidence integrity', () => {
  it('resolves aliases to stable people, without duplicate search results', () => {
    expect(searchPeople('Paul Muncie').map(p => p.id)).toEqual(['p001']);
    expect(searchPeople('Palmicro Mangini').map(p => p.id)).toEqual(['p001']);
    expect(searchPeople('Emma Richards').map(p => p.id)).toEqual(['p002']);
    expect(searchPeople('Ricchuitta').map(p => p.id)).toEqual(['p002']);
    expect(searchPeople('Nicola', true).map(p => p.id)).toEqual(['p008', 'p014']);
    expect(searchPeople('  ')).toEqual([]);
  });
  it('keeps older provisional identities opt-in', () => {
    expect(searchPeople('Giovanni')).toEqual([]);
    expect(searchPeople('Giovanni', true).map(p => p.id)).toEqual(['p016']);
    expect(familyBranch.open).toBe(true);
  });
  it('has unique IDs and resolves every fact, relationship, and rendered branch', () => {
    const personIds = new Set(people.map(p => p.id));
    const sourceIds = new Set(sources.map(s => s.id));
    const relationIds = new Set(relationships.map(r => r.id));
    expect(personIds.size).toBe(people.length);
    expect(sourceIds.size).toBe(sources.length);
    expect(relationIds.size).toBe(relationships.length);
    for (const person of people) for (const fact of person.facts) {
      expect(fact.sources.length).toBeGreaterThan(0);
      fact.sources.forEach(id => expect(sourceIds.has(id)).toBe(true));
    }
    for (const relationship of relationships) {
      expect(personIds.has(relationship.from)).toBe(true);
      expect(personIds.has(relationship.to)).toBe(true);
      expect(relationship.from).not.toBe(relationship.to);
      expect(relationship.sources.length).toBeGreaterThan(0);
      relationship.sources.forEach(id => expect(sourceIds.has(id)).toBe(true));
    }
    const rendered = new Set<string>();
    function walk(branch: Branch, gated = false) {
      const hidden = gated || !!branch.provisional;
      for (const id of branch.people) {
        expect(personIds.has(id)).toBe(true);
        expect(rendered.has(id)).toBe(false);
        rendered.add(id);
        if (people.find(p => p.id === id)!.provisional) expect(hidden).toBe(true);
      }
      branch.relations?.forEach(id => expect(relationIds.has(id)).toBe(true));
      branch.children?.forEach(child => walk(child, hidden));
    }
    walk(familyBranch);
    expect(rendered).toEqual(new Set(people.filter(p => !['p030','p031','p032','p033','p034','p035','p036','p037'].includes(p.id)).map(p => p.id)));
    // The separate Leslie candidates remain in the full map and profile ledger.
    for (const id of ['p030','p031','p032','p033','p034','p035','p036','p037']) expect(personIds.has(id)).toBe(true);
  });
  it('does not promote missing ancestry or inferred dates into supported facts', () => {
    const namedParents = relationships.filter(r => r.kind === 'parent' && r.to === 'p001');
    expect(namedParents.map(r => r.from)).toEqual(['p022', 'p023']);
    expect(namedParents.every(r => r.sources.includes('palmiero-certificate'))).toBe(true);
    expect(relationships.filter(r => r.kind === 'parent' && ['p022', 'p023'].includes(r.to))).toEqual([]);
    const emmaParents = relationships.filter(r => r.kind === 'parent' && r.to === 'p002');
    expect(emmaParents.map(r => r.from)).toEqual(['p008', 'p009']);
    expect(emmaParents.every(r => r.confidence === 'probable' && r.sources.includes('emma-certificate'))).toBe(true);
    expect(relationships.find(r => r.from === 'p002' && r.to === 'p007')).toMatchObject({confidence: 'supported', sources: ['emma-census-1940']});
    expect(relationships.find(r => r.from === 'p001' && r.to === 'p007')).toMatchObject({confidence:'probable',sources:['fred-mae-marriage-1938','palmiero-county-certificate']});
    expect(people.find(p => p.id === 'p001')!.facts.find(f => f.label === 'Date hypothesis')!.confidence).toBe('provisional');
    expect(people.find(p => p.id === 'p001')!.facts.find(f => f.label === 'Birthplace lead')!.confidence).toBe('provisional');
    expect(sources.find(s => s.id === 'palmiero-certificate')).toMatchObject({kind: 'original record', inspected: true});
  });
});
