import { personById, relationships, type Relationship } from '../../data/family';

export const CARD = { width: 208, height: 96 };
export interface GraphOptions { parents: boolean; children: boolean; earlier: boolean; provisional: boolean }
export const DEFAULT_GRAPH: GraphOptions = { parents: true, children: true, earlier: false, provisional: false };
export interface GraphNode { id: string; x: number; y: number; generation: number }
export interface GraphEdge { relationship: Relationship; path: string }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[]; familyBus?: string; width: number; height: number; generations: { label: string; y: number }[] }
export interface Viewport { x: number; y: number; scale: number }
export interface Size { width: number; height: number }

// Presentation coordinates only: all connections come from the evidence ledger.
// Empty spaces deliberately preserve unknown ancestors rather than inventing nodes.
const positions: Record<string, [number, number]> = {
  p018: [0, -5], p019: [240, -5],
  p016: [0, -4], p017: [240, -4], p020: [480, -4], p021: [720, -4],
  p014: [120, -3], p015: [600, -3],
  p010: [360, -2], p011: [600, -2], p012: [840, -2], p013: [1080, -2],
  p022: [120, -1], p023: [360, -1], p008: [600, -1], p009: [840, -1],
  p001: [360, 0], p002: [600, 0],
  p003: [0, 1], p004: [240, 1], p005: [480, 1], p006: [720, 1], p007: [960, 1],
};
const generationLabel = (generation: number) => generation === 1 ? 'Children & family leads' : generation === 0 ? 'Palmiero & Emma' : generation === -1 ? 'Reported / probable parents' : generation === -2 ? 'Earlier parents · transcription' : 'Older ancestry · provisional';

export function buildGraph(options: GraphOptions = DEFAULT_GRAPH): Graph {
  const visible = Object.entries(positions).filter(([id, [, generation]]) => {
    if (generation === 0) return true;
    if (generation === 1) return options.children;
    if (!options.parents) return false;
    if (generation === -1) return true;
    if (generation === -2) return options.earlier || options.provisional;
    return options.provisional && !!personById[id].provisional;
  }).sort((a, b) => a[1][1] - b[1][1] || a[1][0] - b[1][0]);
  const firstGeneration = Math.min(...visible.map(([, [, generation]]) => generation));
  const nodes = visible.map(([id, [x, generation]]) => ({ id, x: x + 40, y: 54 + (generation - firstGeneration) * 160, generation }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  // Sibling evidence is available in profiles; drawing it as another parent line
  // would incorrectly imply shared parentage for every candidate child.
  const visibleRelations = relationships.filter(r => r.kind !== 'sibling' && byId.has(r.from) && byId.has(r.to));
  const parentRows = new Map<number, Relationship[]>();
  for (const r of visibleRelations.filter(r => r.kind === 'parent')) {
    const row = byId.get(r.from)!.generation;
    parentRows.set(row, [...(parentRows.get(row) ?? []), r]);
  }
  const edges = visibleRelations.map(relationship => {
    const from = byId.get(relationship.from)!;
    const to = byId.get(relationship.to)!;
    if (relationship.kind === 'spouse') {
      return { relationship, path: `M ${from.x + CARD.width} ${from.y + CARD.height / 2} H ${to.x}` };
    }
    const siblings = parentRows.get(from.generation)!;
    const lane = siblings.findIndex(r => r.id === relationship.id);
    const outgoing = visibleRelations.filter(r => r.kind === 'parent' && r.from === relationship.from);
    const incoming = visibleRelations.filter(r => r.kind === 'parent' && r.to === relationship.to);
    const sx = from.x + CARD.width / 2 + (outgoing.indexOf(relationship) - (outgoing.length - 1) / 2) * 7;
    const tx = to.x + CARD.width / 2 + (incoming.indexOf(relationship) - (incoming.length - 1) / 2) * 14;
    const sy = from.y + CARD.height;
    if (from.generation === 0 && to.generation === 1) {
      // A neutral family rail avoids ten overlapping routes across the overview.
      // Each child's stems retain BOTH source relationships and their confidence.
      // Matching evidence shares a stem; differing evidence (Fred) stays parallel.
      const mixed = incoming.some(r => r.confidence !== relationship.confidence);
      const childX = to.x + CARD.width / 2 + (mixed ? (incoming.indexOf(relationship) - .5) * 14 : 0);
      return { relationship, path: `M ${childX} ${sy + 32} V ${to.y}` };
    }
    const middle = sy + 18 + lane * (to.y - sy - 36) / Math.max(1, siblings.length - 1);
    return { relationship, path: `M ${sx} ${sy} V ${middle} H ${tx} V ${to.y}` };
  });
  const children = nodes.filter(node => node.generation === 1);
  const palmiero = byId.get('p001')!, emma = byId.get('p002')!;
  const familyX = (palmiero.x + CARD.width + emma.x) / 2;
  const railY = palmiero.y + CARD.height + 32;
  return {
    nodes, edges,
    familyBus: children.length ? `M ${familyX} ${palmiero.y + CARD.height / 2} V ${railY} M ${children[0].x + CARD.width / 2} ${railY} H ${children.at(-1)!.x + CARD.width / 2 + 7}` : undefined,
    width: Math.max(...nodes.map(node => node.x + CARD.width)) + 40,
    height: Math.max(...nodes.map(node => node.y + CARD.height)) + 40,
    generations: [...new Set(nodes.map(node => node.generation))].map(generation => ({ label: generationLabel(generation), y: (generation === 1 ? 12 : 28) + (generation - firstGeneration) * 160 })),
  };
}

export const clampScale = (scale: number) => Math.max(.15, Math.min(2, scale));
export function fitGraph(size: Size, graph: Size, padding = 28): Viewport {
  const scale = Math.min(1, clampScale(Math.min((size.width - padding * 2) / graph.width, (size.height - padding * 2) / graph.height)));
  return { scale, x: (size.width - graph.width * scale) / 2, y: (size.height - graph.height * scale) / 2 };
}
export function zoomAt(view: Viewport, scale: number, point: {x: number; y: number}): Viewport {
  const next = clampScale(scale);
  return { scale: next, x: point.x - (point.x - view.x) / view.scale * next, y: point.y - (point.y - view.y) / view.scale * next };
}
export function centerOn(node: GraphNode, size: Size, scale: number): Viewport {
  const next = clampScale(scale);
  return { scale: next, x: size.width / 2 - (node.x + CARD.width / 2) * next, y: size.height / 2 - (node.y + CARD.height / 2) * next };
}
export function directionalNode(nodes: GraphNode[], current: string, direction: 'left' | 'right' | 'up' | 'down'): GraphNode | undefined {
  const origin = nodes.find(node => node.id === current);
  if (!origin) return;
  return nodes.filter(node => node.id !== current).map(node => {
    const dx = node.x - origin.x, dy = node.y - origin.y;
    const forward = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    const sideways = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    return { node, forward, score: forward + sideways * 4 };
  }).filter(item => item.forward > 0).sort((a, b) => a.score - b.score)[0]?.node;
}

export function treeLabel(id: string) {
  return ({ p002: 'Emma Muncie', p003: 'Mary Muncie', p004: 'Victor Muncie', p005: 'Nora Muncie', p006: 'Albert Muncie', p007: 'Fred Muncie' } as Record<string, string>)[id] ?? personById[id].name;
}
export function treeAlias(id: string) {
  return id === 'p001' ? 'Paul Muncie' : id === 'p002' ? 'Emida Ricchuitta' : id === 'p009' ? 'Dominica Mastrocco' : '';
}
