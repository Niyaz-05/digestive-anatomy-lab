import { describe, expect, it } from 'vitest';
import { digestiveDefinition as def } from '../../src/digestive/definition';
import { validateDefinition } from '../../src/contract/validate';
import { geometry, routePath, routes } from '../../src/digestive/anchors';
import { stageOf } from '../../src/viewer/journey';
import provenance from '../../src/digestive/generated/provenance.json';

const meshes = def.structures.filter((s) => s.kind === 'mesh');
const byId = (id: string) => def.structures.find((s) => s.id === id)!;
const inBox = (p: number[], id: string, pad = 0.004) => {
  const [lo, hi] = geometry[id]!.bounds;
  return [0, 1, 2].every((a) => p[a]! >= lo![a]! - pad && p[a]! <= hi![a]! + pad);
};

describe('digestive definition', () => {
  it('passes the validation gate with no warnings', () => {
    const r = validateDefinition(def);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('has exactly one mesh structure per model node', () => {
    expect(new Set(meshes.map((s) => s.id))).toEqual(new Set(Object.keys(geometry)));
  });

  it('lists every part of an organ in that organ, and only there', () => {
    for (const s of meshes.filter((m) => m.organ)) expect(byId(s.organ!).members, s.id).toContain(s.id);
    expect(byId('duodenum').members).toHaveLength(5);
    expect(byId('large-intestine').members).toHaveLength(10);
    expect(byId('pancreas').members).toEqual(expect.arrayContaining(['pancreas-head', 'pancreas-tail', 'main-pancreatic-duct']));
  });

  it('places organs where they belong (+x is the patient’s left)', () => {
    const c = (id: string) => geometry[id]!.centroid;
    expect(c('liver')[0]).toBeLessThan(0);
    expect(c('stomach')[0]).toBeGreaterThan(c('liver')[0]!);
    expect(c('caecum')[0]).toBeLessThan(0);
    expect(c('descending-colon')[0]).toBeGreaterThan(0);
    expect(c('oesophagus')[1]).toBeGreaterThan(c('stomach')[1]!);
    expect(c('rectum')[1]).toBeLessThan(c('transverse-colon')[1]!);
    expect(c('gallbladder')[1]).toBeLessThan(c('liver')[1]!);
  });

  it('cites every structure, and only https sources', () => {
    for (const s of def.structures) expect(s.sources.length, s.id).toBeGreaterThan(0);
    for (const src of def.sources) if (src.url) expect(src.url.startsWith('https://')).toBe(true);
  });

  it('has a tour whose steps focus on real structures, with a journey, juice and cut step', () => {
    expect(def.tour.length).toBeGreaterThanOrEqual(10);
    for (const t of def.tour) for (const f of t.focus) expect(def.structures.some((s) => s.id === f), `${t.id}: ${f}`).toBe(true);
    expect(def.tour.some((t) => t.food)).toBe(true);
    expect(def.tour.some((t) => t.juices)).toBe(true);
    expect(def.tour.some((t) => t.slice)).toBe(true);
  });
});

describe('validation gate', () => {
  it('rejects a part whose organ does not list it, and an unknown route structure', () => {
    const broken = structuredClone(def);
    broken.structures.find((s) => s.id === 'jejunum')!.organ = 'colon';
    broken.foodRoute.steps[1] = { structure: 'gizzard', label: 'Gizzard' };
    const codes = validateDefinition(broken).issues.map((i) => i.code);
    expect(codes).toContain('group.organ-mismatch');
    expect(codes).toContain('ref.structure');
  });

  it('rejects an unapproved asset and insecure links', () => {
    const broken = structuredClone(def) as unknown as { assets: { id: string; role: string }[]; sources: { url: string }[] };
    broken.assets = [{ id: 'some-other-model', role: 'anatomy-model' }];
    expect(validateDefinition(broken).issues.map((i) => i.code)).toContain('asset.not-approved');
    const insecure = structuredClone(def) as unknown as { sources: { url: string }[] };
    insecure.sources[0]!.url = 'http://example.com';
    expect(validateDefinition(insecure).ok).toBe(false);
  });
});

describe('generated routes', () => {
  const tract = ['oesophagus', 'stomach', 'duodenal-bulb', 'duodenum-superior', 'duodenum-descending', 'duodenum-horizontal', 'duodenum-ascending', 'jejunum', 'ileum', 'terminal-ileum', 'caecum', 'ascending-colon', 'hepatic-flexure', 'transverse-colon', 'splenic-flexure', 'descending-colon', 'sigmoid-colon', 'rectum'];

  it('takes food through every part of the tract, in order', () => {
    expect(routes.food!.map((l) => l.id)).toEqual(tract);
  });

  it('keeps each leg of the food route inside its own organ', () => {
    for (const leg of routes.food!) {
      expect(leg.points.length, leg.id).toBeGreaterThan(1);
      const inside = leg.points.filter((p) => inBox(p, leg.id)).length;
      expect(inside / leg.points.length, leg.id).toBeGreaterThan(0.95);
    }
  });

  it('joins consecutive organs without gaps (the model tract is continuous)', () => {
    const gaps = provenance.routeGapsMm as Record<string, number>;
    for (let i = 0; i < tract.length - 1; i++) expect(gaps[`${tract[i]}→${tract[i + 1]}`], `${tract[i]}→${tract[i + 1]}`).toBeLessThan(2);
  });

  it('brings bile and pancreatic juice to the duodenum through the ampulla', () => {
    for (const name of ['bile-right', 'bile-left', 'bile-gallbladder', 'pancreatic']) {
      const legs = routes[name]!;
      expect(legs[legs.length - 1]!.id, name).toBe('hepatopancreatic-ampulla');
      const end = legs[legs.length - 1]!.points.at(-1)!;
      expect(inBox(end, 'duodenum-descending', 0.006), name).toBe(true);
    }
    expect(routes['bile-gallbladder']![0]!.id).toBe('gallbladder');
    expect(routes['pancreatic-accessory']![0]!.id).toBe('accessory-pancreatic-duct');
  });

  it('maps every part of the tract to a stage the food panel lists', () => {
    const stages = new Set(def.foodRoute.steps.map((s) => s.structure).filter(Boolean));
    for (const part of tract) expect(stages.has(stageOf(part)), part).toBe(true);
    expect(routePath('food').points.length).toBeGreaterThan(100);
  });

  it('fits the stomach onto its neighbours and keeps it out of them', () => {
    const fit = provenance.sources.bodyparts3d.refinement;
    expect(fit.after.gastricContactMedianMm).toBeLessThan(8);
    expect(fit.after.pylorusGapMm).toBeLessThan(3);
    expect(fit.moulding.stillInsidePct).toBeLessThan(2);
  });
});
