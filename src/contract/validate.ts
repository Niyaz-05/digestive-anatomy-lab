/**
 * Validation gate for simulation definitions: schema first, then the cross-references a schema
 * cannot express (ids that must exist, assets that must be approved, mesh structures that must
 * have geometry, groups and organs that must point at real structures). Returns every issue.
 */
import { SimulationDefinition } from './schema';
import type { SimulationDefinition as Definition } from './schema';
import { APPROVED_ASSETS, type ApprovedAsset } from './assets';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; definition: SimulationDefinition; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

export function validateDefinition(
  input: unknown,
  assets: Readonly<Record<string, ApprovedAsset>> = APPROVED_ASSETS,
): ValidationResult {
  const parsed = SimulationDefinition.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        severity: 'error',
        code: `schema.${i.code}`,
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const def = parsed.data;
  const issues: ValidationIssue[] = [];
  const err = (code: string, path: string, message: string) => issues.push({ severity: 'error', code, path, message });

  const dupes = (ids: string[], path: string) => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) err('ref.duplicate-id', `${path}.${i}`, `duplicate id "${id}"`);
      seen.add(id);
    });
    return seen;
  };
  const layers = dupes(def.layers.map((l) => l.id), 'layers');
  const structures = dupes(def.structures.map((s) => s.id), 'structures');
  const sources = dupes(def.sources.map((s) => s.id), 'sources');
  const cameras = dupes(def.cameraPresets.map((c) => c.id), 'cameraPresets');
  dupes(def.tour.map((t) => t.id), 'tour');
  const groups = new Set(def.structures.filter((s) => s.kind === 'group').map((s) => s.id));


  const nodes = new Set<string>();
  def.assets.forEach((a, i) => {
    const approved = assets[a.id];
    if (!approved) err('asset.not-approved', `assets.${i}.id`, `asset "${a.id}" is not in the approved registry`);
    else approved.nodes.forEach((n) => nodes.add(n));
  });

  if (!cameras.has(def.defaultCamera)) err('ref.camera', 'defaultCamera', `unknown camera preset "${def.defaultCamera}"`);

  def.structures.forEach((s, i) => {
    const p = `structures.${i}`;
    if (!layers.has(s.layer)) err('ref.layer', `${p}.layer`, `unknown layer "${s.layer}"`);
    if (s.kind === 'mesh' && !nodes.has(s.id)) err('asset.missing-node', `${p}.id`, `no node "${s.id}" in the approved assets`);
    if (s.kind === 'group') {
      if (!s.members) err('group.members', `${p}.members`, 'a group needs its members');
      s.members?.forEach((m, j) => {
        if (!structures.has(m)) err('ref.structure', `${p}.members.${j}`, `unknown structure "${m}"`);
        if (groups.has(m)) err('group.nested', `${p}.members.${j}`, 'groups list mesh structures, not other groups');
      });
    }
    if (s.organ && !groups.has(s.organ)) err('ref.organ', `${p}.organ`, `organ "${s.organ}" is not a group structure`);
    s.related.forEach((r, j) => {
      if (!structures.has(r)) err('ref.structure', `${p}.related.${j}`, `unknown structure "${r}"`);
      if (r === s.id) err('ref.self', `${p}.related.${j}`, 'a structure cannot relate to itself');
    });
    s.sources.forEach((r, j) => {
      if (!sources.has(r)) err('ref.source', `${p}.sources.${j}`, `unknown source "${r}"`);
    });
  });

  const route = (r: Definition['foodRoute'], path: string) => {
    r.steps.forEach((st, j) => {
      if (st.structure && !structures.has(st.structure)) err('ref.structure', `${path}.steps.${j}.structure`, `unknown structure "${st.structure}"`);
    });
    r.sources.forEach((x, j) => {
      if (!sources.has(x)) err('ref.source', `${path}.sources.${j}`, `unknown source "${x}"`);
    });
  };
  route(def.foodRoute, 'foodRoute');
  def.juiceRoutes.forEach((r, i) => route(r, `juiceRoutes.${i}`));
  dupes(def.juiceRoutes.map((r) => r.id), 'juiceRoutes');

  // A part's organ must be a group that lists it.
  def.structures.forEach((s, i) => {
    if (s.organ && !def.structures.find((g) => g.id === s.organ)?.members?.includes(s.id)) {
      err('group.organ-mismatch', `structures.${i}.organ`, `organ "${s.organ}" does not list "${s.id}"`);
    }
  });

  def.tour.forEach((t, i) => {
    t.focus.forEach((f, j) => {
      if (!structures.has(f)) err('ref.structure', `tour.${i}.focus.${j}`, `unknown structure "${f}"`);
    });
    if (t.camera && !cameras.has(t.camera)) err('ref.camera', `tour.${i}.camera`, `unknown camera preset "${t.camera}"`);
  });

  for (const n of nodes) {
    if (!structures.has(n)) issues.push({ severity: 'warning', code: 'asset.unused-node', path: 'assets', message: `node "${n}" has no structure entry` });
  }

  const errors = issues.filter((x) => x.severity === 'error');
  return errors.length ? { ok: false, issues } : { ok: true, definition: def, issues };
}
