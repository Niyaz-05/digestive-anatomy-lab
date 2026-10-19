#!/usr/bin/env node
/**
 * Build public/models/digestive.glb from HRA female reference organs, the HRA united-female body
 * and BodyParts3D (oesophagus and stomach).
 *
 *   node tools/extract-digestive.mjs <Female Atlas models dir> <Human Atlas models dir>
 *
 *   official organ GLBs   paths in structures.source.json (officialFiles), downloaded to source/
 *   <Female Atlas dir>    repo3-female-atlas/public/models: HRA united-female v1.5, +0.794760942 m in y
 *                         (reversed here). Supplies the gallbladder and the bile and pancreatic ducts.
 *   <Human Atlas dir>     repo4-human-atlas/public/models: BodyParts3D 4.0 (metres, Y-up,
 *                         +x = patient's left). Supplies the oesophagus and stomach, which HRA lacks.
 *
 * Per mesh: weld, simplify with meshoptimizer within a 0.4 % relative error bound, merge into one
 * node per structure, recompute smooth normals. The BodyParts3D parts are registered onto the HRA
 * body by an affine transform fitted on landmark centroids. Also generates the food route through
 * the inside of each part of the tract, and the bile and pancreatic-juice routes through the ducts
 * (shortest paths through interior voxels, kept near the middle of each tube).
 * Writes public/models/digestive.glb, src/digestive/generated/geometry.json and provenance.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [femaleDir, humanDir] = process.argv.slice(2);
if (!femaleDir || !humanDir) {
  console.error('Usage: node tools/extract-digestive.mjs <female-atlas public/models dir> <human-atlas public/models dir>');
  process.exit(2);
}
await MeshoptSimplifier.ready;

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const spec = JSON.parse(fs.readFileSync(path.join(root, 'src/digestive/source/structures.source.json'), 'utf8'));
const SHIFT = spec.unitedYShift;
const MAX_ERROR = 0.004;

// ── Sources ────────────────────────────────────────────────────────────────
const official = {};
for (const [key, rel] of Object.entries(spec.officialFiles)) {
  const bytes = fs.readFileSync(path.join(root, rel));
  const doc = await new NodeIO().readBinary(new Uint8Array(bytes));
  official[key] = { rel, bytes, nodes: new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n])) };
}
function readOfficial(file, name) {
  const node = official[file]?.nodes.get(name);
  const mesh = node?.getMesh();
  if (!mesh) throw new Error(`${file}: node "${name}" missing or has no mesh`);
  const w = node.getWorldMatrix();
  const positions = [], indices = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
    const base = positions.length / 3;
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
      positions.push(w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]);
    }
    for (const i of idx) indices.push(i + base);
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

function atlasReader(dir) {
  const bytes = fs.readFileSync(path.join(dir, 'atlas.json'));
  const atlas = JSON.parse(bytes.toString('utf8'));
  const cache = new Map(), hashes = {};
  const chunk = (i) => {
    if (!cache.has(i)) {
      const file = path.join(dir, atlas.chunks[i].url.split('/').pop());
      const buf = fs.readFileSync(file);
      cache.set(i, buf);
      hashes[path.basename(file)] = sha256(buf);
    }
    return cache.get(i);
  };
  const read = (part) => {
    const b = chunk(part.chunk);
    return {
      positions: new Float32Array(b.buffer.slice(b.byteOffset + part.positions, b.byteOffset + part.positions + part.vertexCount * 12)),
      indices: new Uint32Array(b.buffer.slice(b.byteOffset + part.indices, b.byteOffset + part.indices + part.indexCount * 4)),
    };
  };
  return { bytes, atlas, byId: new Map(atlas.parts.map((p) => [p.id, p])), read, hashes };
}
const female = atlasReader(femaleDir);
const human = atlasReader(humanDir);
function readUnited(id) {
  const part = female.byId.get(id);
  if (!part) throw new Error(`united body: part "${id}" missing`);
  const raw = female.read(part);
  for (let i = 1; i < raw.positions.length; i += 3) raw.positions[i] -= SHIFT;
  return raw;
}
function readBp3d(id) {
  const part = human.byId.get(id);
  if (!part) throw new Error(`BodyParts3D: part "${id}" missing`);
  return { ...human.read(part), part };
}

// ── Mesh clean-up ───────────────────────────────────────────────────────────
function weld(positions, indices) {
  const map = new Map(), remap = new Uint32Array(positions.length / 3), out = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const key = `${Math.round(positions[i * 3] * 1e6)},${Math.round(positions[i * 3 + 1] * 1e6)},${Math.round(positions[i * 3 + 2] * 1e6)}`;
    let k = map.get(key);
    if (k === undefined) { k = out.length / 3; map.set(key, k); out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); }
    remap[i] = k;
  }
  const idx = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]], b = remap[indices[t + 1]], c = remap[indices[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { positions: Float32Array.from(out), indices: Uint32Array.from(idx) };
}
function smoothNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) { n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (len > 0) { n[i] /= len; n[i + 1] /= len; n[i + 2] /= len; } else { n[i + 1] = 1; }
  }
  return n;
}
function simplify(positions, indices) {
  const target = Math.min(indices.length, Math.max(96, Math.floor((indices.length * 0.25) / 3) * 3));
  const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, MAX_ERROR);
  const used = new Map(), pos = [];
  const idx = new Uint32Array(simplified.length);
  for (let i = 0; i < simplified.length; i++) {
    const v = simplified[i];
    let k = used.get(v);
    if (k === undefined) { k = pos.length / 3; used.set(v, k); pos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); }
    idx[i] = k;
  }
  return { positions: Float32Array.from(pos), indices: idx, error };
}
function mergePieces(pieces) {
  const vCount = pieces.reduce((n, p) => n + p.positions.length / 3, 0);
  const positions = new Float32Array(vCount * 3), indices = new Uint32Array(pieces.reduce((n, p) => n + p.indices.length, 0));
  let vo = 0, io = 0;
  for (const p of pieces) {
    positions.set(p.positions, vo * 3);
    for (let k = 0; k < p.indices.length; k++) indices[io + k] = p.indices[k] + vo;
    vo += p.positions.length / 3; io += p.indices.length;
  }
  return { positions, indices };
}
/** Midpoint subdivision: every triangle becomes four (for the coarse BodyParts3D parts). */
function subdivide(positions, indices) {
  const pos = Array.from(positions), idx = [];
  const mids = new Map();
  const mid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let m = mids.get(key);
    if (m === undefined) {
      m = pos.length / 3;
      pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2);
      mids.set(key, m);
    }
    return m;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}
/** Taubin smoothing (shrink-free): alternating Laplacian steps; `fixed` vertices do not move. */
function taubin(positions, indices, iterations, fixed = new Set()) {
  const n = positions.length / 3, nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  for (let it = 0; it < iterations * 2; it++) {
    const f = it % 2 === 0 ? 0.5 : -0.53;
    const next = Float32Array.from(positions);
    for (let v = 0; v < n; v++) {
      if (fixed.has(v) || !nb[v].size) continue;
      for (let a = 0; a < 3; a++) {
        let avg = 0;
        for (const u of nb[v]) avg += positions[u * 3 + a];
        avg /= nb[v].size;
        next[v * 3 + a] = positions[v * 3 + a] + f * (avg - positions[v * 3 + a]);
      }
    }
    positions.set(next);
  }
}
const bboxOf = (pos) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i + a]); hi[a] = Math.max(hi[a], pos[i + a]); }
  return [lo, hi];
};
function centroid(pos) {
  const c = [0, 0, 0], n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) c[a] += pos[i + a] / n;
  return c;
}

// ── Register BodyParts3D onto the HRA body ─────────────────────────────────
function solve4(M, b) {
  const a = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 5; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row, i) => row[4] / row[i]);
}
const reg = spec.registration.pairs.map(([bpName, ids]) => {
  const parts = human.atlas.parts.filter((p) => p.name === bpName);
  if (!parts.length) throw new Error(`registration: BodyParts3D "${bpName}" not found`);
  const src = centroid(mergePieces(parts.map(human.read)).positions);
  const dst = centroid(mergePieces(ids.map(readUnited)).positions);
  // Same side in both bodies, or the landmark is mislabelled.
  if (Math.abs(src[0]) > 0.02 && Math.sign(src[0]) !== Math.sign(dst[0])) throw new Error(`registration: ${bpName} lies on opposite sides (${src[0].toFixed(3)} vs ${dst[0].toFixed(3)})`);
  return { bpName, ids, src, dst };
});
const hom = reg.map((r) => [...r.src, 1]);
const AtA = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => hom.reduce((q, h) => q + h[i] * h[j], 0)));
const affine = [0, 1, 2].map((a) => solve4(AtA, [0, 1, 2, 3].map((i) => hom.reduce((q, h, k) => q + h[i] * reg[k].dst[a], 0))));
const applyAffine = (x, y, z) => affine.map((w) => w[0] * x + w[1] * y + w[2] * z + w[3]);
const residuals = reg.map((r) => ({ landmark: r.bpName, mm: r6(Math.hypot(...applyAffine(...r.src).map((v, a) => v - r.dst[a])) * 1000) }));
const rms = Math.sqrt(residuals.reduce((q, r) => q + r.mm ** 2, 0) / residuals.length);
if (rms > 25) throw new Error(`Registration too poor: RMS ${rms.toFixed(1)} mm\n${JSON.stringify(residuals)}`);

// ── Build structures ────────────────────────────────────────────────────────
let sourceTriangles = 0, maxError = 0;
const used = new Set();
function build(raws) {
  return mergePieces(raws.map((raw) => {
    for (const v of raw.positions) if (!Number.isFinite(v)) throw new Error('non-finite position');
    for (const i of raw.indices) if (i >= raw.positions.length / 3) throw new Error('index out of range');
    sourceTriangles += raw.indices.length / 3;
    const w = weld(raw.positions, raw.indices);
    const s = simplify(w.positions, w.indices);
    maxError = Math.max(maxError, s.error);
    return s;
  }));
}
const meshes = [];
const bp3dParts = {};
for (const s of spec.structures) {
  const raws = [];
  for (const [file, name] of s.official ?? []) {
    const key = `official:${file}:${name}`;
    if (used.has(key)) throw new Error(`${key} used twice`);
    used.add(key);
    raws.push(readOfficial(file, name));
  }
  for (const id of s.united ?? []) {
    if (used.has(`united:${id}`)) throw new Error(`${id} used twice`);
    used.add(`united:${id}`);
    raws.push(readUnited(id));
  }
  if (s.bp3d) {
    // BodyParts3D parts are already coarse: no simplification; subdivide once and smooth instead.
    const pieces = s.bp3d.map((id) => {
      const raw = readBp3d(id);
      bp3dParts[s.id] = [...(bp3dParts[s.id] ?? []), `${id} ${raw.part.name}`];
      sourceTriangles += raw.indices.length / 3;
      const pos = new Float32Array(raw.positions.length);
      for (let i = 0; i < pos.length; i += 3) pos.set(applyAffine(raw.positions[i], raw.positions[i + 1], raw.positions[i + 2]), i);
      const w = weld(pos, raw.indices);
      const sub = subdivide(w.positions, w.indices);
      taubin(sub.positions, sub.indices, 6);
      return sub;
    });
    meshes.push({ structure: s, ...mergePieces(pieces) });
    continue;
  }
  meshes.push({ structure: s, ...build(raws) });
}

// ── Refine the stomach onto its real contact surfaces ───────────────────────
// The two bodies differ, so the landmark fit leaves the stomach partly inside the liver. HRA marks
// where the stomach touches its neighbours (the liver's gastric impression, the spleen's gastric
// surface) and where the oesophagus lies on the liver. A deterministic coordinate search over
// shift, small rotation and scale (stomach and oesophagus together) brings those surfaces onto
// the stomach and oesophagus, keeps the pylorus on the duodenum, and avoids overlapping organs.
const meshBvh = (m) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return new MeshBVH(geo);
};
const patchPoints = (raw, every) => {
  const out = [];
  for (let i = 0; i < raw.positions.length; i += 3 * every) out.push(new THREE.Vector3(raw.positions[i], raw.positions[i + 1], raw.positions[i + 2]));
  return out;
};
const stomach = meshes.find((m) => m.structure.id === 'stomach');
const oesophagus = meshes.find((m) => m.structure.id === 'oesophagus');
const bulb = meshes.find((m) => m.structure.id === 'duodenal-bulb');
const unitedBlocker = (ids) => { const m = mergePieces(ids.map(readUnited)); return weld(m.positions, m.indices); };
const gastricTargets = [
  ...patchPoints(readOfficial('liver', 'VH_F_gastric_impression_of_liver'), 6),
  ...patchPoints(readUnited('VH_F_gastric_surface_of_spleen'), 2),
];
const oesoTargets = patchPoints(readOfficial('liver', 'VH_F_esophageal_impression_of_liver'), 3);
const blockers = [
  ...spec.refine.blockers.map((id) => meshBvh(meshes.find((m) => m.structure.id === id))),
  ...spec.refine.unitedBlockers.map((ids) => meshBvh(unitedBlocker(ids))),
];
const bulbBvh = meshBvh(bulb);
// Pylorus: the stomach vertex nearest the duodenal bulb after the landmark fit.
const hit = {};
let pylorus = null, pyGap = Infinity;
for (let i = 0; i < stomach.positions.length; i += 3) {
  const v = new THREE.Vector3(stomach.positions[i], stomach.positions[i + 1], stomach.positions[i + 2]);
  bulbBvh.closestPointToPoint(v, hit);
  if (hit.distance < pyGap) { pyGap = hit.distance; pylorus = v; }
}
const pivot = new THREE.Vector3(...centroid(stomach.positions));
const sampleVerts = (m, every) => patchPoints(m, every);
const stomachSample = sampleVerts(stomach, Math.max(1, Math.floor(stomach.positions.length / 3 / 400)));
const transformOf = ([tx, ty, tz, rx, ry, rz, s]) => new THREE.Matrix4()
  .makeTranslation(tx, ty, tz)
  .multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z))
  .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)))
  .multiply(new THREE.Matrix4().makeScale(s, s, s))
  .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
const testRay = new THREE.Ray();
function fitMetrics(params) {
  const T = transformOf(params), inv = T.clone().invert();
  const stBvh = stomach.bvhRef ??= meshBvh(stomach), oeBvh = oesophagus.bvhRef ??= meshBvh(oesophagus);
  const q = new THREE.Vector3(), r = {};
  // Distances from the contact patches to the moved surfaces (measured in the mesh's own frame).
  const scale = params[6];
  const gastric = gastricTargets.map((p) => { stBvh.closestPointToPoint(q.copy(p).applyMatrix4(inv), r); return r.distance * scale; });
  const oeso = oesoTargets.map((p) => { oeBvh.closestPointToPoint(q.copy(p).applyMatrix4(inv), r); return r.distance * scale; });
  let inside = 0;
  const insideBy = blockers.map(() => 0);
  for (const v of stomachSample) {
    q.copy(v).applyMatrix4(T);
    let any = false;
    blockers.forEach((b, bi) => {
      testRay.origin.copy(q); testRay.direction.set(1, 0.0013, 0.0007).normalize();
      if (b.raycast(testRay, THREE.DoubleSide).length % 2) { insideBy[bi]++; any = true; }
    });
    if (any) inside++;
  }
  bulbBvh.closestPointToPoint(q.copy(pylorus).applyMatrix4(T), r);
  const sorted = (a) => [...a].sort((x, y) => x - y);
  return { gastric: sorted(gastric), oeso: sorted(oeso), insideFrac: inside / stomachSample.length, insideBy: insideBy.map((n) => r6((100 * n) / stomachSample.length)), pylorusGap: r.distance };
}
function energy(params) {
  const m = fitMetrics(params);
  const meanSq = (a) => a.reduce((s, d) => s + Math.min(d, 0.03) ** 2, 0) / a.length;
  return meanSq(m.gastric) / 0.005 ** 2 + 0.5 * meanSq(m.oeso) / 0.005 ** 2 + 40 * m.insideFrac + (m.pylorusGap / 0.003) ** 2;
}
let params = [0, 0, 0, 0, 0, 0, 1];
const steps = [0.008, 0.008, 0.008, 0.08, 0.08, 0.08, 0.04];
const before = fitMetrics(params);
let best = energy(params);
for (let round = 0; round < 60 && steps[0] > 0.0004; round++) {
  let improved = false;
  for (let k = 0; k < 7; k++) {
    for (const sign of [1, -1]) {
      const trial = params.slice();
      trial[k] += sign * steps[k];
      if (k === 6 && (trial[6] < 0.85 || trial[6] > 1.15)) continue;
      const e = energy(trial);
      if (e < best - 1e-9) { best = e; params = trial; improved = true; }
    }
  }
  if (!improved) for (let k = 0; k < 7; k++) steps[k] /= 2;
}
const after = fitMetrics(params);
const median = (a) => a[a.length >> 1] * 1000;
const refine = {
  method: 'deterministic coordinate search over shift, rotation (about the stomach centroid) and uniform scale',
  params: { shiftMetres: params.slice(0, 3).map(r6), rotationRadians: params.slice(3, 6).map(r6), scale: r6(params[6]) },
  before: { gastricContactMedianMm: r6(median(before.gastric)), oesophagealContactMedianMm: r6(median(before.oeso)), stomachInsideNeighboursPct: r6(before.insideFrac * 100), pylorusGapMm: r6(before.pylorusGap * 1000) },
  after: { gastricContactMedianMm: r6(median(after.gastric)), oesophagealContactMedianMm: r6(median(after.oeso)), stomachInsideNeighboursPct: r6(after.insideFrac * 100), insidePctByNeighbour: Object.fromEntries([...spec.refine.blockers, 'spleen', 'left-kidney'].map((k, i) => [k, after.insideBy[i]])), pylorusGapMm: r6(after.pylorusGap * 1000) },
};
// Overlap left after this step is removed by moulding below; this only rejects a wild fit.
if (after.insideFrac > 0.3 || median(after.gastric) > 12 || after.pylorusGap > 0.004) throw new Error(`Stomach fit too poor:\n${JSON.stringify(refine, null, 2)}`);
const T = transformOf(params);
for (const m of [stomach, oesophagus]) {
  const v = new THREE.Vector3();
  for (let i = 0; i < m.positions.length; i += 3) { v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(T); m.positions[i] = v.x; m.positions[i + 1] = v.y; m.positions[i + 2] = v.z; }
  delete m.bvhRef;
}

// Mould the stomach against the organs it still overlaps: move vertices that lie inside a
// neighbour onto that neighbour's surface, then smooth, a few times. The junctions with the
// oesophagus and the duodenum stay fixed.
const mould = (() => {
  const dirs = [new THREE.Vector3(1, 0.0013, 0.0007).normalize(), new THREE.Vector3(0.0011, 1, 0.0017).normalize(), new THREE.Vector3(0.0009, 0.0015, 1).normalize()];
  const ray2 = new THREE.Ray();
  const isInside = (b, p) => dirs.filter((d) => { ray2.origin.copy(p); ray2.direction.copy(d); return b.raycast(ray2, THREE.DoubleSide).length % 2 === 1; }).length >= 2;
  const fixed = new Set();
  const py = new THREE.Vector3().copy(pylorus).applyMatrix4(T);
  const oeBox = bboxOf(oesophagus.positions);
  for (let v = 0; v < stomach.positions.length / 3; v++) {
    const p = new THREE.Vector3(stomach.positions[v * 3], stomach.positions[v * 3 + 1], stomach.positions[v * 3 + 2]);
    if (p.distanceTo(py) < 0.008) fixed.add(v);
    // Cardia: where the oesophagus joins (near the oesophagus's lower end).
    if (p.y < oeBox[0][1] + 0.012 && p.y > oeBox[0][1] - 0.01 && p.x > oeBox[0][0] - 0.004 && p.x < oeBox[1][0] + 0.004 && p.z > oeBox[0][2] - 0.004 && p.z < oeBox[1][2] + 0.004) fixed.add(v);
  }
  const res = {};
  const v3 = new THREE.Vector3();
  let moved = 0, passes = 0;
  const PASSES = 10;
  for (; passes <= PASSES; passes++) {
    let count = 0;
    for (let v = 0; v < stomach.positions.length / 3; v++) {
      if (fixed.has(v)) continue;
      v3.set(stomach.positions[v * 3], stomach.positions[v * 3 + 1], stomach.positions[v * 3 + 2]);
      for (const b of blockers) {
        if (!isInside(b, v3)) continue;
        b.closestPointToPoint(v3, res);
        const out = res.point.clone().sub(v3).normalize();
        v3.copy(res.point).addScaledVector(out, 0.0008);
        stomach.positions.set([v3.x, v3.y, v3.z], v * 3);
        count++;
      }
    }
    moved += count;
    if (!count) break;
    // Smooth after every pass except the last, which only pushes vertices out.
    if (passes < PASSES) taubin(stomach.positions, stomach.indices, 2, fixed);
  }
  let still = 0, free = 0;
  const n = stomach.positions.length / 3;
  for (let v = 0; v < n; v++) {
    if (fixed.has(v)) continue;
    free++;
    v3.set(stomach.positions[v * 3], stomach.positions[v * 3 + 1], stomach.positions[v * 3 + 2]);
    if (blockers.some((b) => isInside(b, v3))) still++;
  }
  return { passes, verticesMoved: moved, stillInsidePct: r6((100 * still) / free), fixedJunctionVertices: fixed.size };
})();
refine.moulding = mould;
if (mould.stillInsidePct > 2) throw new Error(`Stomach still overlaps its neighbours after moulding: ${JSON.stringify(mould)}`);

// Centre on the tract and its organs (bounding box).
const boxes = meshes.map((m) => bboxOf(m.positions));
const centre = [0, 1, 2].map((a) => (Math.min(...boxes.map((b) => b[0][a])) + Math.max(...boxes.map((b) => b[1][a]))) / 2);
for (const m of meshes) {
  for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) m.positions[i + a] -= centre[a];
  m.normals = smoothNormals(m.positions, m.indices);
}
const byId = new Map(meshes.map((m) => [m.structure.id, m]));

// ── Interior paths ──────────────────────────────────────────────────────────
const ray = new THREE.Ray();
function bvhOf(m) {
  if (!m.bvh) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    m.bvh = new MeshBVH(g);
  }
  return m.bvh;
}
const DIRS = [new THREE.Vector3(1, 0.0013, 0.0007).normalize(), new THREE.Vector3(0.0011, 1, 0.0017).normalize(), new THREE.Vector3(0.0009, 0.0015, 1).normalize()];
function insideMesh(bvh, p) {
  let odd = 0;
  for (const d of DIRS) {
    ray.origin.set(p[0], p[1], p[2]); ray.direction.copy(d);
    if (bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1) odd++;
  }
  return odd >= 2;
}
/** Nearest vertex of mesh A to mesh B (and the gap between them). */
function contact(a, b) {
  const C = 0.004, grid = new Map();
  for (let i = 0; i < b.positions.length; i += 3) {
    const k = `${Math.floor(b.positions[i] / C)},${Math.floor(b.positions[i + 1] / C)},${Math.floor(b.positions[i + 2] / C)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
  }
  let best = Infinity, at = 0;
  for (let i = 0; i < a.positions.length; i += 3) {
    const [x, y, z] = [a.positions[i], a.positions[i + 1], a.positions[i + 2]];
    const g = [Math.floor(x / C), Math.floor(y / C), Math.floor(z / C)];
    for (let r = 0; r <= 12 && best > (r - 1) * C; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
        const cell = grid.get(`${g[0] + dx},${g[1] + dy},${g[2] + dz}`);
        if (!cell) continue;
        for (const j of cell) {
          const d = Math.hypot(b.positions[j] - x, b.positions[j + 1] - y, b.positions[j + 2] - z);
          if (d < best) { best = d; at = i; }
        }
      }
    }
  }
  return { point: [a.positions[at], a.positions[at + 1], a.positions[at + 2]], gap: best };
}
/**
 * Path inside a closed tube from near `from` to near `to`: Dijkstra over interior voxels, with a
 * cost that grows near the wall, so the path runs down the middle. Returns null if the interior
 * does not connect the two ends.
 */
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => new THREE.Vector3(d[0] + 0.0013, d[1] + 0.0011, d[2] + 0.0007).normalize());
/** Enclosed: rays in at least 4 of the 6 axis directions hit the mesh (holds inside open or double-walled tubes). */
function enclosed(bvh, p) {
  let hits = 0;
  for (const d of AXES) {
    ray.origin.set(p[0], p[1], p[2]); ray.direction.copy(d);
    if (bvh.raycastFirst(ray, THREE.DoubleSide)) hits++;
  }
  return hits >= 4;
}
function interiorPath(m, from, to, mode = 'parity') {
  const [lo, hi] = bboxOf(m.positions);
  const minDim = Math.min(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const h = Math.min(0.002, Math.max(0.0004, minDim / 8));
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a] - lo[a]) / h)));
  const bvh = bvhOf(m);
  const total = n[0] * n[1] * n[2];
  const inside = new Uint8Array(total);
  const at = (i, j, k) => (k * n[1] + j) * n[0] + i;
  const centreOf = (v) => {
    const i = v % n[0], j = Math.floor(v / n[0]) % n[1], k = Math.floor(v / (n[0] * n[1]));
    return [lo[0] + (i + 0.5) * h, lo[1] + (j + 0.5) * h, lo[2] + (k + 0.5) * h];
  };
  const test = mode === 'parity' ? insideMesh : enclosed;
  for (let v = 0; v < total; v++) inside[v] = test(bvh, centreOf(v)) ? 1 : 0;
  // Distance (in voxels) from the wall, by breadth-first growth from the boundary.
  const depth = new Int16Array(total).fill(-1);
  const queue = [];
  const nb6 = (v) => {
    const i = v % n[0], j = Math.floor(v / n[0]) % n[1], k = Math.floor(v / (n[0] * n[1]));
    const out = [];
    if (i > 0) out.push(v - 1); if (i < n[0] - 1) out.push(v + 1);
    if (j > 0) out.push(v - n[0]); if (j < n[1] - 1) out.push(v + n[0]);
    if (k > 0) out.push(v - n[0] * n[1]); if (k < n[2] - 1) out.push(v + n[0] * n[1]);
    return out;
  };
  for (let v = 0; v < total; v++) {
    if (!inside[v]) continue;
    if (nb6(v).length < 6 || nb6(v).some((u) => !inside[u])) { depth[v] = 1; queue.push(v); }
  }
  for (let q = 0; q < queue.length; q++) for (const u of nb6(queue[q])) if (inside[u] && depth[u] < 0) { depth[u] = depth[queue[q]] + 1; queue.push(u); }
  const nearestInside = (p) => {
    let best = -1, bd = Infinity;
    for (let v = 0; v < total; v++) {
      if (!inside[v]) continue;
      const c = centreOf(v), d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };
  const s = nearestInside(from), t = nearestInside(to);
  if (s < 0 || t < 0) return null;
  // Dijkstra with a binary heap; 26-neighbourhood.
  const dist = new Float64Array(total).fill(Infinity), prev = new Int32Array(total).fill(-1);
  const heap = [];
  const push = (v, d) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  dist[s] = 0; push(s, 0);
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    if (v === t) break;
    const i = v % n[0], j = Math.floor(v / n[0]) % n[1], k = Math.floor(v / (n[0] * n[1]));
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      const a = i + dx, b = j + dy, c = k + dz;
      if (a < 0 || b < 0 || c < 0 || a >= n[0] || b >= n[1] || c >= n[2]) continue;
      const u = at(a, b, c);
      if (!inside[u]) continue;
      const step = Math.hypot(dx, dy, dz) * (1 + 6 / (depth[u] * depth[u]));
      if (d + step < dist[u]) { dist[u] = d + step; prev[u] = v; push(u, d + step); }
    }
  }
  if (!Number.isFinite(dist[t])) return null;
  const voxels = [];
  for (let v = t; v >= 0; v = prev[v]) voxels.push(v);
  voxels.reverse();
  // Thin out and smooth (Chaikin) the voxel staircase.
  let pts = voxels.filter((_, i) => i % 3 === 0 || i === voxels.length - 1).map(centreOf);
  for (let it = 0; it < 2; it++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push(a.map((v, q) => 0.75 * v + 0.25 * b[q]), a.map((v, q) => 0.25 * v + 0.75 * b[q]));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  // Keep about one point per 4 mm.
  const kept = [pts[0]];
  for (const p of pts.slice(1)) if (Math.hypot(...p.map((v, q) => v - kept[kept.length - 1][q])) >= 0.004) kept.push(p);
  if (kept[kept.length - 1] !== pts[pts.length - 1]) kept.push(pts[pts.length - 1]);
  return { points: kept.map((p) => p.map(r6)), voxel: h, interior: mode, maxDepthMm: r6(Math.max(...voxels.map((v) => depth[v])) * h * 1000) };
}

/** Centroids of 10 slices along the mesh's main axis, ordered from `from` to `to`. */
function slicedCentreline(m, from, to) {
  const pos = m.positions, c = centroid(pos);
  const cov = new Array(9).fill(0), n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - c[0], pos[i + 1] - c[1], pos[i + 2] - c[2]];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) cov[r * 3 + k] += (d[r] * d[k]) / n;
  }
  let axis = [1, 0.5, 0.25];
  for (let it = 0; it < 100; it++) {
    const w = [0, 1, 2].map((r) => cov[r * 3] * axis[0] + cov[r * 3 + 1] * axis[1] + cov[r * 3 + 2] * axis[2]);
    const len = Math.hypot(...w); axis = w.map((x) => x / len);
  }
  const t = (p) => (p[0] - c[0]) * axis[0] + (p[1] - c[1]) * axis[1] + (p[2] - c[2]) * axis[2];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { const v = t([pos[i], pos[i + 1], pos[i + 2]]); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = lo + ((hi - lo) * k) / 10, b = lo + ((hi - lo) * (k + 1)) / 10;
    const acc = [0, 0, 0]; let cnt = 0;
    for (let i = 0; i < pos.length; i += 3) { const v = t([pos[i], pos[i + 1], pos[i + 2]]); if (v >= a && v <= b) { acc[0] += pos[i]; acc[1] += pos[i + 1]; acc[2] += pos[i + 2]; cnt++; } }
    if (cnt) pts.push(acc.map((x) => x / cnt));
  }
  if (t(from) > t(to)) pts.reverse();
  return [from, ...pts, to];
}
const routes = {};
const gaps = {};
const fallbacks = [];
function chainPath(ids, { start, end } = {}) {
  const legs = [];
  for (let i = 0; i < ids.length; i++) {
    const m = byId.get(ids[i]);
    if (!m) throw new Error(`route: unknown structure ${ids[i]}`);
    const prevM = i > 0 ? byId.get(ids[i - 1]) : null, nextM = i < ids.length - 1 ? byId.get(ids[i + 1]) : null;
    let from = prevM ? contact(m, prevM).point : start(m);
    let to = nextM ? contact(m, nextM).point : end(m);
    if (nextM) gaps[`${ids[i]}→${ids[i + 1]}`] = r6(contact(m, nextM).gap * 1000);
    const p = interiorPath(m, from, to) ?? interiorPath(m, from, to, 'enclosed');
    if (!p) {
      // Very thin ducts: follow the centreline (slice centroids along the main axis) instead.
      fallbacks.push(ids[i]);
      legs.push({ id: ids[i], points: slicedCentreline(m, from, to).map((q) => q.map(r6)), interior: 'centreline' });
      continue;
    }
    legs.push({ id: ids[i], ...p });
  }
  return legs;
}
const topOf = (m) => { let best = 0; for (let i = 1; i < m.positions.length; i += 3) if (m.positions[i] > m.positions[best + 1]) best = i - 1; return [m.positions[best], m.positions[best + 1], m.positions[best + 2]]; };
const bottomOf = (m) => { let best = 0; for (let i = 1; i < m.positions.length; i += 3) if (m.positions[i] < m.positions[best + 1]) best = i - 1; return [m.positions[best], m.positions[best + 1], m.positions[best + 2]]; };
const farthestFrom = (other) => (m) => {
  const c = centroid(byId.get(other).positions);
  let best = 0, bd = -1;
  for (let i = 0; i < m.positions.length; i += 3) { const d = Math.hypot(m.positions[i] - c[0], m.positions[i + 1] - c[1], m.positions[i + 2] - c[2]); if (d > bd) { bd = d; best = i; } }
  return [m.positions[best], m.positions[best + 1], m.positions[best + 2]];
};
const t0 = Date.now();
if (spec.foodRoute) routes.food = chainPath(spec.foodRoute, { start: topOf, end: bottomOf });
for (const [name, r] of Object.entries(spec.juiceRoutes ?? {})) {
  routes[name] = chainPath(r.ids, { start: farthestFrom(r.ids[1] ?? r.into), end: (m) => contact(m, byId.get(r.into)).point });
}
const pathSeconds = (Date.now() - t0) / 1000;

// ── Geometry facts ──────────────────────────────────────────────────────────
const geometry = {};
const sideErrors = [];
for (const m of meshes) {
  const s = m.structure;
  const [lo, hi] = bboxOf(m.positions);
  const c = centroid(m.positions);
  if (s.sideCheck !== false) {
    if (s.side === 'right' && !(c[0] < 0.005)) sideErrors.push(`${s.id} claims right but centroid x = ${c[0].toFixed(4)}`);
    if (s.side === 'left' && !(c[0] > -0.005)) sideErrors.push(`${s.id} claims left but centroid x = ${c[0].toFixed(4)}`);
  }
  let nearest = 0, nearestD = Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const d = Math.hypot(m.positions[i] - c[0], m.positions[i + 1] - c[1], m.positions[i + 2] - c[2]);
    if (d < nearestD) { nearestD = d; nearest = i; }
  }
  geometry[s.id] = {
    layer: s.layer, side: s.side,
    bounds: [lo.map(r6), hi.map(r6)],
    centroid: c.map(r6),
    surfaceAnchor: [m.positions[nearest], m.positions[nearest + 1], m.positions[nearest + 2]].map(r6),
    vertexCount: m.positions.length / 3,
    triangleCount: m.indices.length / 3,
  };
}
if (sideErrors.length) throw new Error(`Side checks failed:\n${sideErrors.join('\n')}`);
geometry.$routes = routes;
const g = (id) => geometry[id];
const checks = {
  oesophagusAboveStomach: g('oesophagus').centroid[1] > g('stomach').centroid[1],
  stomachLeftOfLiver: g('stomach').centroid[0] > g('liver').centroid[0],
  liverAboveTransverseColon: g('liver').centroid[1] > g('transverse-colon').centroid[1],
  caecumOnRight: g('caecum').centroid[0] < 0,
  rectumLowest: g('rectum').centroid[1] < g('sigmoid-colon').centroid[1] + 0.02,
  gallbladderUnderLiver: g('gallbladder').centroid[1] < g('liver').centroid[1],
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
if (failed.length) throw new Error(`Orientation checks failed: ${failed.join(', ')}`);

// ── Write ───────────────────────────────────────────────────────────────────
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('digestive');
for (const m of meshes) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.normals).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.positions.length / 3 < 65536 ? Uint16Array.from(m.indices) : m.indices).setBuffer(buffer));
  const s = m.structure;
  scene.addChild(doc.createNode(s.id).setMesh(doc.createMesh(s.id).addPrimitive(prim)).setExtras({
    layer: s.layer,
    source: s.bp3d ? 'bodyparts3d' : s.united ? 'hra-united-female' : 'hra-organ',
    nodes: [...(s.official ?? []).map(([f, n]) => `${f}:${n}`), ...(s.united ?? []), ...(s.bp3d ?? [])],
  }));
}
doc.getRoot().getAsset().generator = 'digestive-anatomy-lab tools/extract-digestive.mjs';
doc.getRoot().getAsset().copyright = 'HuBMAP HRA 3D reference organs (Browne, Schlehlein et al.), CC BY 4.0; BodyParts3D (DBCLS), CC BY 4.0';
const outGlb = path.join(root, 'public/models/digestive.glb');
fs.mkdirSync(path.dirname(outGlb), { recursive: true });
const glb = await new NodeIO().writeBinary(doc);
fs.writeFileSync(outGlb, glb);

const commit = (dir) => { try { return execFileSync('git', ['-C', path.resolve(dir, '../..'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } };
const genDir = path.join(root, 'src/digestive/generated');
fs.mkdirSync(genDir, { recursive: true });
fs.writeFileSync(path.join(genDir, 'geometry.json'), JSON.stringify({ units: 'metres', axes: { x: "patient's left", y: 'superior', z: 'anterior' }, structures: geometry }, null, 2) + '\n');
const triangles = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
const ORGANS = {
  liver: { name: '3D Reference Organ for Liver, Female, v1.2', doi: 'https://doi.org/10.48539/HBM599.GZLD.639' },
  pancreas: { name: '3D Reference Organ for Pancreas, Female, v1.3', doi: 'https://doi.org/10.48539/HBM866.PNNZ.328' },
  'small-intestine': { name: '3D Reference Organ for Small Intestine, Female, v1.2', doi: 'https://doi.org/10.48539/HBM784.FBXB.245' },
  'large-intestine': { name: '3D Reference Organ for Large Intestine, Female, v1.3', doi: 'https://doi.org/10.48539/HBM682.RSXX.965' },
};
fs.writeFileSync(path.join(genDir, 'provenance.json'), JSON.stringify({
  output: { file: 'public/models/digestive.glb', bytes: glb.byteLength, sha256: sha256(glb), triangles, sourceTriangles },
  sources: {
    organs: Object.fromEntries(Object.entries(official).map(([k, o]) => [k, {
      ...ORGANS[k], creators: 'Kristen Browne, Heidi Schlehlein', license: 'CC-BY-4.0',
      url: `https://cdn.humanatlas.io/digital-objects/ref-organ/${o.rel.includes('liver') ? 'liver-female/v1.2' : o.rel.includes('pancreas') ? 'pancreas-female/v1.3' : o.rel.includes('small') ? 'small-intestine-female/v1.2' : 'large-intestine-female/v1.3'}/assets/${path.basename(o.rel)}`,
      bytes: o.bytes.byteLength, sha256: sha256(o.bytes),
    }])),
    united: {
      name: '3D Reference Organ Set for Female v1.5 (HuBMAP HRA united female), as converted by Female Atlas',
      creators: 'Kristen Browne, Heidi Schlehlein', doi: 'https://doi.org/10.48539/HBM352.BTSQ.586', license: 'CC-BY-4.0',
      intermediate: 'github.com/Niyaz-05/female-atlas, commit ' + commit(femaleDir),
      atlasJsonSha256: sha256(female.bytes), chunkSha256: female.hashes,
      transformReversed: `y - ${SHIFT} m (the official organ files match these parts after this translation, within a few millimetres of simplification)`,
    },
    bodyparts3d: {
      name: 'BodyParts3D 4.0 (Database Center for Life Science), via the Human Atlas build', license: 'CC-BY-4.0',
      intermediate: 'github.com/Niyaz-05/human-atlas, commit ' + commit(humanDir),
      atlasJsonSha256: sha256(human.bytes), chunkSha256: human.hashes,
      parts: bp3dParts,
      registration: { method: 'affine (3x4) least squares on landmark centroids', affineRows: affine.map((r) => r.map(r6)), rmsResidualMm: r6(rms), residuals },
      refinement: refine,
    },
  },
  changesHere: `Selected and merged the source meshes in src/digestive/source/structures.source.json; welded coincident vertices; simplified each mesh with meshoptimizer within a ${MAX_ERROR * 100} % relative error bound (largest error used: ${(maxError * 100).toFixed(3)} %); recomputed smooth normals; registered the BodyParts3D oesophagus and stomach onto the HRA body; translated so the centre of the model is the origin.`,
  centreOffsetMetres: centre.map(r6),
  orientationChecks: checks,
  routeGapsMm: gaps,
  routeCentrelineFallbacks: fallbacks,
  structures: spec.structures.map((s) => ({ id: s.id, official: s.official, united: s.united, bp3d: s.bp3d })),
}, null, 2) + '\n');

console.log(JSON.stringify({ structures: meshes.length, sourceTriangles, triangles, bytes: glb.byteLength, maxErrorPct: r6(maxError * 100), registrationRmsMm: r6(rms), refine, gaps, fallbacks, pathSeconds, checks }, null, 2));
