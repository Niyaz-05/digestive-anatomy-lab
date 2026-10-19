import type { AnatomicalStructure } from '../contract/schema';
import type { ColourBy } from '../app/state';
import type { TissueLook } from './tissue';

/**
 * Real-tissue looks as in a fresh specimen: glistening pink-grey oesophagus and stomach, pink-tan
 * small intestine, greyish-pink colon, deep red-brown liver, a green bile-stained gallbladder with
 * yellow-green bile ducts, and pale lobulated pancreas.
 */
const REAL: Record<string, TissueLook> = {
  oesophagus: { color: '#d39a90', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.35, sheenColor: '#ffd9d0', rim: 0.28, rimColor: '#ff8a7a', ao: 0.8, mottle: 0.2, mottleTint: '#a8706a' },
  stomach: { color: '#d7a199', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: '#ffe0d8', rim: 0.28, rimColor: '#ff8a7a', ao: 0.85, mottle: 0.25, mottleTint: '#a8746c' },
  small: { color: '#e2b29e', roughness: 0.4, clearcoat: 0.65, clearcoatRoughness: 0.22, sheen: 0.35, sheenColor: '#ffe6da', rim: 0.3, rimColor: '#ff8f78', ao: 0.9, mottle: 0.25, mottleTint: '#b07a68' },
  large: { color: '#d2aba3', roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.28, sheen: 0.35, sheenColor: '#f8e2dc', rim: 0.25, rimColor: '#f08c7e', ao: 0.9, mottle: 0.3, mottleTint: '#9c7a74' },
  liver: { color: '#7c2f26', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 0.2, sheenColor: '#d8968a', rim: 0.25, rimColor: '#c4473a', ao: 0.8, mottle: 0.2, mottleTint: '#561d17' },
  ligament: { color: '#e8dccb', roughness: 0.5, clearcoat: 0.4, sheen: 0.3, rim: 0.12, ao: 0.6, mottle: 0.1 },
  gallbladder: { color: '#5c8248', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 0.2, sheenColor: '#b8d8a0', rim: 0.25, rimColor: '#9ccf6a', ao: 0.7, mottle: 0.2, mottleTint: '#3e5a30' },
  duct: { color: '#b9ae66', roughness: 0.38, clearcoat: 0.6, sheen: 0.2, rim: 0.2, rimColor: '#e6d98a', ao: 0.6, mottle: 0.1 },
  pancreas: { color: '#e2c09a', roughness: 0.6, clearcoat: 0.3, sheen: 0.45, sheenColor: '#fff0dc', rim: 0.2, rimColor: '#ffc89a', ao: 0.85, mottle: 0.4, mottleTint: '#b38f68' },
  'pancreas-duct': { color: '#efe0bc', roughness: 0.4, clearcoat: 0.5, sheen: 0.2, rim: 0.15, ao: 0.6, mottle: 0.1 },
};

const SMALL = new Set(['duodenal-bulb', 'duodenum-superior', 'duodenum-descending', 'duodenum-horizontal', 'duodenum-ascending', 'jejunum', 'ileum', 'terminal-ileum']);
const LARGE = new Set(['ileocaecal-valve', 'caecum', 'appendix', 'ascending-colon', 'hepatic-flexure', 'transverse-colon', 'splenic-flexure', 'descending-colon', 'sigmoid-colon', 'rectum']);

/** Which look and which organ colour a structure takes. */
function kindOf(s: AnatomicalStructure): string {
  if (s.id === 'oesophagus' || s.id === 'stomach') return s.id;
  if (SMALL.has(s.id)) return 'small';
  if (LARGE.has(s.id)) return 'large';
  if (s.layer === 'liver' || s.layer === 'liver-segment') return 'liver';
  if (s.layer === 'ligament') return 'ligament';
  if (s.id === 'gallbladder') return 'gallbladder';
  if (s.layer === 'biliary') return 'duct';
  if (s.layer === 'pancreas-duct') return 'pancreas-duct';
  return 'pancreas';
}

export function realLook(s: AnatomicalStructure): TissueLook {
  return REAL[kindOf(s)] ?? REAL.small!;
}

/** One hue per organ (Colour: Organs). The duodenum, jejunum and ileum get shades of their own. */
export const ORGAN_COLOUR: Record<string, string> = {
  oesophagus: '#e07f5f',
  stomach: '#e3b448',
  duodenum: '#d1606f',
  jejunum: '#5fa68f',
  ileum: '#3f8f7a',
  large: '#6c8fd0',
  liver: '#9a5ab8',
  gallbladder: '#4f9a4a',
  duct: '#8fae3c',
  pancreas: '#e9913b',
  'pancreas-duct': '#f0b870',
  ligament: '#c9b8a8',
};
export const ORGAN_NAMES: Record<string, string> = {
  oesophagus: 'Oesophagus', stomach: 'Stomach', duodenum: 'Duodenum', jejunum: 'Jejunum', ileum: 'Ileum',
  large: 'Large intestine', liver: 'Liver', gallbladder: 'Gallbladder', duct: 'Bile ducts', pancreas: 'Pancreas',
};

function organKey(s: AnatomicalStructure): string {
  if (s.kind === 'group') {
    if (s.id === 'small-intestine') return 'jejunum';
    if (s.id === 'colon' || s.id === 'large-intestine') return 'large';
    if (s.id === 'liver-segments') return 'liver';
    if (s.id === 'biliary-tree') return 'duct';
    return s.id;
  }
  if (s.organ === 'duodenum') return 'duodenum';
  if (s.id === 'jejunum') return 'jejunum';
  if (s.id === 'ileum' || s.id === 'terminal-ileum') return 'ileum';
  return kindOf(s);
}

/** The colour a structure shows in the current colour mode. */
export function baseColour(s: AnatomicalStructure, colourBy: ColourBy): string {
  if (colourBy === 'organ' || s.kind === 'group') return ORGAN_COLOUR[organKey(s)] ?? realLook(s).color;
  return realLook(s).color;
}

/** Food bolus, bile and pancreatic juice. */
export const FOOD = '#8a5a2b';
export const BILE = '#4f9a3a';
export const PANCREATIC = '#e8b23a';

export const HIGHLIGHT = '#ffc94d';
export const HOVER = '#ffe7a8';

/** Cut-surface colours: what a slice through each tissue shows (wall and mucosa, organ tissue). */
const CUT: Record<string, string> = {
  oesophagus: '#c4837a', stomach: '#c98a80', small: '#d39a88', large: '#c29890',
  liver: '#6a261f', ligament: '#e2d4c2', gallbladder: '#4b6b39', duct: '#a39a58', pancreas: '#d6b48d', 'pancreas-duct': '#e6d6b0',
};
export function cutColour(s: AnatomicalStructure): string {
  return CUT[kindOf(s)] ?? '#c9a090';
}
