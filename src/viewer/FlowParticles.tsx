import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { routePath } from '../digestive/anchors';
import { BILE, FOOD, PANCREATIC } from './palette';
import { journey, stageOf } from './journey';

/** Seconds for the food to travel from the oesophagus to the rectum (schematic; in life 24–72 h). */
const JOURNEY_SECONDS = 48;
/** Juice particles per metre of duct, and their speed (m/s at the model's scale). */
const JUICE_DENSITY = 900;
const JUICE_SPEED = 0.006;

function curveOf(points: [number, number, number][]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
}

/**
 * The food bolus: one soft brown lump with a short trail, travelling the whole route at a steady
 * speed through the inside of each organ. The stage it is in is published for the panel.
 */
export function FoodBolus({ playing, reducedMotion }: { playing: boolean; reducedMotion: boolean }) {
  const route = useMemo(() => routePath('food'), []);
  const curve = useMemo(() => curveOf(route.points), [route]);
  // Arc-length position of every route point, to map the bolus's position back to an organ.
  const marks = useMemo(() => {
    const lengths = curve.getLengths(route.points.length * 8);
    const total = lengths[lengths.length - 1]!;
    return route.points.map((_, i) => lengths[Math.min(lengths.length - 1, i * 8)]! / total);
  }, [curve, route]);
  const TRAIL = 6;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const u = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.006, 16, 12), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: FOOD, roughness: 0.7, depthTest: false, transparent: true, opacity: 0.95 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); journey.setStage(null); }, [geometry, material]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  function place() {
    const m = mesh.current;
    if (!m) return;
    for (let k = 0; k < TRAIL; k++) {
      const t = Math.max(0, u.current - k * 0.004);
      curve.getPointAt(t, p);
      tmp.position.copy(p);
      tmp.scale.setScalar(k === 0 ? 1 : 0.55 - k * 0.06);
      tmp.updateMatrix();
      m.setMatrixAt(k, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    let i = 0;
    while (i < marks.length - 1 && marks[i + 1]! <= u.current) i++;
    journey.setStage(stageOf(route.organ[i]!));
  }

  useEffect(() => { place(); invalidate(); }, [curve]);

  useFrame((_, dt) => {
    if (!playing || reducedMotion) return;
    u.current = (u.current + Math.min(dt, 0.25) / JOURNEY_SECONDS) % 1;
    place();
  });

  return <instancedMesh ref={mesh} args={[geometry, material, TRAIL]} frustumCulled={false} renderOrder={6} />;
}

const JUICES: { route: string; colour: string }[] = [
  { route: 'bile-right', colour: BILE },
  { route: 'bile-left', colour: BILE },
  { route: 'bile-gallbladder', colour: BILE },
  { route: 'pancreatic', colour: PANCREATIC },
  { route: 'pancreatic-accessory', colour: PANCREATIC },
];

/** Bile (green) and pancreatic juice (gold) flowing along the ducts into the duodenum. */
export function JuiceParticles({ playing, reducedMotion }: { playing: boolean; reducedMotion: boolean }) {
  const tracks = useMemo(() => {
    let offset = 0;
    return JUICES.map((j) => {
      const curve = curveOf(routePath(j.route).points);
      const length = curve.getLength();
      const count = Math.max(10, Math.round(length * JUICE_DENSITY));
      const t = { ...j, curve, length, count, offset };
      offset += count;
      return t;
    });
  }, []);
  const total = tracks.reduce((n, t) => n + t.count, 0);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const travelled = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.0009, 8, 6), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, transparent: true, opacity: 0.95 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  function place(distance: number) {
    const m = mesh.current;
    if (!m) return;
    for (const t of tracks) {
      const shift = distance / t.length;
      for (let i = 0; i < t.count; i++) {
        t.curve.getPointAt((((i / t.count + shift) % 1) + 1) % 1, p);
        tmp.position.copy(p);
        tmp.updateMatrix();
        m.setMatrixAt(t.offset + i, tmp.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }

  useEffect(() => {
    const m = mesh.current;
    if (m) {
      const c = new THREE.Color();
      for (const t of tracks) for (let i = 0; i < t.count; i++) m.setColorAt(t.offset + i, c.set(t.colour));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    place(travelled.current);
    invalidate();
  }, [tracks]);

  useFrame((_, dt) => {
    if (!playing || reducedMotion) return;
    travelled.current += JUICE_SPEED * Math.min(dt, 0.25);
    place(travelled.current);
  });

  return <instancedMesh ref={mesh} args={[geometry, material, total]} frustumCulled={false} renderOrder={5} />;
}
