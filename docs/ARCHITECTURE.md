# Architecture

The digestive lab shares the heart, lungs and brain labs' design: a validated, data-only **`SimulationDefinition`** rendered by a generic viewer. The code is a deliberate copy of the brain lab, not a shared package, so each lab deploys independently.

## Differences from the brain lab

| Area | Digestive |
|---|---|
| Contract | Groups stand for organs (duodenum, small intestine, colon, large intestine, liver segments, bile ducts and gallbladder, pancreas). A part names its `organ`, which must list it. A `foodRoute` and `juiceRoutes` (steps with what happens there, facts, assumptions, sources) replace the CSF route. Tour steps can set `food`, `juices`, a `slice` and a `colourBy` |
| Validation | Route steps and sources must exist, juice-route ids must be unique, and a part's organ must be a group that lists it, on top of the shared checks |
| State | Modes `explore` / `digest` / `tour`; `colourBy` (real / organ); `slice`; `food` and `juices` toggles. `foodActive`, `juicesActive`, `effectiveColourBy` and `effectiveSlice` let a tour step override the learner's settings |
| Transparency | While food travels, the tract turns 32 % opaque and the other organs 12 %, so the bolus shows inside. While juices flow, the ducts stay solid, the gallbladder and duodenum stay mostly solid, and the liver and the rest fade. Showing the liver segments makes the liver surface see-through |
| Food | `FoodBolus` moves one bolus with a short trail along the whole generated route in 48 s. It publishes the current stage (`viewer/journey.ts`), which the Digestion panel follows. React re-renders only when the stage changes |
| Juices | `JuiceParticles` streams green bile along the right and left hepatic ducts and from the gallbladder, and gold pancreatic juice along the main and accessory pancreatic ducts, into the duodenum |
| Cut | The brain lab's stencil-capped cut (`DigestiveModel.tsx`); cut faces show each organ's wall or tissue colour |

The real-tissue look (`tissue.ts`, `Lighting.tsx`, `tools/bake-shading.mjs`) is the same in every lab; see the brain lab's ARCHITECTURE.md.

## Asset pipeline

```
HRA female organs (official: liver, pancreas, small and large intestine) ───┐
HRA united-female v1.5 (Female Atlas; y − 0.7948 m): gallbladder, ducts ────┤
BodyParts3D oesophagus + stomach (Human Atlas) ─ affine fit ─ refine ─ mould ┴─ tools/extract-digestive.mjs
        │  51 nodes, 56,555 triangles; food and juice routes through the organs
        └─ tools/bake-shading.mjs ─▶ public/models/digestive.glb (1.2 MB) · geometry.json · provenance.json
```

**Cross-check.** Every node of the official organ files matches the same part of the united body after the converter's translation (within a few millimetres, due to that build's simplification). The official files are at higher resolution, so they are the primary source.

**Fitting the stomach**, in three steps:

1. **Affine fit to 11 landmark organs.** The duodenum, pancreas, gallbladder, caudate lobe, ascending, transverse and descending colon, rectum, spleen and both kidneys. Each landmark must lie on the same side in both bodies. The misfit is 18 mm RMS, because a male and a female abdomen differ.
2. **Refinement.** A deterministic coordinate search over shift, rotation and uniform scale, applied to the stomach and oesophagus together. It brings HRA's contact surfaces onto them: the liver's gastric impression and the spleen's gastric surface onto the stomach, and the oesophageal impression onto the oesophagus. It also keeps the pylorus on the duodenal bulb and penalises overlap with the liver, pancreas, colon, spleen and kidney. Results: 5.8 mm contact misfit (median), the pylorus within 1 mm, scale 0.88.
3. **Moulding.** Stomach vertices still inside a neighbour are moved onto its surface, then the stomach is smoothed (Taubin, shrink-free). This repeats up to 11 times, with the cardia and pylorus fixed, leaving 0.03 % overlap.

**Routes through the organs.** For each organ, in route order:

- **Entry and exit:** the entry is the point that touches the previous organ, and the exit the point that touches the next. The model's tract is continuous: every join is under 1 mm.
- **Interior voxels:** the organ is voxelised at up to 2 mm. A voxel counts as interior by ray parity; where the mesh is open or double-walled, the fallback is "enclosed in at least 4 of 6 directions".
- **Path:** Dijkstra finds the cheapest path through the interior voxels. Its step cost rises near the wall, so the path runs down the middle of the tube. The path is then smoothed (Chaikin) and thinned to one point every 4 mm.
- **Thinnest ducts:** the left hepatic duct and the two pancreatic ducts use slice centroids along their main axis instead.
