# Attribution and asset provenance

## 3D digestive model — `models/digestive.glb`

### Sources

1. **HuBMAP Human Reference Atlas (HRA) 3D reference organs, female**, by **Kristen Browne and Heidi Schlehlein** (and HRA contributors). Licensed **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).

   | Organ | Version and DOI | File | Bytes | sha256 |
   |---|---|---|---|---|
   | Liver | v1.2, https://doi.org/10.48539/HBM599.GZLD.639 | `3d-vh-f-liver.glb` | 1,738,552 | `2ab712216dc8af026f87c43b0ad783273fffdf080bb312bcb4c34724f53e5fa6` |
   | Pancreas | v1.3, https://doi.org/10.48539/HBM866.PNNZ.328 | `3d-vh-f-pancreas.glb` | 714,832 | `553411dfc0391d305191a8f204c88e9fd3c05f7a2c7501023914728f294d8b4e` |
   | Small intestine | v1.2, https://doi.org/10.48539/HBM784.FBXB.245 | `3d-vh-f-small-intestine.glb` | 856,536 | `850052a437ac12a57e05bdd97d314ade6f8e1cc4801d13cfbcdffe8d83fa3842` |
   | Large intestine | v1.3, https://doi.org/10.48539/HBM682.RSXX.965 | `3d-sbu-f-large-intestine.glb` | 387,376 | `b3046d2af718e7f031578db4089a9f4bea707aa4a75af98aab78f172c2f53d74` |

   - All four files were downloaded from `https://cdn.humanatlas.io/digital-objects/ref-organ/…/assets/`.
   - They provide the duodenum, jejunum, ileum, caecum, appendix, colon and rectum; the liver with its segments and ligaments; the pancreas; and the hepatopancreatic sphincter.
2. **3D Reference Organ Set for Female v1.5 (HRA united female)**, DOI https://doi.org/10.48539/HBM352.BTSQ.586, CC BY 4.0.
   - Taken as converted by *Female Atlas* (github.com/Niyaz-05/female-atlas, commit `4c2dfcca02739b59827601915128ee64abdff2ea`). The converter's +0.794760942 m vertical translation is reversed here.
   - The official organ files match these parts after that translation.
   - It provides the gallbladder, the hepatic, cystic and common bile ducts, the hepatopancreatic ampulla, and the main and accessory pancreatic ducts.
3. **BodyParts3D 4.0**, © The **Database Center for Life Science** (DBCLS), CC BY 4.0. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
   - The oesophagus (FJ2563) and stomach (FJ2564), which the HRA female organs do not include.
   - Taken as converted by *Human Atlas* (github.com/Niyaz-05/human-atlas, commit `76f069640f2c3dd40a58d1556896ac25008f592e`).

Neither HuBMAP nor DBCLS has reviewed or endorsed this lab.

### Changes made (as CC BY 4.0 requires)

`tools/extract-digestive.mjs`:

- selected and merged the source meshes listed in `src/digestive/source/structures.source.json` into 51 structures;
- welded coincident vertices, simplified the HRA meshes with meshoptimizer within a 0.4 % relative error bound (154,348 → 56,555 triangles in total), and recomputed smooth normals;
- subdivided and smoothed the coarse BodyParts3D oesophagus and stomach (no simplification);
- **fitted the BodyParts3D oesophagus and stomach onto the HRA female body:**
  1. an affine transform fitted to 11 landmark organs (RMS misfit 18 mm, because a male and a female abdomen differ);
  2. a refinement of shift, rotation and scale (scale 0.88) onto the surfaces where HRA shows the stomach touching its neighbours. The liver's gastric impression and the spleen's gastric surface end up 5.8 mm (median) from the stomach, the oesophageal impression 5.3 mm from the oesophagus, and the pylorus within 1 mm of the duodenum;
  3. **gentle reshaping ("moulding")** of the stomach where it still overlapped the liver, pancreas, colon or spleen: 1,412 vertex moves with smoothing, leaving 0.03 % overlap, while the joins with the oesophagus and duodenum are kept fixed. Their **shape and position are therefore approximate.**
- translated the model so the centre of its bounding box is the origin;
- generated the food, bile and pancreatic-juice routes through the inside of each organ (`geometry.json`).

`tools/bake-shading.mjs` then added a per-vertex attribute (`_TISSUE`: ambient occlusion and colour variation) for the real-tissue rendering. No positions were changed. The unbaked model has sha256 `d30b73ad060c9f2422a9297f77158b8c0b32d650e7e2ff88d70bf9360cd8f67c`.

Output `digestive.glb` has sha256 `6f8dae786587fa51d3bbdb00beffd180c921105f31f4da5f610b0007f87fc1b4`. The full record is in `src/digestive/generated/provenance.json`.

## Explanatory text

Written for this project and checked against the sources cited in the lab (OpenStax *Anatomy and Physiology 2e*, chapter 23, CC BY 4.0). No source text is reproduced.

## Software

React, three.js, three-mesh-bvh, @react-three/fiber, @react-three/drei and zod (all MIT), each under its own licence.
