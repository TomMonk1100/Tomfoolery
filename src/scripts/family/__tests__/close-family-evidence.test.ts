import { describe, expect, it } from 'vitest';
import { familyMapAncestryById, mapEdgeAssessment } from '../../../data/family-map';
import { sharedById, MARK } from '../../../data/shared-family';
import { closeFamilyRelationships } from '../../../data/close-family-evidence';
import { ancestryFindings } from '../../../data/ancestry-research';
import { recentEvidenceAssessment } from '../../../data/recent-family-review';

const DOROTHY='mft-ee6ed11d-2031-451f-823a-5362114e84a6';
const EUGENE='mft-45146b40-d146-4f78-8e21-0500f316cb5d';
const CURTIS='mft-6ee470e8-d907-4ed6-ad3b-b9847730c160';
const LUELLA='mft-b83d2726-4a9f-4e9f-bceb-e4e0e98ed168';
const INEZ='mft-1bc0d47f-abff-45be-a21c-1ba082f928cf';
const WILLIAM_BEELER='mft-dfb0638d-604b-4212-8073-5c69dce4949c';

describe('close-family record evidence and identity conflicts',()=>{
  it('adds the indexed marriage symmetrically without treating it as paternity proof or altering the import',()=>{
    expect(sharedById[DOROTHY].partners).not.toContain(EUGENE);
    expect(familyMapAncestryById[DOROTHY].partners).toContain(EUGENE);
    expect(familyMapAncestryById[EUGENE].partners).toContain(DOROTHY);
    expect(mapEdgeAssessment(EUGENE,DOROTHY,'partner')).toMatchObject({confidence:'probable',sourceKind:'official index',evidenceUrl:'/family/#dorothy-eugene-marriage-1940'});
    expect(mapEdgeAssessment(DOROTHY,EUGENE,'partner')).toEqual(mapEdgeAssessment(EUGENE,DOROTHY,'partner'));
    expect(mapEdgeAssessment(EUGENE,MARK,'parent')).toMatchObject({confidence:'provisional',evidenceUrl:'/family/#mark-stockwell-household-1950'});
    expect(familyMapAncestryById[MARK].parents).toEqual(sharedById[MARK].parents);
  });
  it('preserves imported parents while showing the marriage name conflicts on their edges',()=>{
    for(const [parent,child] of [[LUELLA,CURTIS],[WILLIAM_BEELER,INEZ]]) {
      expect(familyMapAncestryById[child].parents).toEqual(sharedById[child].parents);
      expect(mapEdgeAssessment(parent,child,'parent')).toMatchObject({confidence:'provisional',evidenceUrl:'/family/#curtis-inez-marriage-1916'});
    }
    expect(ancestryFindings.find(f=>f.id==='curtis-inez-marriage-1916')?.limit).toContain('no person is merged or replaced');
  });
  it('links inspected claims to findings that name both people, with no broken audit references',()=>{
    for(const r of closeFamilyRelationships) {
      const f=ancestryFindings.find(f=>f.id===r.finding);
      expect(f?.people).toEqual(expect.arrayContaining([r.from,r.to]));
      expect(f?.url).toMatch(/^https:\/\/www\.familysearch\.org\//);
    }
    expect(recentEvidenceAssessment(CURTIS).findings.map(f=>f.id)).toContain('curtis-inez-marriage-1916');
    expect(recentEvidenceAssessment(LUELLA).note).toContain('Martha Collins');
    expect(recentEvidenceAssessment(DOROTHY).note).toContain('1917 / 1919');
  });
});
