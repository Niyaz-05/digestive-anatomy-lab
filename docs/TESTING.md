# Testing

Results recorded on 2026-10-19 on Windows 11, Node 22.14.0, headless Chromium (Playwright 1.64, software WebGL via SwiftShader, which uses the automatic low-quality mode).

## Commands

| Check | Command | What it covers |
|---|---|---|
| Types | `npm run typecheck` | TypeScript strict, `noUncheckedIndexedAccess` |
| Unit | `npm test` | Cut-face mesh closing (`closeHoles`) and the camera turning to face a cut. Definition passes the validation gate with no warnings; one mesh structure per model node; each part listed in its own organ and only there; organs on the correct side (+x is the patient's left); every structure cited, https only; tour focus ids, with a journey, a juice and a cut step. Validation-gate rejections (organ mismatch, unknown route structure, unapproved asset, insecure link). Generated routes: food passes every part of the tract in order, each leg stays inside its organ, consecutive organs join without gaps, bile and pancreatic juice reach the duodenum through the ampulla, every tract part maps to a stage in the food panel, the stomach touches its neighbours without entering them. Reducer (initial state, organ highlight, Digestion toggles, tour overrides, cut clamping); search (names and synonyms) |
| Assets | `npm run validate:assets` | GLB sha256 = provenance, node set = geometry record, finite positions, unit normals, indices in range, triangle counts, baked `_TISSUE` on every mesh, attribution names HuBMAP, the four organ DOIs, the united-body DOI, BodyParts3D, DBCLS, CC BY 4.0 and the source and output hashes |
| Determinism | re-run `tools/extract-digestive.mjs` then `tools/bake-shading.mjs` | Byte-identical `digestive.glb` |
| Build | `npm run build` | Type check + production bundle |
| E2E | `npm run build && npm run e2e` | 17 scenarios below; screenshots in `docs/screenshots/` |

## E2E scenarios (`tests/e2e/lab.spec.ts`)

1. Loads with no console errors; real colours by default; no details sheet on the main screen.
2. Clicking the model selects the structure under the pointer.
3. Search: "esophagus" + Enter selects the oesophagus; "ampulla of vater" finds the hepatopancreatic ampulla; no-match message; Escape restores the list.
4. The duodenum lists its 5 parts; a part links back to its organ.
5. Colour by Organs changes the rendered colours.
6. Layer toggles: liver segments show, the digestive tract hides.
7. Isolate, Zoom to and Reset.
8. Camera presets change the view.
9. Labels mode: at least 3 labels, none overlapping.
10. Cut: coronal and axial cuts change the view, Off removes the slider; no console errors.
11. Digestion mode: the food moves from one stage to the next, the panel shows bile and pancreatic juice, Pause/Play, switching food off hides its stage; no console errors (marked slow).
12. Guided tour: 11 steps, Next/Back, the duodenum juice step, jump to a step, Finish (marked slow: camera flights and a cut under software WebGL).
13. Phone 390×844: no horizontal overflow; Structures opens from the dock; picking closes it and shows the details.
14. About (ⓘ): HuBMAP and BodyParts3D credits, CC BY 4.0; Escape closes.
15. `?nowebgl`: fallback message; the list and details still work.
16. Missing model (HTTP 404): error alert; Try again refetches and loads.
17. Reduced motion: Digestion mode without errors.

## Results

| Check | Result |
|---|---|
| `npm run typecheck` | **Pass** |
| `npm test` | **Pass**: 20/20 in 2 files |
| `npm run validate:assets` | **Pass**: 51 nodes, 56,555 triangles, sha256 `6f8dae786587…` |
| Determinism | **Pass**: re-extraction gives the recorded unbaked sha256 (`d30b73ad060c…`) and re-baking the recorded final sha256 (`6f8dae786587…`) |
| `npm run build` | **Pass**. JS bundle about 1.44 MB (about 400 kB gzip); Vite warns about chunk size |
| `npm run e2e` | **Pass**: 17/17 in 9.0 min (Digestion 58 s, tour 2.2 min) |
| Live site (2026-10-19) | **Pass**: https://digestive-anatomy-lab.vercel.app returns the page; `models/digestive.glb` is served with the recorded sha256 `6f8dae786587…`; the model renders in headless Chromium with no console errors |

## Cut fix (2026-10-19)

Reported in Chrome: the cut faces had holes, the cut face was often out of view, it was not clear which half was kept, and the faces looked flat. Checked in headless Chromium on the reporter's GPU (AMD Radeon, ANGLE Direct3D 11) before and after the fix, with Side, Front and Top cuts, each with and without Flip.

- **Holes.** Stencil capping needs closed meshes. 47 of the 51 digestive parts (the HuBMAP organ parts) are open where they were split from a neighbour or where vessels enter, so, for example, the liver's front cut showed the background through it. The stencil passes now use a closed copy of each part (`src/viewer/closeHoles.ts`: weld, find boundary loops, fan-fill them). The visible tissue and the model file are unchanged.
- **Cut face out of view.** Choosing a cut, or pressing Flip, now turns the camera to the removed side: Side → Left side (Right side when flipped), Front → Front (Back), Top → Top (Bottom).
- **Which half is kept.** The panel shows it under the slider, for example "Showing the back half".
- **Flat faces.** Cut faces have a soft, deterministic noise grain of the same size on every part, and a moister finish (roughness 0.5).

| Check | Result |
|---|---|
| `npm run typecheck` | **Pass** |
| `npm test` | **Pass**: 25/25 in 3 files, including `closeHoles` (open tube, open box, closed sphere unchanged, all 51 digestive parts closed) and the camera follow |
| `npm run validate:assets` | **Pass**: model unchanged (`6f8dae786587…`) |
| `npm run e2e` | **Pass**: 17/17 in 8.0 min; the cut test also checks the camera preset and the kept-half hint |
| GPU screenshots | All 6 cut and flip cases face the cut, with filled cut faces and no console errors |

## Defects found and fixed during QA

- **The fitted stomach overlapped its neighbours** (16–35 % of its vertices inside the liver, spleen or colon after the landmark fit). Fixed with the contact-surface refinement and the moulding pass (0.03 % left), recorded in `provenance.json`.
- **Food and juice paths failed in some organs.** Ray parity breaks on open or double-walled meshes, and the thinnest ducts have no interior voxels at 2 mm. Fixed with the "enclosed" fallback and slice centroids for the left hepatic and pancreatic ducts.
- **The oesophagus note was wrong.** It said only the lower part is modelled; the whole oesophagus is.
- **A stray copied tool** (`tools/extract-lungs.mjs`) was removed.

## Phone and tablet layouts

Added 2026-10-28, the same layer as the heart lab: `src/app/layout.ts` (the layout from the screen size: `desktop`, `sheet` for phones and portrait tablets, `landscape` for phones on their side), `src/ui/Sheet.tsx` (the details as a bottom sheet with a handle: tap to step peek / half / full, drag to follow the finger, drag down or flick to close) and a "Phones and tablets" block in `src/styles.css` (safe-area insets, finger-sized controls, a mode row that scrolls sideways). Picking a structure frames it above the sheet and hides the title and mode buttons until the details close; a tap on empty space closes them too.

`tests/e2e/responsive.spec.ts` (the same file in every lab) runs at 390×844, 844×390, 768×1024, 820×1180, 1024×768 and 1366×820 (touch emulation below 1024 px): no horizontal scroll; title, modes, dock and sheet on screen and not overlapping; room left for the model; finger-sized controls; the sheet folds, opens and expands by tap, keyboard and drag; the picked structure's label stays above the sheet; closing by ✕, by a tap on empty space and by dragging down (real touch events); a mode's own panel keeps the mode buttons and cannot be dismissed; every mode fits and scrolls to its end. Screenshots are in `docs/screenshots/responsive/`.

**Result (2026-10-28):** the whole GPU suite (this lab's own scenarios and the layout checks), installed Chrome, AMD Radeon integrated GPU: **48 passed in 4.6 min**.

**Not verified:** physical phones and tablets (only Chrome's device emulation at the six sizes), notches and safe areas on a real device, multi-finger gestures, the on-screen keyboard over the search box, and Safari and Firefox.

## Not verified

- **Physical devices and GPUs.** All browser tests used software WebGL. High quality was reviewed in headless screenshots with `?quality=high`; frame rate on a real laptop or phone is not measured.
- **Other browsers.** Firefox and Safari were not run.
- **Automated accessibility audit.** axe-core is not installed. Keyboard paths and ARIA labels were checked by hand and by E2E only.
- **Anatomical review.** The text was checked against OpenStax A&P 2e §23.3–23.6. No anatomist or physician has reviewed it.
- **The stomach and oesophagus fit is approximate.** They come from a male body (BodyParts3D) fitted to the female HRA organs: 18 mm RMS landmark misfit, then 5.8 mm median contact misfit after refinement, at scale 0.88.
- **The routes are schematic.** The food moves at a steady speed through the middle of each organ, compressed into 48 s; times in life are given in the panel. The mouth, pharynx and anal canal are not modelled.
