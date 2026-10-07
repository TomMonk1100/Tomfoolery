import type { APIRoute } from 'astro';
import { familyPanelData } from '../../../data/family-person-panel';
export function getStaticPaths() {
  return Object.entries(familyPanelData).map(([id,panel])=>({params:{id},props:{panel}}));
}
// These files live under the same password-protected /family/ gate as the tree.
export const GET: APIRoute = ({props}) => new Response(JSON.stringify(props.panel), {
  headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'},
});
