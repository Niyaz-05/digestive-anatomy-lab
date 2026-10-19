import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useLab } from '../app/LabContext';
import { effectiveColourBy, effectiveSlice, focusIds, foodActive, highlightedIds, isVisible, juicesActive } from '../app/state';
import type { AnatomicalStructure } from '../contract/schema';
import { homeBounds } from '../digestive/anchors';
import { baseColour, cutColour, HIGHLIGHT, HOVER, realLook } from './palette';
import { applyQuality, hasTissueData, makeTissueMaterial, quality, type TissueMaterial } from './tissue';

export const MODEL_URL = `${import.meta.env.BASE_URL}models/digestive.glb`;

const GREY = new THREE.Color('#a59a96');
const HIGHLIGHT_COLOUR = new THREE.Color(HIGHLIGHT);

/** Pointer travel (px) above which a press is treated as a drag (rotate), not a pick. */
const CLICK_SLOP = 5;

/** The cut shared with the label layer, so hits on the removed side can be ignored. */
export const clip = { plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), active: false };

/** Parts the bile and pancreatic juice pass through or into: kept solid while the juices flow. */
const JUICE_PATH = new Set(['biliary', 'pancreas-duct']);
const DUODENUM = new Set(['duodenal-bulb', 'duodenum-superior', 'duodenum-descending', 'duodenum-horizontal', 'duodenum-ascending']);

interface Cap { back: THREE.Mesh; front: THREE.Mesh; face: THREE.Mesh; material: THREE.MeshStandardMaterial }
interface Part {
  id: string;
  mesh: THREE.Mesh;
  material: TissueMaterial;
  structure: AnatomicalStructure;
  box: THREE.Box3;
  cap: Cap;
}

/**
 * Stencil capping (as in three.js' clipping-stencil example): back faces behind the cut add 1 and
 * front faces subtract 1, so the stencil is non-zero exactly where the cut passes through the
 * inside of a closed mesh. The face drawn there is the filled cut surface, in the tissue's colour.
 */
function makeCap(geometry: THREE.BufferGeometry, plane: THREE.Plane, order: number, colour: string): Cap {
  const stencilMat = (side: THREE.Side, op: THREE.StencilOp) => new THREE.MeshBasicMaterial({
    side, colorWrite: false, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: op, stencilZFail: op, stencilZPass: op,
    clippingPlanes: [plane],
  });
  const back = new THREE.Mesh(geometry, stencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp));
  const front = new THREE.Mesh(geometry, stencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp));
  back.renderOrder = front.renderOrder = order;
  const material = new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.75, metalness: 0, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  face.renderOrder = order + 0.1;
  for (const m of [back, front, face]) {
    m.visible = false;
    m.raycast = () => {}; // never pickable
    m.matrixAutoUpdate = m !== face;
  }
  return { back, front, face, material };
}

export function DigestiveModel({ onReady }: { onReady?: () => void }) {
  const { def, state, dispatch } = useLab();
  const gltf = useGLTF(MODEL_URL);
  const invalidate = useThree((s) => s.invalidate);
  const [lo, hi] = useMemo(() => homeBounds(def), [def]);

  const parts = useMemo(() => {
    const out = new Map<string, Part>();
    let order = 0;
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const id = o.name || o.parent?.name || '';
      const s = def.structures.find((x) => x.id === id);
      if (!s) return;
      const material = makeTissueMaterial(realLook(s), hasTissueData(o));
      material.clippingPlanes = [clip.plane];
      o.geometry.computeBoundingBox();
      const box = o.geometry.boundingBox!.clone();
      out.set(id, { id, mesh: o, material, structure: s, box, cap: makeCap(o.geometry, clip.plane, 10 + order * 2, cutColour(s)) });
      order++;
    });
    // Large structures first, so smaller ones inside them (ducts in the pancreas) draw their caps last.
    const sorted = [...out.values()].sort((a, b) => b.box.getSize(new THREE.Vector3()).lengthSq() - a.box.getSize(new THREE.Vector3()).lengthSq());
    sorted.forEach((p, i) => {
      p.cap.back.renderOrder = p.cap.front.renderOrder = 10 + i * 2;
      p.cap.face.renderOrder = 10 + i * 2 + 1;
    });
    return out;
  }, [gltf, def]);

  // Attach materials in an effect, not in useMemo: StrictMode may run the memo twice, and the
  // meshes must carry the materials this component actually updates. Dispose them on unmount.
  useLayoutEffect(() => {
    for (const p of parts.values()) {
      p.mesh.material = p.material;
      p.mesh.userData.structureId = p.id;
      gltf.scene.add(p.cap.back, p.cap.front, p.cap.face);
    }
    onReady?.();
    return () => parts.forEach((p) => {
      p.material.dispose();
      p.cap.material.dispose();
      (p.cap.back.material as THREE.Material).dispose();
      (p.cap.front.material as THREE.Material).dispose();
      p.cap.face.geometry.dispose();
      gltf.scene.remove(p.cap.back, p.cap.front, p.cap.face);
    });
  }, [parts, onReady, gltf]);

  // Follow quality changes (a slow device drops the costly coat and sheen).
  useEffect(() => quality.subscribe((level) => {
    for (const p of parts.values()) { applyQuality(p.material, level); p.material.needsUpdate = true; }
    invalidate();
  }), [parts, invalidate]);

  const focus = focusIds(def, state);
  const lit = highlightedIds(def, focus);
  const food = foodActive(def, state);
  const juices = juicesActive(def, state);
  const segmentsShown = state.visibleLayers.has('liver-segment');
  const colourBy = effectiveColourBy(def, state);
  const slice = effectiveSlice(def, state);

  // The cut plane: keeps the side where n·p + c ≥ 0. The plane stays attached to every material
  // (parked far outside the model when there is no cut), so turning a cut on or off never
  // recompiles the tissue shaders.
  useEffect(() => {
    const a = slice.axis;
    clip.active = a !== 'off';
    if (clip.active) {
      const axis = a === 'sagittal' ? 0 : a === 'axial' ? 1 : 2;
      const mid = (lo[axis]! + hi[axis]!) / 2, half = (hi[axis]! - lo[axis]!) / 2;
      const at = mid + slice.at * half;
      const n = new THREE.Vector3();
      n.setComponent(axis, slice.flip ? 1 : -1);
      clip.plane.set(n, slice.flip ? -at : at);
    } else {
      clip.plane.set(new THREE.Vector3(-1, 0, 0), 100);
    }
    invalidate();
  }, [slice.axis, slice.at, slice.flip, lo, hi, invalidate]);

  useEffect(() => {
    for (const p of parts.values()) {
      const s = p.structure;
      p.mesh.visible = isVisible(def, state, p.id);
      const isLit = lit.has(p.id);
      const isHover = state.hovered === p.id && !isLit;
      const dim = lit.size > 0 && !isLit;
      const painted = colourBy !== 'real';
      p.material.color.set(baseColour(s, colourBy));
      if (isLit && !painted) p.material.color.lerp(HIGHLIGHT_COLOUR, 0.35);
      else if (dim) p.material.color.lerp(GREY, 0.45);
      if (isLit) p.material.emissive.copy(painted ? p.material.color : HIGHLIGHT_COLOUR);
      else p.material.emissive.set(isHover ? HOVER : '#000000');
      p.material.emissiveIntensity = isLit ? (painted ? 0.22 : 0.3) : isHover ? 0.3 : 0;

      // While food travels, the organs turn see-through so the food shows inside them; while the
      // juices flow, the liver and the tract fade so the ducts, gallbladder and duodenum show.
      let opacity = 1;
      if (food) {
        if (JUICE_PATH.has(s.layer) && juices) opacity = 1;
        else if (s.layer === 'tract') opacity = isLit ? 0.6 : 0.32;
        else opacity = isLit ? 0.5 : 0.12;
      } else if (juices) {
        if (JUICE_PATH.has(s.layer)) opacity = 1;
        else if (s.id === 'gallbladder') opacity = 0.85;
        else if (DUODENUM.has(s.id)) opacity = isLit ? 0.7 : 0.45;
        else if (s.layer === 'pancreas') opacity = 0.35;
        else opacity = isLit ? 0.5 : 0.1;
      } else if (s.id === 'liver' && segmentsShown) {
        opacity = 0.22; // the segments inside the liver show through its surface
      }
      const transparent = opacity < 1;
      // Changing `transparent` changes the shader program; only flag an update when it flips.
      if (p.material.transparent !== transparent) p.material.needsUpdate = true;
      p.material.transparent = transparent;
      p.material.opacity = opacity;
      p.material.depthWrite = !transparent;
      p.mesh.renderOrder = transparent ? 2 : 0;

      // Cut faces: only for solid, visible parts.
      p.cap.material.color.set(colourBy !== 'real' ? baseColour(s, colourBy) : cutColour(s));
      if (isLit) p.cap.material.color.lerp(HIGHLIGHT_COLOUR, 0.3);
      else if (dim) p.cap.material.color.lerp(GREY, 0.35);
    }
    invalidate();
  }, [parts, def, state, lit, food, juices, segmentsShown, colourBy, invalidate]);

  // Keep each cap face on the plane, just large enough to cover its part's footprint (small faces
  // keep the cost low), and show it only where the plane crosses a solid part.
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const p of parts.values()) {
      const solid = p.mesh.visible && !p.material.transparent;
      const show = clip.active && solid && clip.plane.intersectsBox(p.box);
      p.cap.back.visible = p.cap.front.visible = p.cap.face.visible = show;
      if (show) {
        clip.plane.projectPoint(p.box.getCenter(tmp), tmp);
        p.cap.face.position.copy(tmp);
        p.cap.face.lookAt(tmp.x - clip.plane.normal.x, tmp.y - clip.plane.normal.y, tmp.z - clip.plane.normal.z);
        p.cap.face.scale.setScalar(p.box.getSize(size).length() * 1.05);
        p.cap.face.updateMatrix();
      }
    }
  });

  /** Ignore hits on the part of the model the cut has removed. */
  const removed = (e: ThreeEvent<PointerEvent | MouseEvent>) => clip.active && clip.plane.distanceToPoint(e.point) < 0;
  const pick = (e: ThreeEvent<MouseEvent>) => {
    const id = e.object.userData.structureId as string | undefined;
    if (!id || !e.object.visible || removed(e)) return; // let the event reach the next hit
    const m = (e.object as THREE.Mesh).material as THREE.Material;
    if (m.transparent && m.opacity < 0.2) return; // faded-out tissue is see-through to clicks
    e.stopPropagation();
    if (e.delta > CLICK_SLOP) return;
    dispatch({ type: 'select', id });
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    const id = e.object.userData.structureId as string | undefined;
    if (!id || !e.object.visible || removed(e)) return;
    const m = (e.object as THREE.Mesh).material as THREE.Material;
    if (m.transparent && m.opacity < 0.2) return;
    e.stopPropagation();
    dispatch({ type: 'hover', id });
    document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    if (e.object.userData.structureId === state.hovered) dispatch({ type: 'hover', id: null });
    document.body.style.cursor = '';
  };

  return <primitive object={gltf.scene} onClick={pick} onPointerOver={over} onPointerOut={out} />;
}
