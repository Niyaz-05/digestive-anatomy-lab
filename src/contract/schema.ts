/**
 * The simulation contract (digestive edition). A SimulationDefinition is plain, serialisable data:
 * it names approved assets by id, lists the structures and layers a learner can work with, and
 * declares the learning content (the route of food, the digestive juices, tour, objectives). The
 * runtime renders any definition that passes these schemas and the cross-reference checks in
 * validate.ts. Nothing in here may carry a URL (except https source links), a file path or code.
 */
import { z } from 'zod';

/** Lower-case kebab-case ids keep definitions portable and safe to use as DOM/URL keys. */
export const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lower-case kebab-case').max(64);
const Text = (max: number) => z.string().trim().min(1).max(max);
const Vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

export const Source = z.object({
  id: Id,
  citation: Text(400),
  url: z.url({ protocol: /^https$/ }).optional(),
  license: Text(80).optional(),
});
export type Source = z.infer<typeof Source>;

export const AssetRef = z.object({
  /** Key into the approved asset registry (assets.ts); never a path or URL. */
  id: Id,
  role: z.enum(['anatomy-model']),
});

export const Layer = z.object({
  id: Id,
  label: Text(60),
  description: Text(300),
  visibleByDefault: z.boolean(),
});
export type Layer = z.infer<typeof Layer>;

export const AnatomicalStructure = z.object({
  id: Id,
  label: Text(80),
  synonyms: z.array(Text(80)).max(12),
  layer: Id,
  /** mesh: a node of the same id exists in the model. group: no geometry; stands for `members`. */
  kind: z.enum(['mesh', 'group']),
  members: z.array(Id).min(1).max(30).optional(),
  side: z.enum(['right', 'left', 'midline']),
  /** Organ group this part belongs to (for example the duodenum's parts belong to the duodenum). */
  organ: Id.optional(),
  summary: Text(400),
  function: Text(700),
  related: z.array(Id).max(12),
  /** What the 3D model does and does not show for this structure. */
  modelNote: Text(400).optional(),
  sources: z.array(Id).min(1).max(6),
});
export type AnatomicalStructure = z.infer<typeof AnatomicalStructure>;

export const CameraPreset = z.object({
  id: Id,
  label: Text(40),
  /** Unit-ish vector from the model centre towards the camera, in model axes. */
  direction: Vec3,
  up: Vec3.optional(),
});
export type CameraPreset = z.infer<typeof CameraPreset>;

/** One stage of a route; off-model stages are explained in text only. */
export const RouteStep = z.object({
  structure: Id.optional(),
  offModel: z.enum(['mouth-pharynx', 'anal-canal', 'liver-cells', 'pancreatic-acini']).optional(),
  label: Text(80),
  /** What happens here (cited in the route's sources). */
  note: Text(400).optional(),
}).refine((s) => (s.structure === undefined) !== (s.offModel === undefined), {
  message: 'a route step names exactly one of structure or offModel',
});
export type RouteStep = z.infer<typeof RouteStep>;

export const Route = z.object({
  id: Id,
  label: Text(80),
  description: Text(500),
  steps: z.array(RouteStep).min(2).max(24),
  /** Facts shown beside the animation; each cited in `sources`. */
  facts: z.array(Text(300)).max(8),
  assumptions: z.array(Text(300)).min(1).max(8),
  sources: z.array(Id).min(1).max(6),
});
export type Route = z.infer<typeof Route>;

export const SliceAxis = z.enum(['off', 'sagittal', 'coronal', 'axial']);
export type SliceAxis = z.infer<typeof SliceAxis>;

export const TourStep = z.object({
  id: Id,
  title: Text(80),
  body: Text(700),
  focus: z.array(Id).max(16),
  camera: Id.optional(),
  /** Run the food journey and/or the juice flow for this step. */
  food: z.boolean().optional(),
  juices: z.boolean().optional(),
  /** Cut the model for this step: axis and position (-1 … 1 across the model). */
  slice: z.object({ axis: SliceAxis, at: z.number().min(-1).max(1) }).optional(),
  colourBy: z.enum(['real', 'organ']).optional(),
});
export type TourStep = z.infer<typeof TourStep>;

export const LearningObjective = z.object({ id: Id, text: Text(200) });

export const SimulationDefinition = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: Text(100),
  domain: z.enum(['biology']),
  simulationType: z.enum(['3d-anatomy']),
  audience: Text(120),
  summary: Text(500),
  learningObjectives: z.array(LearningObjective).min(1).max(12),
  assets: z.array(AssetRef).min(1).max(4),
  layers: z.array(Layer).min(1).max(16),
  structures: z.array(AnatomicalStructure).min(1).max(120),
  cameraPresets: z.array(CameraPreset).min(1).max(12),
  defaultCamera: Id,
  foodRoute: Route,
  juiceRoutes: z.array(Route).min(1).max(4),
  tour: z.array(TourStep).max(40),
  sources: z.array(Source).min(1).max(40),
  disclaimers: z.array(Text(400)).min(1).max(6),
});
export type SimulationDefinition = z.infer<typeof SimulationDefinition>;
