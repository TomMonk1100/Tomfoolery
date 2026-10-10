import {describe,it,expect} from 'vitest';
import {generationReview,sixGenerationBranches,upbringingBridge} from '../generation-review';
import {ADAM,PATRICK,FRED_RICHARD,sharedById,type SharedPerson} from '../../../data/shared-family';
const person=(id:string,parents:string[]):SharedPerson=>({id,parents,name:id,uuid:id,dates:'',aliases:[],partners:[],children:[],gender:''});
describe('six-generation connection evidence checklist',()=>{
  it('includes maternal ancestry and generation six without assuming imported names are proof',()=>{
    const rows=generationReview();
    expect(rows.some(r=>r.child===ADAM&&r.parent==='mft-977e3680-c40d-4c6c-aade-3562855e3e99')).toBe(true);
    expect(rows.some(r=>r.generation===6)).toBe(true);
    expect(rows.every(r=>r.generation<=6)).toBe(true);
    expect(rows.find(r=>r.child===PATRICK&&r.parent===FRED_RICHARD)).toBeUndefined();
    expect(rows.find(r=>r.child===ADAM&&r.parent===PATRICK)?.status).toBe('supported');
    expect(sixGenerationBranches[1].rows.every(r=>r.generation>=3)).toBe(true);
    expect(upbringingBridge.kind).toBe('raised');
    const eugeneParents=rows.filter(r=>r.child==='mft-45146b40-d146-4f78-8e21-0500f316cb5d'&&r.parent);
    expect(eugeneParents).toHaveLength(2);
    expect(eugeneParents.every(r=>r.status==='probable'&&r.citation==='/family/#eugene-leslie-marriage-parents-1943')).toBe(true);
    expect(sharedById[PATRICK].parents).not.toContain(FRED_RICHARD);
    const maternalLinks=rows.filter(r=>['mft-e238c8e7-0773-4a8b-a850-9c705c1699f3','mft-df1cc011-4357-42cc-ad5f-26c8d2a20658'].includes(r.child)&&r.parent);
    expect(maternalLinks).toHaveLength(4);
    expect(maternalLinks.every(r=>r.status==='supported'&&r.citation)).toBe(true);
    expect(rows.find(r=>r.child==='mft-977e3680-c40d-4c6c-aade-3562855e3e99')?.status).toBe('supported');
    const crookLinks=rows.filter(r=>r.child==='mft-5141f558-0dac-4850-9878-246f3c464bff'&&r.parent);
    expect(crookLinks).toHaveLength(2);
    expect(crookLinks.every(r=>r.generation===3&&r.status==='supported'&&r.citation==='/family/#tom-crook-parent-testimony')).toBe(true);
    for(const id of ['p040','p041']) {
      expect(rows.find(r=>r.parent===id)).toMatchObject({generation:5,status:'supported',citation:'/family/#william-louise-marriage-parents-1890'});
      expect(rows.filter(r=>r.child===id)).toHaveLength(2);
      expect(rows.filter(r=>r.child===id).every(r=>r.generation===6&&r.status==='unknown')).toBe(true);
    }
  });
  it('keeps indexed generation-six leads distinct from supported parent connections',()=>{
    const rows=generationReview();
    expect(rows.find(r=>r.parent==='p038')).toMatchObject({generation:5,status:'supported'});
    for(const id of ['p042','p043']) expect(rows.find(r=>r.parent===id)).toMatchObject({generation:6,status:'probable',citation:'/family/#abel-reagles-death-parents-1906'});
  });
  it('supports Priscilla’s parents after independent printed-history corroboration',()=>{
    const rows=generationReview();
    expect(rows.find(r=>r.parent==='p039')).toMatchObject({generation:5,status:'supported'});
    for(const id of ['p044','p045']) expect(rows.find(r=>r.parent===id)).toMatchObject({generation:6,status:'supported',citation:'/family/#priscilla-sippy-biography-1884'});
  });
  it('keeps the new Chappell household parents probable and their generation-six parents unknown',()=>{
    const rows=generationReview();
    for(const id of ['p046','p047']) {
      expect(rows.find(r=>r.parent===id)).toMatchObject({generation:5,status:'probable',citation:'/family/#james-chappell-childhood-1900'});
      const gaps=rows.filter(r=>r.child===id);
      expect(gaps).toHaveLength(2);
      expect(gaps.every(r=>r.generation===6&&r.status==='unknown'&&!r.parent)).toBe(true);
    }
  });
  it('includes Leila’s independently corroborated parents at G5 and their unknown parents at G6',()=>{
    const rows=generationReview();
    for(const id of ['p048','p049']) {
      expect(rows.find(r=>r.parent===id)).toMatchObject({generation:5,status:'supported',citation:'/family/#leila-prideaux-birth-parents-1894'});
      const gaps=rows.filter(r=>r.child===id);
      expect(gaps).toHaveLength(2);
      expect(gaps.every(r=>r.generation===6&&r.status==='unknown'&&!r.parent)).toBe(true);
    }
  });
  it('preserves repeated positions and stops unknown and cyclic branches',()=>{
    const tree={a:person('a',['b','c']),b:person('b',['d']),c:person('c',['d']),d:person('d',['a'])};
    const rows=generationReview('a',0,6,tree);
    expect(rows.filter(r=>r.parent==='d')).toHaveLength(2);
    expect(rows.filter(r=>r.note.startsWith('Cyclic'))).toHaveLength(2);
    expect(rows.some(r=>r.status==='unknown')).toBe(true);
    expect(rows.every(r=>r.status!=='supported')).toBe(true);
    expect(generationReview('missing',0,6,tree)).toEqual([]);
  });
});
