import geometryJson from './generated/geometry.json';
import type { SimulationDefinition } from '../contract/schema';

export type Vec3 = [number, number, number];

interface G { centroid: number[]; bounds: number[][]; surfaceAnchor?: number[]; side: string; layer: string }
/** One organ's leg of a generated route: points through the inside of that organ. */
export interface RouteLeg { id: string; points: number[][]; interior?: string }

const raw = geometryJson.structures as unknown as Record<string, unknown>;
export const geometry = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('$'))) as Record<string, G>;
export const routes = raw.$routes as Record<string, RouteLeg[]>;

export const vec = (p: readonly number[]): Vec3 => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];

/** A point to hang a label on: on the structure's surface, or the middle of a group. */
export function anchorOf(def: SimulationDefinition, id: string): Vec3 | null {
  const g = geometry[id];
  if (g) return vec(g.surfaceAnchor ?? g.centroid);
  const s = def.structures.find((x) => x.id === id);
  if (s?.kind === 'group' && s.members) {
    const pts = s.members.map((m) => anchorOf(def, m)).filter((p): p is Vec3 => p !== null);
    if (!pts.length) return null;
    return [0, 1, 2].map((a) => pts.reduce((n, p) => n + p[a]!, 0) / pts.length) as Vec3;
  }
  return null;
}

/** Axis-aligned bounds of a set of structures (groups expand to their members). */
export function boundsOfIds(def: SimulationDefinition, ids: readonly string[]): [Vec3, Vec3] | null {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  const visit = (id: string) => {
    const g = geometry[id];
    if (g) {
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a]!, g.bounds[0]![a]!);
        hi[a] = Math.max(hi[a]!, g.bounds[1]![a]!);
      }
      return;
    }
    def.structures.find((x) => x.id === id)?.members?.forEach(visit);
  };
  ids.forEach(visit);
  return Number.isFinite(lo[0]) ? [lo, hi] : null;
}

/** Bounds of the default view: every organ in the model. */
export function homeBounds(def: SimulationDefinition): [Vec3, Vec3] {
  const ids = def.structures.filter((s) => s.kind === 'mesh').map((s) => s.id);
  return boundsOfIds(def, ids) ?? [[-0.15, -0.15, -0.15], [0.15, 0.15, 0.15]];
}

/**
 * One continuous path made of a route's legs, with the organ each point belongs to. Legs that
 * revisit the same duct (shared by several juice routes) are kept, since each route is separate.
 */
export function routePath(name: string): { points: Vec3[]; organ: string[] } {
  const legs = routes[name];
  if (!legs) throw new Error(`no route ${name}`);
  const points: Vec3[] = [], organ: string[] = [];
  for (const leg of legs) {
    for (const p of leg.points) {
      const v = vec(p);
      const last = points[points.length - 1];
      if (last && Math.hypot(v[0] - last[0], v[1] - last[1], v[2] - last[2]) < 1e-6) continue;
      points.push(v);
      organ.push(leg.id);
    }
  }
  return { points, organ };
}
