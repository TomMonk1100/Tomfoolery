import { describe, it, expect } from 'vitest';
import { constrainSharedViewport, zoomSharedViewport, sharedCardVisible, sharedWheelPixels } from '../shared-viewport';
import { recentGenerations, stockwellReview, muncieReview, importedSourceInventory } from '../../../data/recent-family-review';
import { upbringing } from '../../../data/close-family-evidence';
import { PATRICK, FRED_RICHARD } from '../../../data/shared-family';
import { mapEdgeAssessment } from '../../../data/family-map';
describe('large tree viewport',()=>{
  it('keeps the same world point under the zoom anchor',()=>{
    const view={x:-12000,y:-3000,scale:.2},anchor={x:450,y:300};
    const next=zoomSharedViewport(view,.65,anchor);
    expect((anchor.x-next.x)/next.scale).toBeCloseTo((anchor.x-view.x)/view.scale);
    expect((anchor.y-next.y)/next.scale).toBeCloseTo((anchor.y-view.y)/view.scale);
  });
  it('culls distant cards without losing cards overlapping the viewport',()=>{
    const view={x:-20000,y:-4000,scale:.65},size={width:1100,height:600};
    expect(sharedCardVisible({x:0,y:0},view,size)).toBe(false);
    expect(sharedCardVisible({x:20000/.65,y:4000/.65},view,size)).toBe(true);
    expect(sharedCardVisible({x:19000/.65,y:4000/.65},view,size)).toBe(false);
  });
  it('retains a recoverable part of the tree after excessive panning',()=>{
    const size={width:1000,height:600},graph={width:100000,height:50000};
    expect(constrainSharedViewport({x:-1e9,y:1e9,scale:1},size,graph)).toEqual({x:48-100000,y:600-48,scale:1});
    expect(constrainSharedViewport({x:999,y:-999,scale:.001},size,graph)).toEqual({x:450,y:275,scale:.001});
  });
  it('normalizes line and page wheels and bounds extreme deltas',()=>{
    expect(sharedWheelPixels({deltaX:2,deltaY:3,deltaMode:1},500)).toEqual({x:32,y:48});
    expect(sharedWheelPixels({deltaX:0,deltaY:1,deltaMode:2},500)).toEqual({x:0,y:500});
    expect(sharedWheelPixels({deltaX:-9000,deltaY:9000,deltaMode:0},500)).toEqual({x:-600,y:600});
  });
});
describe('six generations review',()=>{
  it('includes the sixth generation and stops before the seventh',()=>{
    expect(stockwellReview.some(r=>r.generation===6)).toBe(true);
    expect(stockwellReview.filter(r=>r.generation===5)).toHaveLength(16);
    expect(recentGenerations(PATRICK,7)).toEqual([]);
    expect(muncieReview.length).toBeGreaterThanOrEqual(15);
    expect(muncieReview.filter(r=>r.generation===5)).toHaveLength(8);
    expect(muncieReview.every(r=>r.generation>=2&&r.generation<=6)).toBe(true);
  });
  it('keeps upbringing distinct from biological descent',()=>{
    expect(upbringing.child).toBe(PATRICK);expect(upbringing.raisedBy).toBe(FRED_RICHARD);
    expect(stockwellReview.some(r=>r.id===FRED_RICHARD)).toBe(false);
    expect(muncieReview[0]).toEqual({id:FRED_RICHARD,generation:2});
    expect(mapEdgeAssessment(upbringing.biologicalFather,PATRICK,'parent')).toMatchObject({confidence:'supported',sourceKind:'user supplied'});
  });
  it('flags the impossible Brown parent link without inventing a replacement',()=>{
    expect(mapEdgeAssessment('mft-e562d673-0941-4d90-82d4-c747c5db6db3','mft-1987620c-0044-4f35-9a91-1f3087279c84','parent')).toMatchObject({confidence:'provisional',review:'brown-original-parent-conflict'});
    expect(importedSourceInventory('mft-e562d673-0941-4d90-82d4-c747c5db6db3').collections).toHaveLength(1);
  });
});
