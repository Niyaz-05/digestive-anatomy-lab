import { describe, expect, it } from 'vitest';
import { digestiveDefinition as def } from '../../src/digestive/definition';
import { effectiveColourBy, effectiveSlice, foodActive, highlightedIds, initialState, isVisible, juicesActive, makeReducer } from '../../src/app/state';
import { searchStructures } from '../../src/app/search';

const reduce = makeReducer(def);

describe('lab state', () => {
  it('starts in anatomy mode, real colours, no cut, segments and ligaments hidden', () => {
    const s = initialState(def);
    expect(s.mode).toBe('explore');
    expect(s.colourBy).toBe('real');
    expect(s.slice.axis).toBe('off');
    expect(isVisible(def, s, 'stomach')).toBe(true);
    expect(isVisible(def, s, 'caudate-lobe')).toBe(false);
    expect(isVisible(def, s, 'falciform-ligament')).toBe(false);
  });

  it('selecting an organ highlights its parts', () => {
    const lit = highlightedIds(def, ['duodenum']);
    expect(lit.has('duodenum-descending')).toBe(true);
    expect(lit.has('jejunum')).toBe(false);
  });

  it('Digestion mode runs the food and the juices, each of which can be switched off', () => {
    let s = reduce(initialState(def), { type: 'set-mode', mode: 'digest' });
    expect(foodActive(def, s)).toBe(true);
    expect(juicesActive(def, s)).toBe(true);
    s = reduce(s, { type: 'set-food', value: false });
    expect(foodActive(def, s)).toBe(false);
    expect(juicesActive(def, s)).toBe(true);
    s = reduce(s, { type: 'set-mode', mode: 'explore' });
    expect(juicesActive(def, s)).toBe(false);
  });

  it('tour steps set their own animations, colours and cut', () => {
    let s = reduce(initialState(def), { type: 'set-mode', mode: 'tour' });
    expect(effectiveColourBy(def, s)).toBe('organ');
    s = reduce(s, { type: 'tour-go', index: def.tour.findIndex((t) => t.juices) });
    expect(juicesActive(def, s)).toBe(true);
    s = reduce(s, { type: 'tour-go', index: def.tour.findIndex((t) => t.slice) });
    expect(effectiveSlice(def, s).axis).toBe('coronal');
    s = reduce(s, { type: 'tour-go', index: def.tour.findIndex((t) => t.food) });
    expect(foodActive(def, s)).toBe(true);
  });

  it('the cut clamps its position', () => {
    let s = reduce(initialState(def), { type: 'set-slice', axis: 'axial' });
    s = reduce(s, { type: 'set-slice', at: -3 });
    expect(s.slice.at).toBe(-1);
  });
});

describe('search', () => {
  it('finds organs by name and synonym', () => {
    expect(searchStructures(def.structures, 'esophagus')[0]!.structure.id).toBe('oesophagus');
    expect(searchStructures(def.structures, 'cecum')[0]!.structure.id).toBe('caecum');
    expect(searchStructures(def.structures, 'ampulla of vater')[0]!.structure.id).toBe('hepatopancreatic-ampulla');
    expect(searchStructures(def.structures, 'bile duct').map((h) => h.structure.id)).toContain('common-bile-duct');
  });
});
