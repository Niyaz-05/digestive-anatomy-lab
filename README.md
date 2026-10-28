# Digestive System — Interactive 3D Learning Lab

**Live:** https://digestive-anatomy-lab.vercel.app

Works on phones and tablets: the details rise from the bottom in a sheet you can drag, fold or close with a swipe down, and picking a structure frames it above the sheet.

A realistic, interactive 3D human digestive system for secondary-school and first-year biology:

- **Real look.** The organs as they look in a specimen: glistening pink-grey oesophagus and stomach, pink-tan small intestine, greyish-pink colon, red-brown liver, green gallbladder and pale pancreas. "Colour" switches to **Organs** to give each organ its own colour.
- **Organ explorer.** Select, search and isolate the oesophagus, stomach, the parts of the duodenum, the jejunum and ileum, caecum, appendix, every part of the colon and the rectum; the liver, its segments and ligaments; the gallbladder and bile ducts; and the pancreas and its ducts.
- **Journey of food.** In **Digestion** mode a food bolus travels from the oesophagus to the rectum through the inside of each organ, while the panel shows what happens at each stage and how long it takes in life.
- **Digestive juices.** Bile (green) flows from the liver and gallbladder, and pancreatic juice (gold) from the pancreas, along their ducts into the duodenum.
- **Cut.** Slice the abdomen side-to-side, front-to-back or top-to-bottom to see the organ walls and the hollow tubes.
- **Guided tour.** 11 steps from the oesophagus to the rectum, plus the liver, gallbladder and pancreas.

**Educational only.** This is not a clinical tool, and the text has not been reviewed by a physician. The organs are HuBMAP Human Reference Atlas female reference organs; the oesophagus and stomach are BodyParts3D (DBCLS), fitted onto them. All are CC BY 4.0; see [public/ATTRIBUTION.md](public/ATTRIBUTION.md).

## Run

Requires Node.js ≥ 22.12.

```sh
npm install
npm run dev            # http://localhost:5186
npm run build          # type-check + production build → dist/
npm run preview        # http://localhost:5187
```

Add `?quality=high` or `?quality=low` to the URL to force a rendering quality. By default the lab drops the costly wet coat and sheen on software renderers and when frames stay slow.

## Check

```sh
npm run typecheck
npm test                         # unit tests (Vitest)
npm run validate:assets          # model hash, nodes, geometry sanity, baked shading, attribution
npx playwright install chromium  # once
npm run build && npm run e2e     # browser tests (Playwright)
```

See [docs/TESTING.md](docs/TESTING.md) for results and what is not verified.

## Rebuild the model

`public/models/digestive.glb` is generated:

1. Download the four official HRA female organs (3.7 MB in total) into `source/`. The URLs and sha256 hashes are in `public/ATTRIBUTION.md`.
2. Have checkouts of the Female Atlas (`github.com/Niyaz-05/female-atlas`) and the Human Atlas (`github.com/Niyaz-05/human-atlas`). They supply the gallbladder and ducts (HRA united female body) and the oesophagus and stomach (BodyParts3D).
3. Run:

```sh
node tools/extract-digestive.mjs "<female-atlas>/public/models" "<human-atlas>/public/models"
node tools/bake-shading.mjs
node tools/validate-assets.mjs
```

Both steps are deterministic, and every input and the output are hashed in `src/digestive/generated/provenance.json`. `tools/inspect-sources.mjs` lists the official files' nodes and checks them against the united body.

## Deploy

The site is a Vercel project (Vite preset, output `dist/`) connected to [github.com/Niyaz-05/digestive-anatomy-lab](https://github.com/Niyaz-05/digestive-anatomy-lab). Every push to `main` deploys to https://digestive-anatomy-lab.vercel.app; pushes to other branches get preview URLs.

## Layout

| Path | What |
|---|---|
| `src/contract/` | Simulation schema (zod), approved-asset registry, validation gate |
| `src/digestive/` | Definition (structures, organs, food and juice routes, tour, sources), anchors and routes, generated geometry and provenance |
| `src/app/` | Pure state reducer (modes, colour, cut, food and juice toggles), search, React context |
| `src/viewer/` | three.js / react-three-fiber scene: tissue material and lighting, digestive model with cut caps, food bolus and juice particles, camera rig, labels |
| `src/ui/` | Panels: structures (with colour and cut controls), details, digestion, tour, About |
| `tools/` | Source inspection, extraction, shading bake and asset validation |
| `tests/unit`, `tests/e2e` | Vitest and Playwright suites |
