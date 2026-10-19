import type { AnatomicalStructure, SimulationDefinition } from '../contract/schema';

/**
 * The digestive lab as data. Every function statement is drawn from the cited OpenStax sections
 * (A&P 2e 23.3–23.6); where the sources give only a location, the text says so instead of guessing.
 */

const OES = ['openstax-oesophagus', 'bodyparts3d'] as const;
const STO = ['openstax-stomach', 'bodyparts3d'] as const;
const SI = ['openstax-intestines', 'hra-small-intestine'] as const;
const LI = ['openstax-intestines', 'hra-large-intestine'] as const;
const LIV = ['openstax-accessory', 'hra-liver'] as const;
const BIL = ['openstax-accessory', 'hra-united'] as const;
const PAN = ['openstax-accessory', 'hra-pancreas'] as const;

type M = Omit<AnatomicalStructure, 'kind' | 'synonyms' | 'related'> & { synonyms?: string[]; related?: string[] };
const mesh = (s: M): AnatomicalStructure => ({ ...s, kind: 'mesh', synonyms: s.synonyms ?? [], related: s.related ?? [] });
const group = (s: Omit<M, 'organ'> & { members: string[] }): AnatomicalStructure => ({ ...s, kind: 'group', synonyms: s.synonyms ?? [], related: s.related ?? [] });

const DUODENUM_FN = 'The first part of the small intestine (about 25.4 cm). Bile and pancreatic juice enter it at the hepatopancreatic ampulla, and enzymes from the pancreas and the intestinal wall carry on digesting the chyme that arrives from the stomach.';
const COLON_FN = 'Absorbs the remaining water and salts, and, with the help of its bacteria, makes some vitamins (such as vitamin K and biotin) and forms the faeces.';
const LIVER_SEGMENT_FN = 'Part of the liver, the body’s largest gland. The liver makes about one litre of bile a day and processes the nutrient-rich blood that arrives from the intestines.';

const structures: AnatomicalStructure[] = [
  // ── Groups ────────────────────────────────────────────────────────────────
  group({
    id: 'duodenum', label: 'Duodenum', synonyms: ['first part of small intestine'], layer: 'tract', side: 'right',
    members: ['duodenal-bulb', 'duodenum-superior', 'duodenum-descending', 'duodenum-horizontal', 'duodenum-ascending'],
    summary: 'The C-shaped first part of the small intestine, curving around the head of the pancreas.',
    function: DUODENUM_FN, related: ['stomach', 'hepatopancreatic-ampulla', 'pancreas'], sources: [...SI],
  }),
  group({
    id: 'small-intestine', label: 'Small intestine', synonyms: ['small bowel'], layer: 'tract', side: 'midline',
    members: ['duodenal-bulb', 'duodenum-superior', 'duodenum-descending', 'duodenum-horizontal', 'duodenum-ascending', 'jejunum', 'ileum', 'terminal-ileum'],
    summary: 'The long, coiled tube from the stomach to the large intestine: duodenum, jejunum and ileum. In a living person it is about 3.05 m long and 2.54 cm wide.',
    function: 'Where most digestion and absorption happen. Circular folds, villi and microvilli give it a surface of about 200 m². Sugars and amino acids pass into the blood, fats into the lymph, and about 90 % of the water taken in is absorbed here. Chyme takes about 3 to 5 hours to pass through.',
    related: ['large-intestine', 'duodenum'], sources: [...SI],
  }),
  group({
    id: 'colon', label: 'Colon', synonyms: ['large bowel'], layer: 'tract', side: 'midline',
    members: ['ascending-colon', 'hepatic-flexure', 'transverse-colon', 'splenic-flexure', 'descending-colon', 'sigmoid-colon'],
    summary: 'The main part of the large intestine: ascending, transverse, descending and sigmoid colon, with the hepatic and splenic flexures where it turns.',
    function: COLON_FN, related: ['caecum', 'rectum'], sources: [...LI],
  }),
  group({
    id: 'large-intestine', label: 'Large intestine', synonyms: ['large bowel', 'colon'], layer: 'tract', side: 'midline',
    members: ['ileocaecal-valve', 'caecum', 'appendix', 'ascending-colon', 'hepatic-flexure', 'transverse-colon', 'splenic-flexure', 'descending-colon', 'sigmoid-colon', 'rectum'],
    summary: 'The last part of the digestive tract, framing the small intestine: caecum and appendix, colon, and rectum. About half as long as the small intestine but more than twice as wide (about 7.62 cm).',
    function: `${COLON_FN} Residue usually stays 12 to 24 hours; of about 500 mL entering the caecum each day, about 150 mL becomes faeces.`,
    related: ['small-intestine'], sources: [...LI],
  }),
  group({
    id: 'liver-segments', label: 'Liver segments', synonyms: ['Couinaud segments', 'hepatic segments'], layer: 'liver-segment', side: 'right',
    members: ['liver-right-anterosuperior', 'liver-right-anteroinferior', 'liver-right-posterosuperior', 'liver-right-posteroinferior', 'liver-left-superomedial', 'liver-left-inferomedial', 'liver-left-anterolateral', 'caudate-lobe', 'quadrate-lobe'],
    summary: 'The liver is divided inside into segments, each with its own blood supply and bile drainage. Turn on the “Liver segments” layer to see them.',
    function: LIVER_SEGMENT_FN, modelNote: 'Segment names follow the HuBMAP reference organ.', related: ['liver'], sources: [...LIV],
  }),
  group({
    id: 'biliary-tree', label: 'Bile ducts and gallbladder', synonyms: ['biliary tree', 'biliary system'], layer: 'biliary', side: 'right',
    members: ['right-hepatic-duct', 'left-hepatic-duct', 'common-hepatic-duct', 'cystic-duct', 'gallbladder', 'common-bile-duct', 'hepatopancreatic-ampulla', 'ampulla-sphincter'],
    summary: 'The ducts that carry bile from the liver to the duodenum, and the gallbladder that stores it.',
    function: 'The right and left hepatic ducts join into the common hepatic duct, which meets the cystic duct from the gallbladder to form the common bile duct. This joins the pancreatic duct at the hepatopancreatic ampulla, whose sphincter controls the flow into the duodenum.',
    related: ['liver', 'duodenum'], sources: [...BIL],
  }),
  group({
    id: 'pancreas', label: 'Pancreas', synonyms: ['pancreatic gland'], layer: 'pancreas', side: 'midline',
    members: ['pancreas-head', 'pancreas-uncinate', 'pancreas-neck', 'pancreas-body', 'pancreas-tail', 'main-pancreatic-duct', 'accessory-pancreatic-duct'],
    summary: 'A long gland lying behind the stomach, its head in the curve of the duodenum and its body reaching about 15.2 cm to the left.',
    function: 'Its acini make over a litre of pancreatic juice a day: water, salts, sodium bicarbonate (pH 7.1–8.2), which neutralises the acid chyme, and digestive enzymes: amylase (starch), lipase (fats), nucleases (nucleic acids) and proteases such as trypsin and chymotrypsin (proteins), released inactive so they do not digest the pancreas itself.',
    related: ['duodenum', 'hepatopancreatic-ampulla'], sources: [...PAN],
  }),

  // ── The tract ─────────────────────────────────────────────────────────────
  mesh({
    id: 'oesophagus', label: 'Oesophagus', synonyms: ['esophagus', 'gullet', 'food pipe'], layer: 'tract', side: 'midline',
    summary: 'A muscular tube about 25.4 cm long, behind the trachea, that passes through the diaphragm at the oesophageal hiatus to reach the stomach.',
    function: 'Moves food to the stomach by peristalsis (waves of muscle contraction) and lubricates it with mucus. The upper oesophageal sphincter lets food in from the pharynx; the lower oesophageal (cardiac) sphincter opens into the stomach and closes to keep acid out.',
    modelNote: 'BodyParts3D oesophagus, fitted onto the HuBMAP body together with the stomach (see the About sheet).',
    related: ['stomach'], sources: [...OES],
  }),
  mesh({
    id: 'stomach', label: 'Stomach', synonyms: ['gaster', 'cardia', 'fundus', 'pylorus'], layer: 'tract', side: 'left',
    summary: 'A muscular sac in the upper left abdomen. Its regions are the cardia, the dome-shaped fundus, the body and the pylorus, which ends at the pyloric sphincter.',
    function: 'Holds food (up to about 4 litres), churns it with gastric juice into chyme, and passes it on a few millilitres at a time. Hydrochloric acid (pH 1.5–3.5) activates pepsin, which begins protein digestion; intrinsic factor is needed to absorb vitamin B12. It empties 2 to 4 hours after a meal.',
    modelNote: 'BodyParts3D stomach, fitted onto the HuBMAP body and gently reshaped where it overlapped the liver and colon, as a soft organ moulds against its neighbours.',
    related: ['oesophagus', 'duodenum', 'liver'], sources: [...STO],
  }),
  mesh({ id: 'duodenal-bulb', label: 'Duodenal bulb', synonyms: ['duodenal ampulla', 'duodenal cap'], layer: 'tract', side: 'right', organ: 'duodenum', summary: 'The first, slightly widened stretch of the duodenum, just after the pyloric sphincter.', function: DUODENUM_FN, related: ['stomach'], sources: [...SI] }),
  mesh({ id: 'duodenum-superior', label: 'Duodenum, superior part', synonyms: ['first part of duodenum'], layer: 'tract', side: 'right', organ: 'duodenum', summary: 'The first part of the duodenum, running from the pylorus toward the liver.', function: DUODENUM_FN, sources: [...SI] }),
  mesh({ id: 'duodenum-descending', label: 'Duodenum, descending part', synonyms: ['second part of duodenum', 'major duodenal papilla'], layer: 'tract', side: 'right', organ: 'duodenum', summary: 'The second part of the duodenum, running down beside the head of the pancreas. Bile and pancreatic juice enter here.', function: DUODENUM_FN, related: ['hepatopancreatic-ampulla', 'pancreas-head'], sources: [...SI] }),
  mesh({ id: 'duodenum-horizontal', label: 'Duodenum, horizontal part', synonyms: ['third part of duodenum'], layer: 'tract', side: 'midline', organ: 'duodenum', summary: 'The third part of the duodenum, crossing from right to left below the pancreas.', function: DUODENUM_FN, sources: [...SI] }),
  mesh({ id: 'duodenum-ascending', label: 'Duodenum, ascending part', synonyms: ['fourth part of duodenum'], layer: 'tract', side: 'left', organ: 'duodenum', summary: 'The fourth part of the duodenum, rising to join the jejunum.', function: DUODENUM_FN, related: ['jejunum'], sources: [...SI] }),
  mesh({ id: 'jejunum', label: 'Jejunum', layer: 'tract', side: 'left', organ: 'small-intestine', summary: 'The middle part of the small intestine, about 0.9 m long in a living person, coiled in the upper left abdomen.', function: 'Enzymes from the pancreas and the intestinal wall finish digesting carbohydrates and proteins, and bile helps digest fats. The products are absorbed through the villi: sugars and amino acids into the blood, fats into the lymph.', related: ['ileum', 'duodenum'], sources: [...SI] }),
  mesh({ id: 'ileum', label: 'Ileum', layer: 'tract', side: 'midline', organ: 'small-intestine', summary: 'The last and longest part of the small intestine, about 1.8 m long in a living person, coiled in the lower abdomen.', function: 'Absorption continues. Bile salts are absorbed here and carried back to the liver to be used again.', related: ['jejunum', 'caecum'], sources: [...SI] }),
  mesh({ id: 'terminal-ileum', label: 'Terminal ileum', layer: 'tract', side: 'right', organ: 'small-intestine', summary: 'The end of the ileum, joining the large intestine at the ileocaecal valve.', function: 'Passes what is left of the chyme into the caecum through the ileocaecal sphincter.', related: ['ileocaecal-valve', 'caecum'], sources: [...SI] }),
  mesh({ id: 'ileocaecal-valve', label: 'Ileocaecal valve', synonyms: ['ileocecal valve', 'ileocaecal sphincter'], layer: 'tract', side: 'right', organ: 'large-intestine', summary: 'The sphincter where the ileum opens into the caecum.', function: 'Controls the passage of material from the small intestine into the large intestine.', sources: [...LI] }),
  mesh({ id: 'caecum', label: 'Caecum', synonyms: ['cecum'], layer: 'tract', side: 'right', organ: 'large-intestine', summary: 'A pouch about 6 cm long at the start of the large intestine, in the lower right abdomen.', function: 'Receives the residue from the ileum and begins the large intestine’s work of absorbing water.', related: ['appendix', 'ascending-colon'], sources: [...LI] }),
  mesh({ id: 'appendix', label: 'Appendix', synonyms: ['vermiform appendix'], layer: 'tract', side: 'right', organ: 'large-intestine', summary: 'A narrow, worm-shaped tube about 7.6 cm long attached to the caecum.', function: 'The sources used in this lab describe its location only.', related: ['caecum'], sources: [...LI] }),
  mesh({ id: 'ascending-colon', label: 'Ascending colon', layer: 'tract', side: 'right', organ: 'colon', summary: 'The colon rising up the right side of the abdomen from the caecum.', function: COLON_FN, sources: [...LI] }),
  mesh({ id: 'hepatic-flexure', label: 'Hepatic flexure', synonyms: ['right colic flexure'], layer: 'tract', side: 'right', organ: 'colon', summary: 'The bend where the ascending colon turns left, just under the liver.', function: COLON_FN, related: ['liver'], sources: [...LI] }),
  mesh({ id: 'transverse-colon', label: 'Transverse colon', layer: 'tract', side: 'midline', organ: 'colon', summary: 'The colon crossing the abdomen from right to left below the stomach.', function: COLON_FN, sources: [...LI] }),
  mesh({ id: 'splenic-flexure', label: 'Splenic flexure', synonyms: ['left colic flexure'], layer: 'tract', side: 'left', organ: 'colon', summary: 'The bend near the spleen where the transverse colon turns down.', function: COLON_FN, sources: [...LI] }),
  mesh({ id: 'descending-colon', label: 'Descending colon', layer: 'tract', side: 'left', organ: 'colon', summary: 'The colon running down the left side of the abdomen.', function: COLON_FN, sources: [...LI] }),
  mesh({ id: 'sigmoid-colon', label: 'Sigmoid colon', layer: 'tract', side: 'midline', organ: 'colon', summary: 'The S-shaped last part of the colon, in the pelvis.', function: COLON_FN, related: ['rectum'], sources: [...LI] }),
  mesh({ id: 'rectum', label: 'Rectum', layer: 'tract', side: 'midline', organ: 'large-intestine', summary: 'The last part of the large intestine, about 20.3 cm long, ending at the anal canal.', function: 'Mass movements three or four times a day push faeces into the rectum. Its stretching triggers the defecation reflex: the internal anal sphincter relaxes, while the external sphincter can be opened or kept closed by choice.', related: ['sigmoid-colon'], sources: [...LI] }),

  // ── Liver ─────────────────────────────────────────────────────────────────
  mesh({
    id: 'liver', label: 'Liver', synonyms: ['hepar', 'hepatic'], layer: 'liver', side: 'right',
    summary: 'The largest gland in the body (about 1.4 kg, three pounds), under the diaphragm in the upper right abdomen, with a large right lobe and a smaller left lobe.',
    function: 'Makes about one litre of bile a day, which emulsifies fats. It also processes the nutrient-rich blood that arrives from the intestines through the hepatic portal vein, including absorbed drugs and toxins; about 1500 mL of blood flows through it each minute at rest.',
    modelNote: 'Shown as the liver’s outer surface (capsule). Its inner segments are a separate layer.',
    related: ['gallbladder', 'liver-segments', 'biliary-tree'], sources: [...LIV],
  }),
  ...([
    ['liver-right-anterosuperior', 'Right anterosuperior segment'], ['liver-right-anteroinferior', 'Right anteroinferior segment'],
    ['liver-right-posterosuperior', 'Right posterosuperior segment'], ['liver-right-posteroinferior', 'Right posteroinferior segment'],
    ['liver-left-superomedial', 'Left superomedial segment'], ['liver-left-inferomedial', 'Left inferomedial segment'],
    ['liver-left-anterolateral', 'Left anterolateral segment'], ['caudate-lobe', 'Caudate lobe'], ['quadrate-lobe', 'Quadrate lobe'],
  ] as const).map(([id, label]) => mesh({
    id, label, synonyms: ['liver segment'], layer: 'liver-segment', side: id.includes('left') ? (id === 'liver-left-anterolateral' ? 'left' : 'midline') : id === 'caudate-lobe' ? 'midline' : 'right', organ: 'liver-segments',
    summary: `A segment of the liver (${label.toLowerCase()}).`, function: LIVER_SEGMENT_FN, modelNote: 'Segment names follow the HuBMAP reference organ.', related: ['liver'], sources: [...LIV],
  })),
  ...([
    ['falciform-ligament', 'Falciform ligament', 'A thin fold of tissue on the front and top of the liver.'],
    ['round-ligament', 'Round ligament of the liver', 'A cord along the lower edge of the falciform ligament.'],
    ['coronary-ligament', 'Coronary ligament', 'Folds on the top and back of the liver, against the diaphragm.'],
    ['triangular-ligament', 'Left triangular ligament', 'A fold at the left end of the liver, against the diaphragm.'],
    ['ligamentum-venosum', 'Ligamentum venosum', 'A fibrous cord on the underside of the liver.'],
    ['hepatoduodenal-ligament', 'Hepatoduodenal ligament', 'A fold between the liver and the duodenum.'],
  ] as const).map(([id, label, summary]) => mesh({
    id, label, layer: 'ligament', side: id === 'coronary-ligament' || id === 'hepatoduodenal-ligament' ? 'right' : id === 'triangular-ligament' ? 'left' : 'midline',
    summary, function: 'The sources used in this lab describe its location only.', related: ['liver'], sources: ['hra-liver'],
  })),

  // ── Bile ──────────────────────────────────────────────────────────────────
  mesh({ id: 'gallbladder', label: 'Gallbladder', synonyms: ['gall bladder'], layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'A green pear-shaped sac, 8–10 cm long, on the underside of the liver’s right lobe.', function: 'Stores bile and concentrates it up to 10-fold. When fatty chyme enters the duodenum, the hormone CCK makes it contract and release bile; between meals the ampulla’s valve closes and bile backs up into the gallbladder.', related: ['cystic-duct', 'liver'], sources: [...BIL] }),
  mesh({ id: 'right-hepatic-duct', label: 'Right hepatic duct', layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'Drains bile from the right part of the liver.', function: 'Joins the left hepatic duct to form the common hepatic duct.', sources: [...BIL] }),
  mesh({ id: 'left-hepatic-duct', label: 'Left hepatic duct', layer: 'biliary', side: 'midline', organ: 'biliary-tree', summary: 'Drains bile from the left part of the liver.', function: 'Joins the right hepatic duct to form the common hepatic duct.', sources: [...BIL] }),
  mesh({ id: 'common-hepatic-duct', label: 'Common hepatic duct', layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'Formed where the right and left hepatic ducts meet.', function: 'Carries bile from the liver; it meets the cystic duct to form the common bile duct.', sources: [...BIL] }),
  mesh({ id: 'cystic-duct', label: 'Cystic duct', layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'A short duct, 1–2 cm long, from the gallbladder.', function: 'Carries bile into the gallbladder for storage and out again when it is released.', related: ['gallbladder'], sources: [...BIL] }),
  mesh({ id: 'common-bile-duct', label: 'Common bile duct', synonyms: ['bile duct'], layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'Formed where the common hepatic duct and the cystic duct meet; it runs down behind the duodenum.', function: 'Carries bile to the hepatopancreatic ampulla, where it joins the pancreatic duct.', sources: [...BIL] }),
  mesh({ id: 'hepatopancreatic-ampulla', label: 'Hepatopancreatic ampulla', synonyms: ['ampulla of Vater', 'major duodenal papilla'], layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'The short shared channel where the common bile duct and the main pancreatic duct meet, opening into the duodenum at the major duodenal papilla.', function: 'Delivers bile and pancreatic juice into the duodenum; its sphincter controls the flow.', related: ['ampulla-sphincter', 'duodenum-descending'], sources: [...BIL] }),
  mesh({ id: 'ampulla-sphincter', label: 'Hepatopancreatic sphincter', synonyms: ['sphincter of Oddi'], layer: 'biliary', side: 'right', organ: 'biliary-tree', summary: 'The ring of smooth muscle around the hepatopancreatic ampulla.', function: 'Controls the release of bile and pancreatic juice into the small intestine.', sources: ['openstax-accessory', 'hra-small-intestine'] }),

  // ── Pancreas ──────────────────────────────────────────────────────────────
  mesh({ id: 'pancreas-head', label: 'Head of pancreas', layer: 'pancreas', side: 'right', organ: 'pancreas', summary: 'The widest part of the pancreas, in the C-shaped curve of the duodenum.', function: 'Part of the pancreas, which makes over a litre of pancreatic juice a day.', related: ['duodenum'], sources: [...PAN] }),
  mesh({ id: 'pancreas-uncinate', label: 'Uncinate process', layer: 'pancreas', side: 'right', organ: 'pancreas', summary: 'A hook-shaped extension from the lower part of the head of the pancreas.', function: 'Part of the pancreas, which makes over a litre of pancreatic juice a day.', sources: [...PAN] }),
  mesh({ id: 'pancreas-neck', label: 'Neck of pancreas', layer: 'pancreas', side: 'midline', organ: 'pancreas', summary: 'The short narrower part between the head and the body.', function: 'Part of the pancreas, which makes over a litre of pancreatic juice a day.', sources: [...PAN] }),
  mesh({ id: 'pancreas-body', label: 'Body of pancreas', layer: 'pancreas', side: 'left', organ: 'pancreas', summary: 'The long middle part of the pancreas, lying behind the stomach.', function: 'Part of the pancreas, which makes over a litre of pancreatic juice a day.', related: ['stomach'], sources: [...PAN] }),
  mesh({ id: 'pancreas-tail', label: 'Tail of pancreas', layer: 'pancreas', side: 'left', organ: 'pancreas', summary: 'The narrow left end of the pancreas, near the spleen.', function: 'Part of the pancreas, which makes over a litre of pancreatic juice a day.', sources: [...PAN] }),
  mesh({ id: 'main-pancreatic-duct', label: 'Main pancreatic duct', synonyms: ['pancreatic duct', 'duct of Wirsung'], layer: 'pancreas-duct', side: 'midline', organ: 'pancreas', summary: 'The duct running the length of the pancreas.', function: 'Carries pancreatic juice to the hepatopancreatic ampulla, where it joins the common bile duct.', related: ['hepatopancreatic-ampulla'], modelNote: 'HuBMAP “ventral pancreatic duct”.', sources: ['openstax-accessory', 'hra-united'] }),
  mesh({ id: 'accessory-pancreatic-duct', label: 'Accessory pancreatic duct', synonyms: ['duct of Santorini'], layer: 'pancreas-duct', side: 'midline', organ: 'pancreas', summary: 'A smaller duct in the head of the pancreas.', function: 'Empties pancreatic juice into the duodenum about an inch (2.5 cm) above the hepatopancreatic ampulla.', modelNote: 'HuBMAP “dorsal pancreatic duct”.', sources: ['openstax-accessory', 'hra-united'] }),
];

export const digestiveDefinition: SimulationDefinition = {
  schemaVersion: 1,
  id: 'human-digestive-anatomy',
  title: 'Human Digestive System',
  domain: 'biology',
  simulationType: '3d-anatomy',
  audience: 'Secondary school (Classes 10–12) and first-year undergraduate biology',
  summary:
    'Explore a realistic 3D digestive system built from the HuBMAP female reference organs: the oesophagus, stomach, small and large intestine, liver, gallbladder and pancreas. Follow food on its journey through the tract, watch bile and pancreatic juice flow into the duodenum, and cut the organs open.',
  learningObjectives: [
    { id: 'order', text: 'Name the parts of the digestive tract in the order food passes through them.' },
    { id: 'stomach', text: 'Describe what the stomach does to food and how long it takes.' },
    { id: 'absorb', text: 'Explain why the small intestine is where most digestion and absorption happen.' },
    { id: 'large', text: 'State what the large intestine absorbs and makes.' },
    { id: 'accessory', text: 'Describe what the liver, gallbladder and pancreas add to digestion, and the route bile and pancreatic juice take.' },
  ],
  assets: [{ id: 'hra-digestive-v1', role: 'anatomy-model' }],
  layers: [
    { id: 'tract', label: 'Digestive tract', description: 'Oesophagus, stomach, small and large intestine.', visibleByDefault: true },
    { id: 'liver', label: 'Liver', description: 'The liver’s outer surface.', visibleByDefault: true },
    { id: 'biliary', label: 'Gallbladder and bile ducts', description: 'Gallbladder, hepatic and bile ducts, ampulla.', visibleByDefault: true },
    { id: 'pancreas', label: 'Pancreas', description: 'Head, neck, body and tail of the pancreas.', visibleByDefault: true },
    { id: 'pancreas-duct', label: 'Pancreatic ducts', description: 'Main and accessory pancreatic ducts (inside the pancreas).', visibleByDefault: true },
    { id: 'liver-segment', label: 'Liver segments', description: 'The segments inside the liver.', visibleByDefault: false },
    { id: 'ligament', label: 'Liver ligaments', description: 'Ligaments that hold the liver in place.', visibleByDefault: false },
  ],
  structures,
  cameraPresets: [
    { id: 'anterior', label: 'Front', direction: [0, 0, 1] },
    { id: 'posterior', label: 'Back', direction: [0, 0, -1] },
    { id: 'left', label: 'Left side', direction: [1, 0, 0] },
    { id: 'right', label: 'Right side', direction: [-1, 0, 0] },
    { id: 'superior', label: 'Top', direction: [0, 1, 0.0001], up: [0, 0, -1] },
    { id: 'inferior', label: 'Bottom', direction: [0, -1, 0.0001], up: [0, 0, 1] },
  ],
  defaultCamera: 'anterior',
  foodRoute: {
    id: 'food-route',
    label: 'The journey of food',
    description: 'The order in which food passes through the digestive tract, and what happens at each stage. Complete digestion usually takes 24 to 72 hours.',
    steps: [
      { offModel: 'mouth-pharynx', label: 'Mouth and pharynx', note: 'Chewed food is shaped into a bolus and swallowed; a solid bolus reaches the stomach about 4 to 8 seconds after swallowing.' },
      { structure: 'oesophagus', label: 'Oesophagus', note: 'Peristalsis pushes the bolus down; the lower oesophageal sphincter opens into the stomach.' },
      { structure: 'stomach', label: 'Stomach', note: 'Churned with acid and pepsin into chyme; protein digestion begins. Empties in 2 to 4 hours.' },
      { structure: 'duodenum', label: 'Duodenum', note: 'Bile and pancreatic juice arrive at the hepatopancreatic ampulla and neutralise the acid chyme.' },
      { structure: 'jejunum', label: 'Jejunum', note: 'Carbohydrates and proteins are fully digested and nutrients absorbed through the villi.' },
      { structure: 'ileum', label: 'Ileum', note: 'Absorption continues; bile salts are absorbed and returned to the liver. The small intestine takes 3 to 5 hours in all.' },
      { structure: 'caecum', label: 'Caecum', note: 'Residue passes through the ileocaecal valve into the large intestine.' },
      { structure: 'colon', label: 'Colon', note: 'Water and salts are absorbed; bacteria make some vitamins. Residue stays 12 to 24 hours.' },
      { structure: 'rectum', label: 'Rectum', note: 'Mass movements fill the rectum and trigger the defecation reflex.' },
      { offModel: 'anal-canal', label: 'Anal canal', note: 'Faeces leave through the internal and external anal sphincters.' },
    ],
    facts: [
      'Complete digestion usually takes 24 to 72 hours.',
      'The small intestine is about 3.05 m long in a living person and has a surface area of about 200 m².',
      'About 90 % of the water we take in is absorbed in the small intestine.',
      'Of about 500 mL of residue entering the caecum each day, about 150 mL becomes faeces.',
    ],
    assumptions: [
      'The food moves at a steady, schematic speed; the real times are given beside each stage.',
      'The path runs through the inside of each organ of the model; where loops of intestine touch, it may cut a corner.',
      'The mouth, pharynx and anal canal are not part of the model.',
      'The oesophagus and stomach come from a different reference body (BodyParts3D), fitted onto this one and gently reshaped where they overlapped.',
    ],
    sources: ['openstax-oesophagus', 'openstax-stomach', 'openstax-intestines'],
  },
  juiceRoutes: [
    {
      id: 'bile',
      label: 'Bile',
      description: 'Bile is made in the liver, stored and concentrated in the gallbladder, and released into the duodenum, where it breaks fats into tiny droplets.',
      steps: [
        { offModel: 'liver-cells', label: 'Liver cells', note: 'About one litre of bile a day.' },
        { structure: 'right-hepatic-duct', label: 'Right and left hepatic ducts' },
        { structure: 'common-hepatic-duct', label: 'Common hepatic duct' },
        { structure: 'cystic-duct', label: 'Cystic duct', note: 'To and from the gallbladder.' },
        { structure: 'gallbladder', label: 'Gallbladder', note: 'Stores bile and concentrates it up to 10-fold; releases it when fatty chyme arrives.' },
        { structure: 'common-bile-duct', label: 'Common bile duct' },
        { structure: 'hepatopancreatic-ampulla', label: 'Hepatopancreatic ampulla', note: 'Joins the pancreatic duct; its sphincter controls the flow.' },
        { structure: 'duodenum', label: 'Duodenum' },
      ],
      facts: [
        'Bile salts break fat globules into droplets about 1 µm across (emulsification), giving fat-digesting enzymes much more surface to work on.',
        'Bile is alkaline (pH 7.6 to 8.6) and coloured by bilirubin, a pigment from worn-out red blood cells.',
      ],
      assumptions: ['The flow is drawn steadily; in life the gallbladder releases bile mainly after a fatty meal.'],
      sources: ['openstax-accessory'],
    },
    {
      id: 'pancreatic-juice',
      label: 'Pancreatic juice',
      description: 'Pancreatic juice flows from the pancreas through the pancreatic ducts into the duodenum.',
      steps: [
        { offModel: 'pancreatic-acini', label: 'Pancreatic acini', note: 'Over a litre a day.' },
        { structure: 'main-pancreatic-duct', label: 'Main pancreatic duct' },
        { structure: 'hepatopancreatic-ampulla', label: 'Hepatopancreatic ampulla' },
        { structure: 'accessory-pancreatic-duct', label: 'Accessory pancreatic duct', note: 'Enters the duodenum about 2.5 cm above the ampulla.' },
        { structure: 'duodenum', label: 'Duodenum' },
      ],
      facts: [
        'Sodium bicarbonate (pH 7.1 to 8.2) neutralises the acid chyme from the stomach.',
        'Enzymes: amylase digests starch, lipase fats, nucleases nucleic acids, and proteases such as trypsin and chymotrypsin proteins.',
      ],
      assumptions: ['The flow is drawn steadily; in life secretion rises after a meal.'],
      sources: ['openstax-accessory'],
    },
  ],
  tour: [
    {
      id: 'overview', title: 'The digestive system', camera: 'anterior', colourBy: 'organ',
      focus: ['oesophagus', 'stomach', 'small-intestine', 'large-intestine'],
      body: 'The digestive tract is one long tube: oesophagus, stomach, small intestine and large intestine. The liver, gallbladder and pancreas are accessory organs that pour their juices into it. Here each part has its own colour.',
    },
    {
      id: 'oesophagus', title: 'Oesophagus', camera: 'anterior', focus: ['oesophagus'],
      body: 'A muscular tube about 25.4 cm long. Waves of contraction (peristalsis) push the swallowed bolus down through the diaphragm. The lower oesophageal sphincter opens into the stomach and closes to keep acid out.',
    },
    {
      id: 'stomach', title: 'Stomach', camera: 'anterior', focus: ['stomach'],
      body: 'The stomach churns food with acid (pH 1.5 to 3.5) and pepsin into a soupy chyme and starts digesting proteins. Every 20 seconds or so a mixing wave pushes a few millilitres through the pyloric sphincter. It empties in 2 to 4 hours.',
    },
    {
      id: 'duodenum', title: 'Duodenum: where the juices arrive', camera: 'anterior', juices: true,
      focus: ['duodenum', 'hepatopancreatic-ampulla', 'common-bile-duct', 'main-pancreatic-duct'],
      body: 'The C-shaped duodenum curves around the head of the pancreas. Bile (green) and pancreatic juice (gold) enter it through the hepatopancreatic ampulla. Bicarbonate neutralises the acid chyme, and enzymes go to work.',
    },
    {
      id: 'small-intestine', title: 'Small intestine', camera: 'anterior', focus: ['jejunum', 'ileum', 'terminal-ileum'],
      body: 'Coiled in the middle of the abdomen, the jejunum and ileum are about 3 m long in life. Folds, villi and microvilli give them about 200 m² of surface, so most nutrients and about 90 % of water are absorbed here, in about 3 to 5 hours.',
    },
    {
      id: 'liver', title: 'Liver', camera: 'anterior', focus: ['liver'],
      body: 'The largest gland in the body sits under the diaphragm on the right. It makes about a litre of bile a day and processes the nutrient-rich blood arriving from the intestines.',
    },
    {
      id: 'bile', title: 'Gallbladder and the route of bile', camera: 'anterior', juices: true,
      focus: ['gallbladder', 'cystic-duct', 'right-hepatic-duct', 'left-hepatic-duct', 'common-hepatic-duct', 'common-bile-duct'],
      body: 'Bile flows down the hepatic ducts into the common hepatic duct. Between meals it backs up the cystic duct into the gallbladder, which concentrates it up to 10-fold. After a fatty meal the gallbladder squeezes it down the common bile duct to the duodenum.',
    },
    {
      id: 'pancreas', title: 'Pancreas', camera: 'anterior', juices: true,
      focus: ['pancreas'],
      body: 'Behind the stomach, the pancreas makes over a litre of pancreatic juice a day: bicarbonate to neutralise acid, and enzymes for starch, fats, proteins and nucleic acids. Its main duct joins the bile duct at the ampulla.',
    },
    {
      id: 'large-intestine', title: 'Large intestine', camera: 'anterior', colourBy: 'organ',
      focus: ['large-intestine'],
      body: 'The large intestine frames the small intestine: caecum and appendix, ascending, transverse, descending and sigmoid colon, then the rectum. It absorbs water and salts, its bacteria make vitamins such as vitamin K, and residue stays 12 to 24 hours.',
    },
    {
      id: 'cut', title: 'Inside the tubes', camera: 'anterior', slice: { axis: 'coronal', at: 0.05 },
      focus: [],
      body: 'A cut through the abdomen from front to back shows the walls of the stomach and intestines, and the hollow lumen inside each tube that food passes along.',
    },
    {
      id: 'journey', title: 'The whole journey', camera: 'anterior', food: true, focus: [],
      body: 'Follow food from the oesophagus to the rectum. In life the whole journey usually takes 24 to 72 hours; here it is speeded up. The panel shows what happens at each stage.',
    },
  ],
  sources: [
    {
      id: 'openstax-oesophagus',
      citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 23.3 "The Mouth, Pharynx, and Esophagus". Houston: OpenStax; 2022.',
      url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-3-the-mouth-pharynx-and-esophagus',
    },
    {
      id: 'openstax-stomach',
      citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 23.4 "The Stomach". Houston: OpenStax; 2022.',
      url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-4-the-stomach',
    },
    {
      id: 'openstax-intestines',
      citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 23.5 "The Small and Large Intestines". Houston: OpenStax; 2022.',
      url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-5-the-small-and-large-intestines',
    },
    {
      id: 'openstax-accessory',
      citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 23.6 "Accessory Organs in Digestion: The Liver, Pancreas, and Gallbladder". Houston: OpenStax; 2022.',
      url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder',
    },
    { id: 'hra-liver', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ for Liver, Female, v1.2. HuBMAP Human Reference Atlas. doi:10.48539/HBM599.GZLD.639', url: 'https://doi.org/10.48539/HBM599.GZLD.639', license: 'CC BY 4.0' },
    { id: 'hra-pancreas', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ for Pancreas, Female, v1.3. HuBMAP Human Reference Atlas. doi:10.48539/HBM866.PNNZ.328', url: 'https://doi.org/10.48539/HBM866.PNNZ.328', license: 'CC BY 4.0' },
    { id: 'hra-small-intestine', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ for Small Intestine, Female, v1.2. HuBMAP Human Reference Atlas. doi:10.48539/HBM784.FBXB.245', url: 'https://doi.org/10.48539/HBM784.FBXB.245', license: 'CC BY 4.0' },
    { id: 'hra-large-intestine', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ for Large Intestine, Female, v1.3. HuBMAP Human Reference Atlas. doi:10.48539/HBM682.RSXX.965', url: 'https://doi.org/10.48539/HBM682.RSXX.965', license: 'CC BY 4.0' },
    { id: 'hra-united', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ Set for Female, v1.5. HuBMAP Human Reference Atlas. doi:10.48539/HBM352.BTSQ.586', url: 'https://doi.org/10.48539/HBM352.BTSQ.586', license: 'CC BY 4.0' },
    {
      id: 'bodyparts3d',
      citation: 'Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37(Database issue):D782-5. doi:10.1093/nar/gkn613',
      url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',
      license: 'CC BY 4.0',
    },
  ],
  disclaimers: [
    'For learning only. This is not a clinical or diagnostic tool, and the explanations have not been reviewed by a physician.',
    'The organs are the HuBMAP female reference organs, based on the Visible Human dataset; real organs vary in size, shape and position, and the intestines move.',
    'The oesophagus and stomach come from a different reference body (BodyParts3D), fitted onto this one; their position and shape are approximate.',
    'The food and juice animations are schematic and much faster than in life.',
  ],
};
