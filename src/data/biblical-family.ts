// This is a separate textual genealogy. There are deliberately no shared-family
// IDs. The display overlay separately labels the medieval legendary bridge.
export interface BiblicalPerson { id: string; name: string; parents: string[]; verse: string; url: string; sourceKind: 'biblical narrative'; confidence: 'textual tradition' }
const passage = (verse: string) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(verse)}&version=KJV`;
const names = ['Adam', 'Seth', 'Enos', 'Cainan', 'Mahalaleel', 'Jared', 'Enoch', 'Methuselah', 'Lamech', 'Noah', 'Shem', 'Arphaxad', 'Salah', 'Eber', 'Peleg', 'Reu', 'Serug', 'Nahor', 'Terah', 'Abram'];
const verses = ['Genesis 5:1–2', 'Genesis 4:25; Genesis 5:3', 'Genesis 5:6', 'Genesis 5:9', 'Genesis 5:12', 'Genesis 5:15', 'Genesis 5:18', 'Genesis 5:21', 'Genesis 5:25', 'Genesis 5:28–29', 'Genesis 5:32', 'Genesis 11:10', 'Genesis 11:12', 'Genesis 11:14', 'Genesis 11:16', 'Genesis 11:18', 'Genesis 11:20', 'Genesis 11:22', 'Genesis 11:24', 'Genesis 11:26'];
export const biblicalPeople: BiblicalPerson[] = names.map((name, i) => ({
  id: `bible-${name.toLowerCase()}`, name, parents: i === 0 ? [] : i === 1 ? ['bible-adam', 'bible-eve'] : [`bible-${names[i - 1].toLowerCase()}`],
  verse: verses[i], url: passage(verses[i].replaceAll('–', '-')), sourceKind: 'biblical narrative', confidence: 'textual tradition',
}));
biblicalPeople.push({ id: 'bible-eve', name: 'Eve', parents: [], verse: 'Genesis 4:1,25', url: passage('Genesis 4:1,25'), sourceKind: 'biblical narrative', confidence: 'textual tradition' });
export const biblicalById = Object.fromEntries(biblicalPeople.map(p => [p.id, p]));
export const ancientGap = { id: 'gap-modern-to-biblical', generations: null, confidence: 'unresolved', connected: false, label: 'Connection unestablished · number of missing generations unknown' } as const;
