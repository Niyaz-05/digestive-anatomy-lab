import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { closeHoles } from '../../src/viewer/closeHoles';

/** Boundary edges (used once) and edges whose two triangles disagree on direction, after welding. */
function edgeReport(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const idx = g.getIndex()!.array;
  const weld = new Map<string, number>();
  const id = (i: number) => {
    const k = `${Math.round(pos.getX(i) / 1e-5)},${Math.round(pos.getY(i) / 1e-5)},${Math.round(pos.getZ(i) / 1e-5)}`;
    if (!weld.has(k)) weld.set(k, weld.size);
    return weld.get(k)!;
  };
  const directed = new Map<string, number>();
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = id(idx[t + e]!), b = id(idx[t + ((e + 1) % 3)]!);
      if (a !== b) directed.set(`${a}_${b}`, (directed.get(`${a}_${b}`) ?? 0) + 1);
    }
  }
  let open = 0, flipped = 0;
  for (const [k, n] of directed) {
    const [a, b] = k.split('_');
    if (!directed.has(`${b}_${a}`)) open++;
    if (n > 1) flipped++;
  }
  return { open, flipped };
}

describe('closeHoles', () => {
  it('closes an open-ended tube with patches wound like the tube', () => {
    const tube = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 16, 3, true);
    expect(edgeReport(tube).open).toBeGreaterThan(0);
    const closed = closeHoles(tube);
    expect(edgeReport(closed)).toEqual({ open: 0, flipped: 0 });
  });

  it('closes a box with a missing face', () => {
    const box = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    const idx = Array.from(box.getIndex()!.array).slice(6); // drop the +x face
    box.setIndex(idx);
    expect(edgeReport(box).open).toBe(4);
    expect(edgeReport(closeHoles(box))).toEqual({ open: 0, flipped: 0 });
  });

  it('returns a closed mesh unchanged', () => {
    const sphere = new THREE.SphereGeometry(0.01, 12, 8);
    expect(closeHoles(sphere)).toBe(sphere);
  });

  it('closes every part of the digestive model', async () => {
    const doc = await new NodeIO().readBinary(new Uint8Array(fs.readFileSync('public/models/digestive.glb')));
    let parts = 0;
    for (const node of doc.getRoot().listNodes()) {
      const prim = node.getMesh()?.listPrimitives()[0];
      if (!prim) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(prim.getAttribute('POSITION')!.getArray()!.slice(), 3));
      g.setIndex(new THREE.BufferAttribute(prim.getIndices()!.getArray()!.slice(), 1));
      expect(edgeReport(closeHoles(g)).open, node.getName()).toBe(0);
      parts++;
    }
    expect(parts).toBe(51);
  });
});
