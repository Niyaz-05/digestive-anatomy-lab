#!/usr/bin/env node
/**
 * Lists the nodes of the official HRA digestive organ files and checks each against the same
 * part in the HRA united-female body (as converted by Female Atlas, y + 0.794760942 m): same
 * vertex count and a pure translation means the two are the same mesh.
 *
 *   node tools/inspect-sources.mjs <female-atlas public/models dir> <glb> [<glb> …]
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';

const [modelsDir, ...files] = process.argv.slice(2);
const atlas = JSON.parse(fs.readFileSync(path.join(modelsDir, 'atlas.json'), 'utf8'));
const parts = new Map(atlas.parts.map((p) => [p.id, p]));
const chunks = new Map();
const chunk = (i) => {
  if (!chunks.has(i)) chunks.set(i, fs.readFileSync(path.join(modelsDir, atlas.chunks[i].url.split('/').pop())));
  return chunks.get(i);
};
const centroid = (pos) => {
  const c = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) c[a] += pos[i + a];
  return c.map((v) => v / (pos.length / 3));
};
for (const file of files) {
  const doc = await new NodeIO().readBinary(new Uint8Array(fs.readFileSync(file)));
  console.log(`\n== ${path.basename(file)}`);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = node.getWorldMatrix();
    const pos = [];
    let tris = 0;
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION').getArray();
      tris += (prim.getIndices()?.getCount() ?? p.length / 3) / 3;
      for (let i = 0; i < p.length; i += 3) {
        const [x, y, z] = [p[i], p[i + 1], p[i + 2]];
        pos.push(w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]);
      }
    }
    const c = centroid(pos);
    const u = parts.get(node.getName());
    let match = 'not in united body';
    if (u) {
      const b = chunk(u.chunk);
      const up = new Float32Array(b.buffer.slice(b.byteOffset + u.positions, b.byteOffset + u.positions + u.vertexCount * 12));
      const uc = centroid(up);
      match = `united: ${u.vertexCount === pos.length / 3 ? 'same vertex count' : `vertices ${u.vertexCount} vs ${pos.length / 3}`}, offset ${uc.map((v, a) => (v - c[a]).toFixed(6)).join(', ')}`;
    }
    console.log(`${String(tris).padStart(6)}  ${c.map((v) => v.toFixed(4)).join(',')}  ${node.getName()}  |  ${match}`);
  }
}
