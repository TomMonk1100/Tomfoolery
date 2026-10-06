/** Rebuild the public tree from the archived, rendered MacFamilyTree pages.
 * The archive contains no credentials. UUIDs are authoritative; names are not keys.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const raw = JSON.parse(gunzipSync(readFileSync('docs/family-import/macfamilytree-2026-10-05.json.gz')));
const assetManifest = JSON.parse(readFileSync('docs/family-import/media-assets.json', 'utf8'));
const matches = {
  '24706510-99A9-457D-9D5B-58F2D3BD8FBF': 'p001',
  'E9155948-2972-4691-AFB5-6E6138880940': 'p002',
  '581F3A21-1EEB-4A4B-95E6-7EDBCA8F3FB3': 'p004',
  '012D5FF5-AF1E-4564-B94D-DAECE9008764': 'p005',
  '4ADC4617-83AA-4C15-94F2-1BE7E234EC1A': 'p007',
};
const personId = uuid => matches[uuid] ?? `mft-${uuid.toLowerCase()}`;
const route = href => {
  const match = /^#\/(person|family|event|source|media|place)\?uniqueID=([^&]+)$/.exec(href);
  return match ? match[1] === 'person' ? `/family/person/${personId(match[2])}/` : `/family/record/${match[1]}/${match[2].toLowerCase()}/` : /^https?:\/\//.test(href) ? href : null;
};
const fields = values => values.filter(f => f.value || f.links?.length).map(f => ({ label: f.label, value: f.value, confidence: 'supported', sourceKind: 'compiled genealogy', links: (f.links || []).map(l => ({ name: l.name || l.text, url: route(l.href) })).filter(l => l.url) }));
const record = (r, uuid, kind) => ({
  id: kind === 'person' ? personId(uuid) : uuid.toLowerCase(), uuid, kind, title: r.title, dates: r.subtitle || '',
  originalUrl: `${raw.base}#/${kind}?uniqueID=${uuid}`,
  images: (r.images || []).map(src => assetManifest.find(a => a.url === new URL(src, raw.base).href)?.local).filter(Boolean),
  sections: r.sections.filter(s => s.title !== 'Hourglass Chart').map(s => ({
    title: s.title, text: (s.fields.length || s.links.length) && s.title !== 'Notes' ? '' : s.text.replace(new RegExp(`^${s.title}\\n?`), '').trim(), fields: ['Events','Source Citations'].includes(s.title) ? [] : fields(s.fields),
    cards: s.links.filter(l => !s.fields.some(f => f.links.some(fl => fl.href === l.href))).map(l => ({ name: l.name || l.fields?.find(f => ['Event Type','Cited Source'].includes(f.label))?.value || l.text, url: route(l.href), fields: fields(l.fields || []) })).filter(l => l.url),
  })).filter(s => s.fields.length || s.cards.length || s.text && !s.text.startsWith('No Media')),
});
const records = {};
for (const [key, kind] of Object.entries({people:'person',families:'family',events:'event',sources:'source',media:'media',places:'place'}))
  for (const [uuid, r] of Object.entries(raw[key])) { const p = record(r, uuid, kind); records[`${kind}:${p.id}`] = p; }
const personLinks = (r, section, labels) => [...new Set(r.sections.filter(s => s.title === section).flatMap(s => labels ? s.fields.filter(f => labels.includes(f.label)).flatMap(f => f.links) : s.links).filter(l => l.href.startsWith('#/person?')).map(l => personId(l.href.split('=')[1])))];
const people = Object.entries(raw.people).map(([uuid,r]) => ({
  id: personId(uuid), uuid, name: r.title, dates: r.subtitle || 'Dates not recorded',
  aliases: r.sections.filter(s => s.title === 'Additional Names').flatMap(s => { const result=[];let parts=[];for(const f of s.fields){if(f.label === 'Type'){if(parts.length)result.push(parts.join(' '));parts=[];}else if(['First Name','Last Name'].includes(f.label)&&f.value)parts.push(f.value);}if(parts.length)result.push(parts.join(' '));return result; }),
  parents: personLinks(r,'Parents'), partners: personLinks(r,'Partners',['Partner']), children: personLinks(r,'Partners',['Children']),
  gender: r.sections.find(s=>s.title==='Overview')?.fields.find(f=>f.label==='Gender')?.value || 'Unknown',
}));
const families = Object.entries(raw.families).map(([uuid,r]) => ({id:uuid.toLowerCase(),name:r.title,dates:r.subtitle||'',parents:personLinks(r,'Overview'),children:personLinks(r,'Children')}));
const index = {importedAt:raw.importedAt,title:'Muncie & Crook',people,families,counts:{people:people.length,families:families.length,personEventReferences:Object.values(raw.people).flatMap(r=>r.sections.filter(s=>s.title==='Events').flatMap(s=>s.links)).length,familyEvents:Object.values(raw.families).flatMap(r=>r.sections.filter(s=>s.title==='Events').flatMap(s=>s.links)).length,distinctEvents:Object.keys(raw.events).length,sources:Object.keys(raw.sources).length,media:Object.keys(raw.media).length,places:Object.keys(raw.places).length},matches};
writeFileSync('src/data/shared-family-index.json', JSON.stringify(index));
writeFileSync('src/data/shared-family-records.json', JSON.stringify(records));
console.log(`Imported ${people.length} people, ${families.length} families, ${index.counts.distinctEvents} distinct events and ${index.counts.sources} sources.`);
