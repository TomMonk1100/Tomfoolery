import { people, searchPeople } from '../data/family';

function initFamilyTree() {
  const found = document.querySelector<HTMLElement>('[data-family-root]');
  if (!found || found.dataset.initialized) return;
  const root = found;
  root.dataset.initialized = 'true';
  const controls = root.querySelector<HTMLElement>('[data-family-controls]')!;
  const search = root.querySelector<HTMLInputElement>('#family-search')!;
  const toggle = root.querySelector<HTMLInputElement>('[data-show-provisional]')!;
  const results = root.querySelector<HTMLUListElement>('#family-results')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const profiles = Array.from(root.querySelectorAll<HTMLElement>('[data-profile]'));
  const older = root.querySelector<HTMLDetailsElement>('[data-provisional-branch]')!;
  const branchLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('.family-tree [data-person-link]'));
  let selected = 'p001';
  controls.hidden = false;
  root.classList.add('family-enhanced');

  function applyProvisionalVisibility() {
    older.hidden = !toggle.checked;
    // Selecting a hidden older profile would leave contradictory state.
    if (!toggle.checked && people.find(p => p.id === selected)?.provisional) selectPerson('p001', false, true);
    showResults();
  }

  function selectPerson(id: string, focus: boolean, updateHash: boolean) {
    if (!people.some(p => p.id === id)) return false;
    selected = id;
    if (people.find(p => p.id === id)?.provisional) { toggle.checked = true; older.hidden = false; }
    profiles.forEach(profile => { profile.hidden = profile.dataset.profile !== id; });
    root.querySelectorAll<HTMLAnchorElement>('[data-person-link]').forEach(link => {
      if (link.dataset.personLink === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    const link = branchLinks.find(link => link.dataset.personLink === id);
    let ancestor = link?.parentElement;
    while (ancestor && ancestor !== root) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    if (updateHash) history.pushState(null, '', `#person-${id}`);
    if (focus) {
      const profile = profiles.find(profile => profile.dataset.profile === id)!;
      const heading = profile.querySelector<HTMLElement>('h3')!;
      heading.focus({ preventScroll: true });
      const headingTop = heading.getBoundingClientRect().top;
      if (matchMedia('(max-width: 850px)').matches || headingTop < 96 || headingTop > innerHeight - 96) {
        profile.scrollIntoView({ block: 'start' });
      }
    }
    return true;
  }

  function showResults() {
    const query = search.value.trim();
    results.replaceChildren();
    status.textContent = '';
    if (!query) return;
    const matches = searchPeople(query, toggle.checked);
    status.textContent = `${matches.length} ${matches.length === 1 ? 'person' : 'people'} found${toggle.checked ? '' : ' (older provisional people excluded)'}.`;
    for (const person of matches) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#person-${person.id}`;
      link.dataset.personLink = person.id;
      link.textContent = `${person.name} · ${person.dates}`;
      if (person.id === selected) link.setAttribute('aria-current', 'true');
      item.append(link); results.append(item);
    }
  }

  root.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('[data-person-link]') : null;
    if (!target || !root.contains(target) || !(event instanceof MouseEvent) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (selectPerson(target.dataset.personLink!, true, true)) event.preventDefault();
  });
  search.addEventListener('input', showResults);
  toggle.addEventListener('change', applyProvisionalVisibility);
  root.querySelector('[data-family-reset]')!.addEventListener('click', () => {
    search.value = ''; toggle.checked = false;
    selectPerson('p001', false, true);
    root.querySelectorAll<HTMLDetailsElement>('[data-branch]').forEach(branch => { branch.open = branch.dataset.defaultOpen === 'true'; });
    applyProvisionalVisibility(); search.focus();
  });
  const readHash = () => {
    const id = location.hash.replace(/^#person-/, '');
    if (location.hash.startsWith('#person-')) selectPerson(id, false, false);
  };
  window.addEventListener('hashchange', readHash);
  // Astro replaces this page's DOM during navigation; release the page-specific listener.
  document.addEventListener('astro:before-swap', () => window.removeEventListener('hashchange', readHash), { once: true });
  selectPerson('p001', false, false);
  applyProvisionalVisibility(); readHash();
}

document.addEventListener('astro:page-load', initFamilyTree);
// Also works when this module loads after an initial page-load event.
initFamilyTree();
