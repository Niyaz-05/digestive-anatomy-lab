/**
 * UI and simulation state as a pure reducer, so every learner action is unit-testable without
 * rendering. The 3D scene only reads this state; it never owns selection or visibility itself.
 */
import type { SimulationDefinition, SliceAxis } from '../contract/schema';

export type Mode = 'explore' | 'digest' | 'tour';
export type ColourBy = 'real' | 'organ';

export interface Slice {
  axis: SliceAxis;
  /** Position across the brain, -1 … 1. */
  at: number;
  /** Keep the other side of the cut. */
  flip: boolean;
}

export interface LabState {
  mode: Mode;
  selected: string | null;
  hovered: string | null;
  visibleLayers: ReadonlySet<string>;
  isolate: boolean;
  labels: boolean;
  colourBy: ColourBy;
  slice: Slice;
  /** Food and juice animations running. */
  playing: boolean;
  /** In Digestion mode: show the food journey and/or the juice flow. */
  food: boolean;
  juices: boolean;
  tourIndex: number;
  /** A camera move the scene should perform; the nonce makes repeat requests distinct. */
  camera: { preset: string; focus: readonly string[]; nonce: number };
}

export type LabAction =
  | { type: 'select'; id: string | null }
  | { type: 'hover'; id: string | null }
  | { type: 'toggle-layer'; layer: string }
  | { type: 'set-isolate'; value: boolean }
  | { type: 'set-labels'; value: boolean }
  | { type: 'set-colour-by'; value: ColourBy }
  | { type: 'set-slice'; axis?: SliceAxis; at?: number; flip?: boolean }
  | { type: 'set-mode'; mode: Mode }
  | { type: 'set-playing'; value: boolean }
  | { type: 'set-food'; value: boolean }
  | { type: 'set-juices'; value: boolean }
  | { type: 'tour-go'; index: number }
  | { type: 'camera'; preset: string; focus?: readonly string[] }
  | { type: 'reset' };

const NO_SLICE: Slice = { axis: 'off', at: 0, flip: false };

export function initialState(def: SimulationDefinition): LabState {
  return {
    mode: 'explore',
    selected: null,
    hovered: null,
    visibleLayers: new Set(def.layers.filter((l) => l.visibleByDefault).map((l) => l.id)),
    isolate: false,
    labels: false,
    colourBy: 'real',
    slice: NO_SLICE,
    playing: true,
    food: true,
    juices: true,
    tourIndex: 0,
    camera: { preset: def.defaultCamera, focus: [], nonce: 0 },
  };
}

/** Ids that a selection or tour step highlights: a group stands for its members. */
export function highlightedIds(def: SimulationDefinition, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const s = def.structures.find((x) => x.id === id);
    if (!s) continue;
    if (s.kind === 'group') s.members?.forEach((m) => out.add(m));
    else out.add(id);
  }
  return out;
}

/** The structures currently in focus: the selection in explore/digest, the step's focus in a tour. */
export function focusIds(def: SimulationDefinition, state: LabState): string[] {
  if (state.mode === 'tour') return [...(def.tour[state.tourIndex]?.focus ?? [])];
  return state.selected ? [state.selected] : [];
}

/** True while the food journey should run. */
export function foodActive(def: SimulationDefinition, state: LabState): boolean {
  if (state.mode === 'digest') return state.food;
  return state.mode === 'tour' && def.tour[state.tourIndex]?.food === true;
}

/** True while bile and pancreatic juice should flow. */
export function juicesActive(def: SimulationDefinition, state: LabState): boolean {
  if (state.mode === 'digest') return state.juices;
  return state.mode === 'tour' && def.tour[state.tourIndex]?.juices === true;
}

/** The colour mode in effect: a tour step can set its own. */
export function effectiveColourBy(def: SimulationDefinition, state: LabState): ColourBy {
  if (state.mode === 'tour') return def.tour[state.tourIndex]?.colourBy ?? 'real';
  return state.colourBy;
}

/** The cut in effect: a tour step can set its own; otherwise the learner's. */
export function effectiveSlice(def: SimulationDefinition, state: LabState): Slice {
  if (state.mode === 'tour') {
    const s = def.tour[state.tourIndex]?.slice;
    return s ? { axis: s.axis, at: s.at, flip: false } : NO_SLICE;
  }
  return state.slice;
}

/**
 * Whether a mesh structure is drawn. Hidden layers hide their meshes, except that a highlighted
 * structure is always shown. With isolate on, only highlighted structures are drawn.
 */
export function isVisible(def: SimulationDefinition, state: LabState, id: string): boolean {
  const s = def.structures.find((x) => x.id === id);
  if (!s) return false;
  const lit = highlightedIds(def, focusIds(def, state));
  if (lit.has(id)) return true;
  if (state.isolate && lit.size > 0) return false;
  return state.visibleLayers.has(s.layer);
}

/**
 * The camera preset that looks at the cut face. The cut keeps the side below the plane on its axis
 * (x: the patient's right, z: the back, y: the lower part), or the side above it when flipped, so
 * the camera looks from the removed side.
 */
export function facingPreset(slice: Slice): string | null {
  switch (slice.axis) {
    case 'sagittal': return slice.flip ? 'right' : 'left';
    case 'coronal': return slice.flip ? 'posterior' : 'anterior';
    case 'axial': return slice.flip ? 'inferior' : 'superior';
    default: return null;
  }
}

/** What the cut leaves in view, for the panel's hint. */
export function keptHalf(slice: Slice): string | null {
  switch (slice.axis) {
    case 'sagittal': return slice.flip ? 'the left half (patient’s left)' : 'the right half (patient’s right)';
    case 'coronal': return slice.flip ? 'the front half' : 'the back half';
    case 'axial': return slice.flip ? 'the upper half' : 'the lower half';
    default: return null;
  }
}

export function makeReducer(def: SimulationDefinition) {
  const known = new Set(def.structures.map((s) => s.id));
  const layers = new Set(def.layers.map((l) => l.id));
  const presets = new Set(def.cameraPresets.map((c) => c.id));

  return function reduce(state: LabState, action: LabAction): LabState {
    switch (action.type) {
      case 'select': {
        if (action.id !== null && !known.has(action.id)) return state;
        const selected = action.id === state.selected ? null : action.id;
        return { ...state, selected, isolate: selected ? state.isolate : false };
      }
      case 'hover':
        return action.id === state.hovered || (action.id !== null && !known.has(action.id)) ? state : { ...state, hovered: action.id };
      case 'toggle-layer': {
        if (!layers.has(action.layer)) return state;
        const next = new Set(state.visibleLayers);
        if (next.has(action.layer)) next.delete(action.layer);
        else next.add(action.layer);
        return { ...state, visibleLayers: next };
      }
      case 'set-isolate':
        return { ...state, isolate: action.value };
      case 'set-labels':
        return { ...state, labels: action.value };
      case 'set-colour-by':
        return action.value === state.colourBy ? state : { ...state, colourBy: action.value };
      case 'set-slice': {
        const at = action.at === undefined || !Number.isFinite(action.at) ? state.slice.at : Math.max(-1, Math.min(1, action.at));
        const axis = action.axis ?? state.slice.axis;
        // Choosing a new axis starts the cut in the middle.
        const fresh = action.axis !== undefined && action.axis !== state.slice.axis && action.at === undefined;
        const slice = { axis, at: fresh ? 0 : at, flip: action.flip ?? state.slice.flip };
        // A new axis or a flip turns the camera to face the cut, from the side the cut removed.
        const turned = axis !== 'off' && (axis !== state.slice.axis || slice.flip !== state.slice.flip);
        const preset = facingPreset(slice);
        if (!turned || !preset || !presets.has(preset)) return { ...state, slice };
        return { ...state, slice, camera: { preset, focus: [], nonce: state.camera.nonce + 1 } };
      }
      case 'set-mode': {
        if (action.mode === state.mode) return state;
        if (action.mode === 'tour') {
          const step = def.tour[0];
          return {
            ...state, mode: 'tour', tourIndex: 0, selected: null, isolate: false, playing: true,
            camera: { preset: step?.camera ?? def.defaultCamera, focus: step?.focus ?? [], nonce: state.camera.nonce + 1 },
          };
        }
        return { ...state, mode: action.mode, playing: true };
      }
      case 'set-playing':
        return { ...state, playing: action.value };
      case 'set-food':
        return { ...state, food: action.value };
      case 'set-juices':
        return { ...state, juices: action.value };
      case 'tour-go': {
        const index = Math.max(0, Math.min(def.tour.length - 1, action.index));
        const step = def.tour[index];
        if (!step) return state;
        return {
          ...state, mode: 'tour', tourIndex: index,
          camera: { preset: step.camera ?? state.camera.preset, focus: step.focus, nonce: state.camera.nonce + 1 },
        };
      }
      case 'camera':
        if (!presets.has(action.preset)) return state;
        return { ...state, camera: { preset: action.preset, focus: action.focus ?? [], nonce: state.camera.nonce + 1 } };
      case 'reset': {
        const fresh = initialState(def);
        return { ...fresh, camera: { ...fresh.camera, nonce: state.camera.nonce + 1 } };
      }
    }
  };
}
