import type { Viewport } from './graph';
import { SHARED_CARD, sharedScale } from './shared-graph';
export type Size = {width:number;height:number};
export function zoomSharedViewport(view:Viewport,scale:number,point:{x:number;y:number}):Viewport {
  const next=sharedScale(scale);
  return {scale:next,x:point.x-(point.x-view.x)/view.scale*next,y:point.y-(point.y-view.y)/view.scale*next};
}
export function constrainSharedViewport(view:Viewport,size:Size,graph:Size):Viewport {
  const extent=(position:number,viewport:number,world:number)=>world<=viewport? (viewport-world)/2 : Math.max(48-world,Math.min(viewport-48,position));
  return {...view,x:extent(view.x,size.width,graph.width*view.scale),y:extent(view.y,size.height,graph.height*view.scale)};
}
export function sharedCardVisible(node:{x:number;y:number},view:Viewport,size:Size,margin=120) {
  const x=view.x+node.x*view.scale,y=view.y+node.y*view.scale;
  return x+SHARED_CARD.width*view.scale>=-margin && x<=size.width+margin && y+SHARED_CARD.height*view.scale>=-margin && y<=size.height+margin;
}
export function sharedWheelPixels(delta:{deltaX:number;deltaY:number;deltaMode:number},height:number) {
  const unit=delta.deltaMode===1?16:delta.deltaMode===2?height:1;
  return {x:Math.max(-600,Math.min(600,delta.deltaX*unit)),y:Math.max(-600,Math.min(600,delta.deltaY*unit))};
}
