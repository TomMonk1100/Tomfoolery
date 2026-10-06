import type { SharedPerson } from './shared-family';
import { EGBERT } from './ancestry-candidates';
// Preserve the sequence of Giles’s printed page 48. These are textual claims,
// not independently established ancestors; do not splice in other variants.
export const chronicleUrl = "https://en.wikisource.org/wiki/Page:The_Anglo-Saxon_Chronicle_(Giles).djvu/66";
export const chronicleCitation = 'The Anglo-Saxon Chronicle, translated by J. A. Giles, G. Bell and Sons edition (1914), printed p. 48, annal 855 pedigree; validated Wikisource transcription inspected 6 October 2026.';
const names = ["Elmund", "Eafa", "Eoppa", "Ingild", "Kenred", "Ceolwald", "Cutha", "Cuthwin", "Ceawlin", "Cynric", "Cerdic", "Elesa", "Esla", "Gewis", "Wig", "Freawin", "Frithogar", "Brond", "Beldeg", "Woden", "Frithowald", "Frealaf", "Frithuwulf", "Finn", "Godwulf", "Geat", "Tætwa", "Beaw", "Sceldi", "Heremod", "Itermon", "Hathra", "Guala", "Bedwig", "Sceaf"];
export const legendaryIds = ["legend-elmund", "legend-eafa", "legend-eoppa", "legend-ingild", "legend-kenred", "legend-ceolwald", "legend-cutha", "legend-cuthwin", "legend-ceawlin", "legend-cynric", "legend-cerdic", "legend-elesa", "legend-esla", "legend-gewis", "legend-wig", "legend-freawin", "legend-frithogar", "legend-brond", "legend-beldeg", "legend-woden", "legend-frithowald", "legend-frealaf", "legend-frithuwulf", "legend-finn", "legend-godwulf", "legend-geat", "legend-taetwa", "legend-beaw", "legend-sceldi", "legend-heremod", "legend-itermon", "legend-hathra", "legend-guala", "legend-bedwig", "legend-sceaf"];
export const legendaryChain = [EGBERT, ...legendaryIds, 'bible-noah'];
export const legendaryRelationships = legendaryChain.slice(1).map((from,i) => ({
  from, to:legendaryChain[i], confidence:'provisional' as const,
  sourceKind:'legendary tradition' as const, finding:'chronicle-legendary-route', url:chronicleUrl,
  note:from==='bible-noah'
    ? 'The chronicle calls Sceaf a son of Noah born in the ark. Genesis does not give Noah a son named Sceaf. This is a medieval legendary bridge, not a biblical parent claim or verified ancestry.'
    : 'Parent claim in this particular medieval royal pedigree. The ancient sequence contains mythical figures and conflicting variants; it supplies a cited tradition, not historical proof of Tom’s descent.',
}));
export const legendaryPeople: SharedPerson[] = names.map((name,i) => ({
  id:legendaryIds[i], uuid:legendaryIds[i], name, dates:'Chronicle tradition · dates unknown',
  aliases:name==='Elmund'?['Ealhmund · identification with the king of Kent disputed']:name==='Kenred'?['Cenred']:[],
  gender:'', parents:[], partners:[], children:[legendaryChain[i]],
}));
