import { personById, searchPeople } from '../data/family';
import { buildGraph, DEFAULT_GRAPH, fitGraph, zoomAt, centerOn, clampScale, directionalNode, type Viewport, type GraphOptions } from './family/graph';

function initFamilyTree() {
  const found = document.querySelector<HTMLElement>('[data-family-root]');
  if (!found || found.dataset.initialized) return;
  const root = found;
  root.dataset.initialized = 'true';
  const controller = new AbortController();
  const signal = controller.signal;
  const explorer = root.querySelector<HTMLElement>('[data-family-explorer]')!;
  const stage = root.querySelector<HTMLElement>('[data-map-stage]')!;
  const world = root.querySelector<HTMLElement>('[data-map-world]')!;
  const lines = root.querySelector<SVGSVGElement>('[data-map-lines]')!;
  const labels = root.querySelector<HTMLElement>('[data-generation-labels]')!;
  const search = root.querySelector<HTMLInputElement>('#family-search')!;
  const results = root.querySelector<HTMLUListElement>('#family-results')!;
  const popup = root.querySelector<HTMLElement>('[data-search-popup]')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const output = root.querySelector<HTMLOutputElement>('[data-zoom]')!;
  const toggles = {
    parents: root.querySelector<HTMLInputElement>('[data-show-parents]')!,
    children: root.querySelector<HTMLInputElement>('[data-show-children]')!,
    earlier: root.querySelector<HTMLInputElement>('[data-show-earlier]')!,
    provisional: root.querySelector<HTMLInputElement>('[data-show-provisional]')!,
  };
  const nodeElements = new Map(Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-map-person]')).map(element => [element.dataset.mapPerson!, element]));
  const profiles = Array.from(root.querySelectorAll<HTMLElement>('[data-profile]'));
  const profileSection = root.querySelector<HTMLElement>('#family-profiles')!;
  // Native modal focus handling, with ordinary HTML profiles when JS is unavailable.
  const dialog = document.createElement('dialog');
  dialog.className = 'family-dialog';
  dialog.setAttribute('aria-label', 'Person details');
  explorer.append(dialog); dialog.append(profileSection);
  const mapPosition = document.createComment('family map position');
  explorer.before(mapPosition);
  const fullscreenHost = document.createElement('dialog');
  fullscreenHost.className = 'family-fullscreen-host';
  fullscreenHost.setAttribute('aria-label', 'Full screen family tree');
  root.append(fullscreenHost);
  root.querySelectorAll<HTMLElement>('[data-family-controls], [data-close-profile], [data-locate-person]').forEach(element => element.hidden = false);
  root.classList.add('family-enhanced');
  let graph = buildGraph();
  let selected: string | undefined;
  let view: Viewport = { x: 0, y: 0, scale: 1 };
  let fitted = true;
  let suppressClickUntil = 0;
  const size = () => ({ width: stage.clientWidth, height: stage.clientHeight });
  const options = (): GraphOptions => Object.fromEntries(Object.entries(toggles).map(([key, input]) => [key, input.checked])) as unknown as GraphOptions;

  function paintView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    output.value = `${Math.round(view.scale * 100)}%`;
    root.querySelector<HTMLButtonElement>('[data-zoom-out]')!.disabled = view.scale <= .15;
    root.querySelector<HTMLButtonElement>('[data-zoom-in]')!.disabled = view.scale >= 2;
  }
  function fit() { fitted = true; view = fitGraph(size(), graph); paintView(); }
  function focusNode(id: string, scale = Math.max(.8, view.scale)) {
    const node = graph.nodes.find(node => node.id === id);
    if (!node) return;
    fitted = false; view = centerOn(node, size(), scale); paintView();
  }
  function familyView() {
    const couple = graph.nodes.filter(node => node.generation === 0);
    const center = { ...couple[0], x: (couple[0].x + couple[1].x) / 2 };
    fitted = false;
    view = centerOn(center, size(), size().width < 600 ? .7 : 1);
    paintView();
  }
  function highlightSelection() {
    for (const [id, element] of nodeElements) {
      if (id === selected) element.setAttribute('aria-current', 'true');
      else element.removeAttribute('aria-current');
    }
    lines.querySelectorAll<SVGPathElement>('path').forEach(path => {
      const edge = graph.edges.find(item => item.relationship.id === path.dataset.edge);
      path.classList.toggle('family-edge-selected', !!selected && (edge?.relationship.from === selected || edge?.relationship.to === selected));
    });
  }
  function renderGraph(refit = true) {
    graph = buildGraph(options());
    world.style.width = `${graph.width}px`; world.style.height = `${graph.height}px`;
    lines.setAttribute('width', String(graph.width)); lines.setAttribute('height', String(graph.height));
    lines.replaceChildren(...graph.edges.map(edge => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', edge.path); path.dataset.confidence = edge.relationship.confidence; path.dataset.edge = edge.relationship.id;
      return path;
    }));
    if (graph.familyBus) {
      const rail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rail.setAttribute('d', graph.familyBus); rail.setAttribute('class', 'family-rail'); lines.prepend(rail);
    }
    labels.replaceChildren(...graph.generations.map(generation => {
      const label = document.createElement('span'); label.textContent = generation.label; label.style.top = `${generation.y - 14}px`; return label;
    }));
    for (const [id, element] of nodeElements) {
      const node = graph.nodes.find(node => node.id === id);
      element.hidden = !node;
      if (node) { element.style.left = `${node.x}px`; element.style.top = `${node.y}px`; }
    }
    root.querySelector<HTMLElement>('[data-map-count]')!.textContent = `${graph.nodes.length} people in view`;
    root.querySelector<HTMLDetailsElement>('[data-provisional-branch]')!.hidden = !toggles.provisional.checked;
    highlightSelection(); showResults();
    if (refit) fit();
  }
  function revealPerson(id: string) {
    const researchTree = root.querySelector<HTMLDetailsElement>('.shared-research-tree');
    if (researchTree) researchTree.open = true;
    const person = personById[id];
    if (!person) return false;
    if (person.provisional) { toggles.parents.checked = true; toggles.earlier.checked = true; toggles.provisional.checked = true; }
    else if (['p010', 'p011', 'p012', 'p013'].includes(id)) { toggles.parents.checked = true; toggles.earlier.checked = true; }
    else if (['p022', 'p023', 'p008', 'p009'].includes(id)) toggles.parents.checked = true;
    else if (!['p001', 'p002'].includes(id)) toggles.children.checked = true;
    renderGraph(!graph.nodes.some(node => node.id === id));
    return true;
  }
  function selectPerson(id: string, updateHash = true) {
    if (!revealPerson(id)) return false;
    selected = id; highlightSelection();
    profiles.forEach(profile => { profile.hidden = profile.dataset.profile !== id; });
    popup.hidden = true;
    if (updateHash && location.hash !== `#person-${id}`) history.pushState(null, '', `#person-${id}`);
    dialog.setAttribute('aria-label', `${personById[id].name} — person details`);
    if (!dialog.open) dialog.showModal();
    profileSection.scrollTop = 0;
    profiles.find(profile => profile.dataset.profile === id)!.querySelector<HTMLElement>('h3')!.focus({ preventScroll: true });
    return true;
  }
  function closeProfile() { if (dialog.open) dialog.close(); }
  function showResults() {
    const query = search.value.trim(); results.replaceChildren(); status.textContent = ''; popup.hidden = !query;
    if (!query) return;
    const matches = searchPeople(query, toggles.provisional.checked);
    status.textContent = `${matches.length} ${matches.length === 1 ? 'person' : 'people'} found${toggles.provisional.checked ? '' : ' · older provisional people excluded'}`;
    for (const person of matches) {
      const item = document.createElement('li'), link = document.createElement('a');
      link.href = `#person-${person.id}`; link.dataset.personLink = person.id; link.textContent = `${person.name} · ${person.dates}`;
      item.append(link); results.append(item);
    }
  }
  function readHash() {
    if (location.hash.startsWith('#person-')) selectPerson(location.hash.slice(8), false);
    else {
      const target = document.getElementById(location.hash.slice(1));
      if (target?.closest('.family-sources')) {
        root.querySelector<HTMLDetailsElement>('.family-sources')!.open = true;
        target.scrollIntoView({ block: 'start' });
      }
    }
  }

  root.addEventListener('click', async event => {
    if (!(event.target instanceof Element) || !(event instanceof MouseEvent)) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest<HTMLAnchorElement>('a');
    if (link?.matches('[data-person-link]')) {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
      if (selectPerson(link.dataset.personLink!)) event.preventDefault();
    } else if (link?.getAttribute('href')?.startsWith('#source-')) {
      event.preventDefault(); closeProfile();
      setExpanded(false);
      const id = link.getAttribute('href')!.slice(1);
      root.querySelector<HTMLDetailsElement>('.family-sources')!.open = true;
      const target = document.getElementById(id)!;
      history.pushState(null, '', `#${id}`); target.scrollIntoView({ block: 'start' });
      target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
    } else if (link?.matches('.family-back')) {
      event.preventDefault(); closeProfile(); stage.focus({ preventScroll: true });
    }
  }, { signal });
  search.addEventListener('input', showResults, { signal });
  search.addEventListener('focus', showResults, { signal });
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector<HTMLAnchorElement>('a')?.focus(); }
    if (event.key === 'Escape') popup.hidden = true;
  }, { signal });
  document.addEventListener('click', event => { if (event.target instanceof Node && !root.querySelector('.family-search-wrap')!.contains(event.target)) popup.hidden = true; }, { signal });
  for (const [key, input] of Object.entries(toggles)) input.addEventListener('change', () => {
    if (key === 'parents' && !input.checked) { toggles.earlier.checked = false; toggles.provisional.checked = false; }
    if (key === 'earlier') { if (input.checked) toggles.parents.checked = true; else toggles.provisional.checked = false; }
    if (key === 'provisional' && input.checked) { toggles.parents.checked = true; toggles.earlier.checked = true; }
    renderGraph();
  }, { signal });
  root.querySelector('[data-fit]')!.addEventListener('click', fit, { signal });
  root.querySelector('[data-center]')!.addEventListener('click', familyView, { signal });
  root.querySelector('[data-close-profile]')!.addEventListener('click', closeProfile, { signal });
  root.querySelector('[data-locate-person]')!.addEventListener('click', () => {
    closeProfile(); if (selected) { focusNode(selected); nodeElements.get(selected)?.focus({ preventScroll: true }); }
  }, { signal });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeProfile(); }, { signal });
  const zoom = (factor: number) => { fitted = false; const area = size(); view = zoomAt(view, view.scale * factor, { x: area.width / 2, y: area.height / 2 }); paintView(); };
  root.querySelector('[data-zoom-in]')!.addEventListener('click', () => zoom(1.25), { signal });
  root.querySelector('[data-zoom-out]')!.addEventListener('click', () => zoom(1 / 1.25), { signal });
  root.querySelector('[data-family-reset]')!.addEventListener('click', () => {
    closeProfile(); selected = undefined; search.value = '';
    for (const [key, input] of Object.entries(toggles)) input.checked = DEFAULT_GRAPH[key as keyof GraphOptions];
    history.replaceState(null, '', location.pathname + location.search); renderGraph();
    if (size().width < 600) familyView();
  }, { signal });
  const fullscreenButton = root.querySelector<HTMLButtonElement>('[data-fullscreen]')!;
  function setExpanded(expanded: boolean) {
    if (expanded) { fullscreenHost.append(explorer); if (!fullscreenHost.open) fullscreenHost.showModal(); }
    else { mapPosition.after(explorer); if (fullscreenHost.open) fullscreenHost.close(); }
    explorer.classList.toggle('family-expanded', expanded); document.body.classList.toggle('family-map-open', expanded);
    fullscreenButton.textContent = expanded ? 'Exit full screen' : 'Full screen'; fit();
  }
  fullscreenButton.addEventListener('click', () => setExpanded(!fullscreenHost.open), { signal });
  fullscreenHost.addEventListener('cancel', event => { event.preventDefault(); setExpanded(false); }, { signal });
  stage.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.25); }
    else if (event.key === '-') { event.preventDefault(); zoom(.8); }
    else if (event.key === 'Home' || event.key === '0') { event.preventDefault(); fit(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const current = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-map-person]');
      const direction = event.key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down';
      if (current) {
        const next = directionalNode(graph.nodes, current.dataset.mapPerson!, direction);
        if (next) { focusNode(next.id); nodeElements.get(next.id)!.focus({ preventScroll: true }); }
      } else {
        fitted = false; view.x += direction === 'left' ? 70 : direction === 'right' ? -70 : 0;
        view.y += direction === 'up' ? 70 : direction === 'down' ? -70 : 0; paintView();
      }
    }
  }, { signal });
  stage.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); fitted = false;
    const rect = stage.getBoundingClientRect();
    view = zoomAt(view, view.scale * Math.exp(-event.deltaY * .005), { x: event.clientX - rect.left, y: event.clientY - rect.top }); paintView();
  }, { passive: false, signal });

  const pointers = new Map<number, { x: number; y: number }>();
  let panStart: { x: number; y: number; view: Viewport } | undefined;
  let pinch: { distance: number; anchorX: number; anchorY: number; scale: number } | undefined;
  const point = (event: PointerEvent) => { const rect = stage.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = point(event); pointers.set(event.pointerId, p); panStart = { ...p, view: { ...view } };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), anchorX: (x - view.x) / view.scale, anchorY: (y - view.y) / view.scale, scale: view.scale };
    }
  }, { signal });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const p = point(event); pointers.set(event.pointerId, p);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()]; fitted = false;
      const scale = clampScale(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance);
      view = { scale, x: (a.x + b.x) / 2 - pinch.anchorX * scale, y: (a.y + b.y) / 2 - pinch.anchorY * scale };
      suppressClickUntil = Date.now() + 300;
    } else if (panStart && Math.hypot(p.x - panStart.x, p.y - panStart.y) > 4) {
      fitted = false; view = { ...panStart.view, x: panStart.view.x + p.x - panStart.x, y: panStart.view.y + p.y - panStart.y };
      suppressClickUntil = Date.now() + 300;
    } else return;
    stage.setPointerCapture(event.pointerId); stage.classList.add('is-panning'); paintView();
  }, { signal });
  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId); pinch = undefined; stage.classList.remove('is-panning');
    const remaining = [...pointers.values()][0]; panStart = remaining ? { ...remaining, view: { ...view } } : undefined;
  };
  window.addEventListener('pointerup', endPointer, { signal });
  window.addEventListener('pointercancel', endPointer, { signal });
  const resize = new ResizeObserver(() => {
    if (fitted) fit();
    else paintView();
  });
  resize.observe(stage);
  window.addEventListener('hashchange', readHash, { signal });
  window.addEventListener('popstate', () => { if (location.hash.startsWith('#person-')) readHash(); else closeProfile(); }, { signal });
  document.addEventListener('astro:before-swap', () => {
    closeProfile(); setExpanded(false); controller.abort(); resize.disconnect(); document.body.classList.remove('family-map-open'); delete root.dataset.initialized;
  }, { once: true, signal });
  renderGraph(); if (size().width < 600) familyView(); readHash();
}

document.addEventListener('astro:page-load', initFamilyTree);
initFamilyTree();
