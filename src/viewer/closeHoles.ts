import * as THREE from 'three';

/** Vertices closer than this (metres) count as the same point when looking for holes. */
const WELD = 1e-5;

/**
 * A closed copy of a mesh for the stencil cut caps. Stencil capping counts the surfaces behind
 * the cut, so it only fills the cut face of a closed mesh; several source parts are open where
 * they were split from a neighbour or where vessels enter. Each hole (a loop of boundary edges)
 * is filled with a fan from its centroid, wound like the rest of the mesh. The visible tissue
 * keeps the original geometry. Returns the input unchanged when it has no holes.
 */
export function closeHoles(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const tri = index ? Array.from(index.array as ArrayLike<number>) : Array.from({ length: pos.count }, (_, i) => i);

  // Weld by position, so seams with split normals do not look like holes.
  const weld = new Map<string, number>();
  const id = new Uint32Array(pos.count);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x / WELD)},${Math.round(y / WELD)},${Math.round(z / WELD)}`;
    let v = weld.get(key);
    if (v === undefined) { v = points.length; weld.set(key, v); points.push(new THREE.Vector3(x, y, z)); }
    id[i] = v;
  }

  // Directed edges; a boundary edge a→b has no b→a.
  const directed = new Map<string, number>();
  const edgeKey = (a: number, b: number) => `${a}_${b}`;
  for (let t = 0; t + 2 < tri.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = id[tri[t + e]!]!, b = id[tri[t + ((e + 1) % 3)]!]!;
      if (a !== b) directed.set(edgeKey(a, b), (directed.get(edgeKey(a, b)) ?? 0) + 1);
    }
  }
  const next = new Map<number, number[]>();
  for (const k of directed.keys()) {
    const [a, b] = k.split('_').map(Number) as [number, number];
    if (directed.has(edgeKey(b, a))) continue;
    const list = next.get(a);
    if (list) list.push(b); else next.set(a, [b]);
  }
  if (next.size === 0) return geometry;

  // Chain boundary edges into loops (a vertex with several outgoing edges is used once per edge).
  const loops: number[][] = [];
  for (const start of [...next.keys()].sort((p, q) => p - q)) {
    while (next.get(start)?.length) {
      const loop = [start];
      let at = start;
      for (let guard = 0; guard < 1e6; guard++) {
        const outs = next.get(at);
        const to = outs?.shift();
        if (to === undefined || to === start) break;
        loop.push(to);
        at = to;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  if (loops.length === 0) return geometry;

  // Positions: the welded points plus one centroid per loop; triangles: the original plus the fans.
  const extra = loops.length;
  const out = new Float32Array((points.length + extra) * 3);
  points.forEach((p, i) => p.toArray(out, i * 3));
  const faces: number[] = [];
  for (let t = 0; t + 2 < tri.length; t += 3) {
    const a = id[tri[t]!]!, b = id[tri[t + 1]!]!, c = id[tri[t + 2]!]!;
    if (a !== b && b !== c && c !== a) faces.push(a, b, c);
  }
  loops.forEach((loop, i) => {
    const c = points.length + i;
    const centre = new THREE.Vector3();
    for (const v of loop) centre.add(points[v]!);
    centre.divideScalar(loop.length).toArray(out, c * 3);
    // The mesh holds a→b on the boundary, so the patch takes b→a: (b, a, centre).
    for (let j = 0; j < loop.length; j++) faces.push(loop[(j + 1) % loop.length]!, loop[j]!, c);
  });

  const closed = new THREE.BufferGeometry();
  closed.setAttribute('position', new THREE.BufferAttribute(out, 3));
  closed.setIndex(faces);
  closed.computeBoundingBox();
  closed.computeBoundingSphere();
  return closed;
}
