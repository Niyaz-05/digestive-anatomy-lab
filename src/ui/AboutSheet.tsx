import { useEffect, useRef } from 'react';
import { useLab } from '../app/LabContext';
import { BILE, FOOD, ORGAN_COLOUR, ORGAN_NAMES, PANCREATIC } from '../viewer/palette';

/**
 * Source, scope and credits, kept off the main screen. The HuBMAP and BodyParts3D attribution
 * required by CC BY 4.0 lives here and is reachable from the ⓘ button and the "Source & credits" link.
 */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  const { def } = useLab();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="about-sheet glass" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost sheet-close" onClick={onClose} aria-label="Close">✕</button>
        <p className="eyebrow">Source &amp; scope</p>
        <h2 id="about-title" className="sheet-title" tabIndex={-1} ref={title}>About this lab</h2>
        <p>{def.summary}</p>

        <h3 className="group-title">You will learn to</h3>
        <ul className="objectives">
          {def.learningObjectives.map((o) => <li key={o.id}>{o.text}</li>)}
        </ul>

        <h3 className="group-title">Colours</h3>
        <p className="small muted">
          “Real” shows the organs as they look in a specimen: pink-grey oesophagus and stomach, pink-tan small intestine,
          greyish-pink colon, red-brown liver, green gallbladder and pale pancreas. “Organs” gives each organ its own colour.
        </p>
        <p className="legend-row">
          {Object.entries(ORGAN_NAMES).map(([k, name]) => (
            <span key={k}><span className="dot" style={{ background: ORGAN_COLOUR[k] }} aria-hidden="true" /> {name}</span>
          ))}
        </p>
        <p className="legend-row">
          <span><span className="dot" style={{ background: FOOD }} aria-hidden="true" /> Food</span>
          <span><span className="dot" style={{ background: BILE }} aria-hidden="true" /> Bile</span>
          <span><span className="dot" style={{ background: PANCREATIC }} aria-hidden="true" /> Pancreatic juice</span>
        </p>

        <h3 className="group-title">Animations</h3>
        <ul className="small disclaimers">
          {[def.foodRoute, ...def.juiceRoutes].flatMap((r) => r.assumptions).map((a) => <li key={a}>{a}</li>)}
        </ul>

        <h3 className="group-title">Please note</h3>
        <ul className="small disclaimers">
          {def.disclaimers.map((d) => <li key={d}>{d}</li>)}
        </ul>

        <h3 className="group-title">Source</h3>
        <p className="small">
          Organs: HuBMAP Human Reference Atlas female reference organs (liver, pancreas, small and large intestine) and the
          HRA female organ set (gallbladder and ducts), by Kristen Browne, Heidi Schlehlein et al. Oesophagus and stomach:
          BodyParts3D, © The Database Center for Life Science. All licensed under CC Attribution 4.0 International. Neither
          HuBMAP nor DBCLS has reviewed or endorsed this lab.
        </p>
        <div className="link-list small">
          <a href={`${import.meta.env.BASE_URL}ATTRIBUTION.md`} target="_blank" rel="noopener">Attribution and changes made ↗</a>
          <a href="https://doi.org/10.48539/HBM784.FBXB.245" target="_blank" rel="noopener noreferrer">HRA small intestine ↗</a>
          <a href="https://doi.org/10.48539/HBM682.RSXX.965" target="_blank" rel="noopener noreferrer">HRA large intestine ↗</a>
          <a href="https://doi.org/10.48539/HBM599.GZLD.639" target="_blank" rel="noopener noreferrer">HRA liver ↗</a>
          <a href="https://doi.org/10.48539/HBM866.PNNZ.328" target="_blank" rel="noopener noreferrer">HRA pancreas ↗</a>
          <a href="https://doi.org/10.48539/HBM352.BTSQ.586" target="_blank" rel="noopener noreferrer">HRA female organ set ↗</a>
          <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noopener noreferrer">BodyParts3D ↗</a>
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 licence ↗</a>
        </div>
      </section>
    </div>
  );
}
