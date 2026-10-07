import { describe, expect, it } from 'vitest';
import { people, relationships } from '../../../data/family';
import { buildGraph, DEFAULT_GRAPH, CARD, fitGraph, zoomAt, centerOn, directionalNode } from '../graph';

describe('family overview geometry and evidence', () => {
  it('starts with the central family and immediate parents, hiding earlier research', () => {
    const graph = buildGraph();
    expect(graph.nodes).toHaveLength(18);
    expect(graph.nodes.some(node => node.id === 'p014')).toBe(false);
    expect(graph.nodes.some(node => node.id === 'p010')).toBe(false);
    expect(graph.nodes.find(node => node.id === 'p022')!.y).toBeLessThan(graph.nodes.find(node => node.id === 'p001')!.y);
    expect(graph.nodes.find(node => node.id === 'p005')!.y).toBeGreaterThan(graph.nodes.find(node => node.id === 'p001')!.y);
  });
  it('expands earlier generations without silently showing provisional ancestors', () => {
    expect(buildGraph({ ...DEFAULT_GRAPH, earlier: true }).nodes).toHaveLength(22);
    const full = buildGraph({ ...DEFAULT_GRAPH, provisional: true });
    expect(new Set(full.nodes.map(node => node.id))).toEqual(new Set(people.filter(person => !['p030','p031','p032','p033','p034','p035','p036','p037'].includes(person.id)).map(person => person.id)));
  });
  it('does not leave orphan edges when branches are collapsed', () => {
    for (const parents of [true, false]) for (const children of [true, false]) {
      const graph = buildGraph({ ...DEFAULT_GRAPH, parents, children, provisional: true });
      const ids = new Set(graph.nodes.map(node => node.id));
      graph.edges.forEach(edge => {
        expect(ids.has(edge.relationship.from)).toBe(true);
        expect(ids.has(edge.relationship.to)).toBe(true);
      });
      if (!parents) expect(graph.nodes.some(node => node.generation < 0)).toBe(false);
      if (!children) { expect(graph.familyBus).toBeUndefined(); expect(graph.nodes.some(node => node.generation > 0)).toBe(false); }
    }
  });
  it('draws every visible parent/spouse relationship with its original confidence and source IDs', () => {
    const graph = buildGraph({ ...DEFAULT_GRAPH, provisional: true });
    expect(graph.edges.map(edge => edge.relationship)).toEqual(relationships.filter(r => r.kind !== 'sibling' && graph.nodes.some(n => n.id === r.from) && graph.nodes.some(n => n.id === r.to)));
    const fred = graph.edges.filter(edge => edge.relationship.to === 'p007');
    expect(fred.map(edge => edge.relationship.confidence)).toEqual(['probable', 'supported']);
    expect(fred[0].path).not.toEqual(fred[1].path);
    const nora = graph.edges.filter(edge => edge.relationship.to === 'p005');
    expect(nora[0].path).toEqual(nora[1].path);
  });
  it('never overlaps people or places a parent below its child', () => {
    const graph = buildGraph({ ...DEFAULT_GRAPH, provisional: true });
    for (const [index, node] of graph.nodes.entries()) for (const other of graph.nodes.slice(index + 1)) {
      const overlap = node.x < other.x + CARD.width && node.x + CARD.width > other.x && node.y < other.y + CARD.height && node.y + CARD.height > other.y;
      expect(overlap).toBe(false);
    }
    graph.edges.filter(edge => edge.relationship.kind === 'parent').forEach(edge => {
      expect(graph.nodes.find(node => node.id === edge.relationship.from)!.y + CARD.height).toBeLessThan(graph.nodes.find(node => node.id === edge.relationship.to)!.y);
    });
  });
});

describe('tree viewport navigation', () => {
  it('fits the entire visible tree inside desktop and mobile viewports', () => {
    const graph = buildGraph({ ...DEFAULT_GRAPH, provisional: true });
    for (const size of [{width: 1100, height: 700}, {width: 342, height: 440}]) {
      const view = fitGraph(size, graph);
      expect(view.x).toBeGreaterThanOrEqual(0);
      expect(view.y).toBeGreaterThanOrEqual(0);
      expect(view.x + graph.width * view.scale).toBeLessThanOrEqual(size.width);
      expect(view.y + graph.height * view.scale).toBeLessThanOrEqual(size.height);
    }
  });
  it('keeps the point under the cursor fixed when zooming, including at limits', () => {
    const view = { x: -120, y: 40, scale: .7 }, point = { x: 430, y: 280 };
    const world = { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
    for (const scale of [.01, 1.2, 10]) {
      const next = zoomAt(view, scale, point);
      expect(world.x * next.scale + next.x).toBeCloseTo(point.x);
      expect(world.y * next.scale + next.y).toBeCloseTo(point.y);
      expect(next.scale).toBeGreaterThanOrEqual(.15);
      expect(next.scale).toBeLessThanOrEqual(2);
    }
  });
  it('centers a selected person and supports directional keyboard navigation', () => {
    const graph = buildGraph(), node = graph.nodes.find(node => node.id === 'p001')!;
    const view = centerOn(node, { width: 342, height: 440 }, .8);
    expect((node.x + CARD.width / 2) * view.scale + view.x).toBeCloseTo(171);
    expect((node.y + CARD.height / 2) * view.scale + view.y).toBeCloseTo(220);
    expect(directionalNode(graph.nodes, 'p001', 'right')!.id).toBe('p002');
    expect(directionalNode(graph.nodes, 'p003', 'left')).toBeUndefined();
  });
  it('keeps both central people fully visible in the focused phone view', () => {
    const couple = buildGraph().nodes.filter(node => ['p001','p002'].includes(node.id));
    const size = { width: 340, height: 440 };
    const view = centerOn({ ...couple[0], x: (couple[0].x + couple[1].x) / 2 }, size, .7);
    for (const node of couple) {
      expect(node.x * view.scale + view.x).toBeGreaterThanOrEqual(0);
      expect((node.x + CARD.width) * view.scale + view.x).toBeLessThanOrEqual(size.width);
    }
  });
});
